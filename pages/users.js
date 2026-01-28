import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CheckCircle2, Loader2, ShieldAlert, UserCog } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useSession } from '../lib/session';

const ALLOWED_ROLES = ['admin', 'supervisor'];
const COUNTRY_OPTIONS = ['CO', 'MX', 'CL'];

export default function UsersPage() {
  const [email, setEmail] = useState('');
  const [idToken, setIdToken] = useState('');
  const [role, setRole] = useState('ejecutivo');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState('ejecutivo');
  const [targetCountry, setTargetCountry] = useState('CO');
  const [targetActive, setTargetActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { session, isSessionReady, sessionError, clearSession } = useSession();

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => String(a.email).localeCompare(String(b.email))),
    [users]
  );

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

  const handleLogout = () => {
    clearSession();
    setSessionStarted(false);
    router.replace('/dialer');
  };

  const bootstrap = async (savedEmail, savedToken, savedRole) => {
    try {
      setLoading(true);
      setAuthError('');

      setEmail(savedEmail);
      setIdToken(savedToken);
      setRole(savedRole);
      setSessionStarted(true);

      const res = await fetch(
        `/api/users?email=${encodeURIComponent(savedEmail)}&idToken=${encodeURIComponent(savedToken)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'No se pudieron cargar usuarios');
        return;
      }
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setAuthError('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSessionReady) return;
    setAuthError(sessionError || '');
    if (!session?.email || !session?.idToken) {
      router.replace('/login');
      return;
    }
    if (!ALLOWED_ROLES.includes(session.role)) {
      setAuthError('Solo admin puede gestionar usuarios');
      router.replace('/dialer');
      return;
    }
    setEmail(session.email);
    setIdToken(session.idToken);
    setRole(session.role || 'ejecutivo');
    setSessionStarted(true);
    bootstrap(session.email, session.idToken, session.role || 'ejecutivo');
  }, [isSessionReady, session, sessionError, router]);
  const reload = async () => {
    if (!email || !idToken) return;
    const res = await fetch(`/api/users?email=${encodeURIComponent(email)}&idToken=${encodeURIComponent(idToken)}`);
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
  };

  const handleSave = async () => {
    if (!email || !idToken || !targetEmail || !targetCountry) return;
    try {
      setSaving(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          idToken,
          targetEmail,
          role: targetRole,
          country: targetCountry,
          activo: targetActive
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'No se pudo guardar');
        return;
      }
      setTargetEmail('');
      setTargetRole('ejecutivo');
      setTargetCountry('CO');
      setTargetActive(true);
      await reload();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      setAuthError('Error guardando usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Usuarios y permisos</title>
      </Head>

      <style jsx global>{`
        body {
          --page-bg: radial-gradient(1100px circle at 5% 10%, var(--accent-glow), transparent 60%),
            radial-gradient(900px circle at 85% 15%, var(--success-glow), transparent 65%),
            var(--bg);
          color: var(--text-primary);
          font-family: 'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
      `}</style>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px 20px 60px;
        }
        .container {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .header-nav {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-soft);
          color: var(--text-primary);
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }
        .nav-link.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--border-subtle);
          border-radius: 18px;
          padding: 16px;
          box-shadow: var(--shadow-strong);
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-subtle);
        }
        .row {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) repeat(4, minmax(0, 0.6fr));
          gap: 8px;
          align-items: center;
        }
        .input,
        .select {
          width: 100%;
          background: var(--surface-strong);
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 600;
        }
        .btn {
          border: none;
          padding: 11px 14px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: var(--text-on-accent);
        }
        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .error {
          font-size: 12px;
          color: var(--danger);
          font-weight: 600;
        }
        .list {
          display: grid;
          gap: 8px;
        }
        .item {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) repeat(4, minmax(0, 0.6fr));
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-soft-3);
          font-weight: 600;
          font-size: 13px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-soft);
          font-size: 12px;
          font-weight: 700;
          width: fit-content;
        }
        .empty {
          padding: 24px 12px;
          text-align: center;
          color: var(--text-soft);
          display: grid;
          gap: 6px;
          justify-items: center;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 820px) {
          .row,
          .item {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">
        <div className="container">
          {sessionStarted && <AppHeader email={email} role={role} picture={session?.picture} onLogout={handleLogout} />}
          <div className="header">
            <h1>Usuarios y permisos</h1>
            <p>Solo administradores pueden crear y actualizar roles.</p>
          </div>

          {!sessionStarted ? (
            <div className="card empty">
              <ShieldAlert />
              {authError || 'Necesitas iniciar sesion como admin desde el dialer.'}
            </div>
          ) : (
            <>
              <div className="pill">
                <UserCog size={14} />
                {email} · {role}
              </div>

              <div className="card">
                <div className="label">Crear o actualizar usuario</div>
                <div className="row">
                  <input
                    className="input"
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="usuario@houm.com"
                  />
                  <select className="select" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                    {role === 'admin' && <option value="admin">admin</option>}
                    <option value="supervisor">supervisor</option>
                    <option value="ejecutivo">ejecutivo</option>
                  </select>
                  <select className="select" value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)}>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={targetActive ? 'true' : 'false'}
                    onChange={(e) => setTargetActive(e.target.value === 'true')}
                  >
                    <option value="true">activo</option>
                    <option value="false">inactivo</option>
                  </select>
                  <button className="btn" type="button" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                    Guardar
                  </button>
                </div>
                {authError && <div className="error">{authError}</div>}
              </div>

              <div className="card">
                <div className="label">Usuarios</div>
                {loading && (
                  <div className="empty">
                    <Loader2 className="spin" />
                    Cargando...
                  </div>
                )}
                {!loading && sortedUsers.length === 0 && (
                  <div className="empty">
                    <ShieldAlert />
                    No hay usuarios registrados.
                  </div>
                )}
                {!loading && sortedUsers.length > 0 && (
                  <div className="list">
                    {sortedUsers.map((u) => (
                      <div key={u.email} className="item">
                        <div>{u.email}</div>
                        <div>{u.role}</div>
                        <div>{u.country || '-'}</div>
                        <div>{u.activo ? 'activo' : 'inactivo'}</div>
                        <div>{u.updated_at ? String(u.updated_at).slice(0, 10) : '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
