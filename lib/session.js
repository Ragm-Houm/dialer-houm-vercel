import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initCsrf, csrfFetch, getCsrfToken } from './csrf-client';
import {
  getSessionInfo,
  hasSessionCookie,
  login as cookieLogin,
  logout as cookieLogout,
  fetchSession,
  migrateFromLocalStorage
} from './session-cookie-client';

const SessionContext = createContext({
  session: null,
  isSessionReady: false,
  sessionError: '',
  updateSession: () => {},
  clearSession: () => {},
  csrfFetch: () => Promise.resolve(),
  loginWithGoogle: () => Promise.resolve()
});

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const lastActiveRef = useRef(Date.now());
  const lastPersistRef = useRef(0);

  useEffect(() => {
    let isActive = true;
    const restore = async () => {
      try {
        // Inicializar CSRF token al cargar la app (no bloquear si falla)
        try {
          await initCsrf();
        } catch (csrfError) {
          console.warn('CSRF init falló, continuando sin CSRF:', csrfError);
        }

        // Primero verificar si hay cookies de sesión
        if (hasSessionCookie()) {
          // Obtener sesión desde el servidor (valida el token)
          const data = await fetchSession();

          if (data.ok && data.session) {
            if (isActive) {
              setSession({
                email: data.session.email,
                role: data.session.role,
                country: data.session.country,
                picture: data.session.picture,
                name: data.session.name
              });
              setSessionError(
                data.session.country ? '' : 'Tu usuario no tiene pais asignado. Pide a tu supervisor que lo configure.'
              );
              setIsSessionReady(true);
            }
            return;
          }
        }

        // Fallback: intentar migrar desde localStorage (para usuarios existentes)
        const savedToken = window.localStorage.getItem('review_token');
        if (savedToken) {
          try {
            const migrated = await migrateFromLocalStorage(csrfFetch);
            if (migrated) {
              // Recargar sesión después de migrar
              const data = await fetchSession();
              if (data.ok && data.session && isActive) {
                setSession({
                  email: data.session.email,
                  role: data.session.role,
                  country: data.session.country,
                  picture: data.session.picture,
                  name: data.session.name
                });
                setSessionError(
                  data.session.country ? '' : 'Tu usuario no tiene pais asignado. Pide a tu supervisor que lo configure.'
                );
                setIsSessionReady(true);
                return;
              }
            }
          } catch (migrationError) {
            console.error('Error migrando sesión:', migrationError);
          }
        }

        // No hay sesión válida
        if (isActive) {
          setSession(null);
          setSessionError('');
          setIsSessionReady(true);
        }
      } catch (error) {
        console.error('Error restaurando sesion global:', error);
        if (isActive) {
          setSession(null);
          setSessionError('Error restaurando sesion');
          setIsSessionReady(true);
        }
      }
    };
    restore();
    return () => {
      isActive = false;
    };
  }, []);

  // Login con Google ID Token (establece cookies HttpOnly)
  const loginWithGoogle = useCallback(async (idToken) => {
    try {
      const data = await cookieLogin(idToken, csrfFetch);

      if (data.ok && data.session) {
        setSession({
          email: data.session.email,
          role: data.session.role,
          country: data.session.country,
          picture: data.session.picture,
          name: data.session.name
        });
        setSessionError(data.warning || '');
        return { ok: true, session: data.session };
      }

      return { ok: false, error: data.error || 'Error en login' };
    } catch (error) {
      console.error('Error en login:', error);
      return { ok: false, error: error.message };
    }
  }, []);

  // updateSession ahora solo actualiza el estado local
  // (el token ya está en cookies HttpOnly)
  const updateSession = useCallback((nextSession) => {
    if (!nextSession?.email) {
      return;
    }
    const role = nextSession.role || 'ejecutivo';
    const country = nextSession.country || '';
    const payload = {
      email: nextSession.email,
      role,
      country,
      picture: nextSession.picture || '',
      name: nextSession.name || ''
    };
    setSession(payload);
    setSessionError(
      country ? '' : 'Tu usuario no tiene pais asignado. Pide a tu supervisor que lo configure.'
    );
  }, []);

  // Logout: limpia cookies y estado
  const clearSession = useCallback(async () => {
    try {
      await cookieLogout(csrfFetch);
    } catch (error) {
      console.error('Error en logout:', error);
    }
    setSession(null);
    setSessionError('');
  }, []);

  // Tracking de inactividad
  useEffect(() => {
    if (!session) return;
    const IDLE_LIMIT_MS = 30 * 60 * 1000;
    const ACTIVITY_KEY = 'review_last_active';
    const ACTIVITY_THROTTLE_MS = 5000;

    const now = Date.now();
    lastActiveRef.current = now;
    lastPersistRef.current = now;
    try {
      window.localStorage.setItem(ACTIVITY_KEY, String(now));
    } catch (error) {
      console.error('Error guardando actividad:', error);
    }

    const markActivity = () => {
      const ts = Date.now();
      lastActiveRef.current = ts;
      if (ts - lastPersistRef.current < ACTIVITY_THROTTLE_MS) return;
      lastPersistRef.current = ts;
      try {
        window.localStorage.setItem(ACTIVITY_KEY, String(ts));
      } catch (error) {
        console.error('Error guardando actividad:', error);
      }
    };

    const syncFromStorage = () => {
      try {
        const stored = window.localStorage.getItem(ACTIVITY_KEY);
        if (!stored) return;
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          lastActiveRef.current = Math.max(lastActiveRef.current, parsed);
        }
      } catch (error) {
        console.error('Error leyendo actividad:', error);
      }
    };

    const checkIdle = async () => {
      syncFromStorage();
      if (Date.now() - lastActiveRef.current >= IDLE_LIMIT_MS) {
        setSessionError('Sesion cerrada por inactividad');
        await clearSession();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus'];
    events.forEach((event) => window.addEventListener(event, markActivity));
    window.addEventListener('storage', syncFromStorage);
    const interval = window.setInterval(checkIdle, 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      window.removeEventListener('storage', syncFromStorage);
      window.clearInterval(interval);
    };
  }, [session, clearSession]);

  const value = useMemo(
    () => ({
      session,
      isSessionReady,
      sessionError,
      updateSession,
      clearSession,
      csrfFetch,
      getCsrfToken,
      loginWithGoogle
    }),
    [session, isSessionReady, sessionError, updateSession, clearSession, loginWithGoogle]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
