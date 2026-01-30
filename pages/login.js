import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CheckCircle2, Loader2, Phone } from 'lucide-react';
import { useSession } from '../lib/session';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const router = useRouter();
  const { session, isSessionReady, loginWithGoogle } = useSession();
  const [authError, setAuthError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(false);
  const googleBtnRef = useRef(null);
  const googleInitRef = useRef(false);

  useEffect(() => {
    const applyTheme = (nextTheme) => {
      document.body.setAttribute('data-theme', nextTheme);
    };
    try {
      const storedTheme = window.localStorage.getItem('houm_theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        applyTheme(storedTheme);
        return;
      }
    } catch (error) {
      console.error('Error leyendo tema guardado:', error);
    }
    if (!window.matchMedia) {
      applyTheme('dark');
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => applyTheme(media.matches ? 'light' : 'dark');
    sync();
    const handleChange = (event) => applyTheme(event.matches ? 'light' : 'dark');
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isSessionReady) return;
    if (session?.email) {
      router.replace('/dialer');
    }
  }, [isSessionReady, session, router]);

  // Fallback: si la sesión no carga en 3s, mostrar el botón de Google igual
  useEffect(() => {
    if (isSessionReady) return;
    const timer = setTimeout(() => setSessionTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, [isSessionReady]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      return;
    }
    if (window.google) {
      setGoogleReady(true);
      return;
    }
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', () => setGoogleReady(true));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.setAttribute('data-google-identity', 'true');
    document.head.appendChild(script);
  }, []);

  const handleGoogleCredential = async (credentialResponse) => {
    const token = credentialResponse?.credential;
    if (!token) return;
    try {
      setAuthError('');
      // Usar el nuevo sistema de cookies HttpOnly
      const result = await loginWithGoogle(token);

      if (!result.ok) {
        setAuthError(result.error || 'No autorizado');
        return;
      }

      const userCountry = result.session?.country || '';
      if (!userCountry) {
        setAuthError('Tu usuario no tiene pais asignado. Pide a tu supervisor que lo configure.');
        return;
      }

      router.replace('/dialer');
    } catch (error) {
      console.error('Error con login Google:', error);
      setAuthError('Error validando Google');
    }
  };

  useEffect(() => {
    if (!googleReady) return;
    if (!(isSessionReady || sessionTimeout)) return;
    if (!googleBtnRef.current) return;
    if (!window.google || googleInitRef.current) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential
    });

    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      width: 280
    });

    googleInitRef.current = true;
  }, [googleReady, isSessionReady, sessionTimeout]);

  return (
    <>
      <Head>
        <title>Iniciar sesion</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="page">
        <div className="login-shell">
          <div className="brand">
            <img
              src="https://getonbrd-prod.s3.amazonaws.com/uploads/users/logo/8588/Isotipo_Houm_Square_Negativo__1_.jpg"
              alt="Houm"
              className="brand-logo"
            />
          </div>
          <div className="login-card">
            <h1>Iniciar sesion</h1>
            <p className="subtitle">Accede con Google Houm y comienza a marcar.</p>

            <div className="login-google">
              {(isSessionReady || sessionTimeout) ? (
                <div ref={googleBtnRef} className="google-btn" />
              ) : (
                <div className="login-loading">
                  <Loader2 className="icon-sm spin" />
                  Preparando acceso...
                </div>
              )}
              {authError && <div className="auth-error">{authError}</div>}
            </div>

            <div className="login-info">
              <div className="info-row">
                <span className="info-icon">
                  <Phone className="icon-sm" />
                </span>
                <div>
                  <div className="info-label">Caller ID</div>
                  <div className="info-value">Se asigna automaticamente</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px 20px;
          background: radial-gradient(1000px circle at 15% 10%, rgba(249, 71, 47, 0.18), transparent 60%),
            radial-gradient(900px circle at 85% 20%, rgba(0, 200, 83, 0.12), transparent 65%);
        }
        .login-shell {
          width: min(460px, 92vw);
          display: grid;
          gap: 18px;
          justify-items: center;
        }
        .login-card {
          width: 100%;
          position: relative;
          background: linear-gradient(180deg, rgba(15, 18, 36, 0.9), rgba(10, 12, 24, 0.9));
          border-radius: 22px;
          padding: 26px 24px 22px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 50px rgba(4, 8, 20, 0.5);
          overflow: hidden;
        }
        :global(body[data-theme='light']) .login-card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(242, 235, 229, 0.95));
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 24px 50px rgba(50, 32, 16, 0.18);
        }
        .login-card::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 24px;
          padding: 2px;
          background: linear-gradient(140deg, rgba(249, 71, 47, 1), rgba(255, 122, 89, 0.6), transparent 70%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .login-card::after {
          content: '';
          position: absolute;
          inset: -12px;
          border-radius: 28px;
          background: rgba(249, 71, 47, 0.28);
          filter: blur(20px);
          opacity: 0.75;
          z-index: -1;
        }
        .brand {
          display: flex;
          justify-content: center;
        }
        .brand-logo {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        }
        h1 {
          margin: 0;
          font-size: 22px;
          color: var(--text-primary);
        }
        .subtitle {
          margin: 8px 0 18px;
          color: var(--text-muted);
          font-size: 13px;
        }
        .login-google {
          display: grid;
          gap: 10px;
          place-items: center;
          margin-top: 6px;
        }
        .google-btn {
          display: flex;
          justify-content: center;
        }
        .login-hint {
          font-size: 12px;
          color: var(--text-muted);
        }
        .auth-error {
          font-size: 12px;
          color: var(--danger);
          font-weight: 600;
        }
        .login-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
        }
        .login-info {
          margin-top: 18px;
          display: grid;
          gap: 12px;
          text-align: left;
        }
        .info-row {
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 12px;
          align-items: center;
          color: var(--text-primary);
        }
        .info-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.85);
        }
        :global(body[data-theme='light']) .info-icon {
          color: rgba(0, 0, 0, 0.6);
        }
        .info-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-subtle);
          margin-bottom: 2px;
        }
        .info-value {
          font-size: 13px;
          color: var(--text-primary);
        }
        .spin {
          animation: spin 1.1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
