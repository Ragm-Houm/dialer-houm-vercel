/**
 * Utilidades de sesión para el cliente (browser)
 *
 * Solo puede leer la cookie 'session_info' (NO HttpOnly)
 * Las cookies HttpOnly (token, email) son manejadas automáticamente
 * por el navegador y enviadas con cada request.
 */

const INFO_COOKIE_NAME = 'session_info';

/**
 * Lee la información de sesión desde la cookie del cliente
 * Solo disponible la info NO sensible (role, country, picture, name)
 */
export function getSessionInfo() {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === INFO_COOKIE_NAME && rest.length > 0) {
      try {
        const value = rest.join('=');
        const decoded = atob(value);
        return JSON.parse(decoded);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Verifica si hay una cookie de sesión (indica que el usuario está logueado)
 */
export function hasSessionCookie() {
  if (typeof document === 'undefined') return false;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name] = cookie.trim().split('=');
    if (name === INFO_COOKIE_NAME) {
      return true;
    }
  }
  return false;
}

/**
 * Login: envía el ID Token al servidor para establecer cookies
 */
export async function login(idToken, csrfFetch) {
  const fetchFn = csrfFetch || fetch;

  const res = await fetchFn('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken })
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Error en login');
  }

  return data;
}

/**
 * Logout: elimina las cookies de sesión
 */
export async function logout(csrfFetch) {
  const fetchFn = csrfFetch || fetch;

  const res = await fetchFn('/api/auth/session', {
    method: 'DELETE',
    credentials: 'same-origin'
  });

  if (!res.ok) {
    console.error('Error en logout');
  }

  // Limpiar localStorage legacy
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('review_email');
    window.localStorage.removeItem('review_token');
    window.localStorage.removeItem('review_role');
    window.localStorage.removeItem('review_country');
    window.localStorage.removeItem('review_picture');
    window.localStorage.removeItem('review_last_active');
  }

  return true;
}

/**
 * Obtener sesión actual desde el servidor
 */
export async function fetchSession() {
  const res = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'same-origin'
  });

  const data = await res.json();
  return data;
}

/**
 * Migrar de localStorage a cookies (para usuarios existentes)
 */
export async function migrateFromLocalStorage(csrfFetch) {
  if (typeof window === 'undefined') return false;

  const savedToken = window.localStorage.getItem('review_token');
  if (!savedToken) return false;

  try {
    // Intentar establecer cookies con el token guardado
    await login(savedToken, csrfFetch);

    // Limpiar localStorage después de migrar
    window.localStorage.removeItem('review_email');
    window.localStorage.removeItem('review_token');
    window.localStorage.removeItem('review_role');
    window.localStorage.removeItem('review_country');
    window.localStorage.removeItem('review_picture');

    return true;
  } catch (error) {
    // Token expirado o inválido, limpiar localStorage
    window.localStorage.removeItem('review_email');
    window.localStorage.removeItem('review_token');
    window.localStorage.removeItem('review_role');
    window.localStorage.removeItem('review_country');
    window.localStorage.removeItem('review_picture');
    return false;
  }
}
