import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CheckCircle2, Loader2, ShieldAlert, UserCog, Pencil, Search } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useSession } from '../lib/session';

const ALLOWED_ROLES = ['admin', 'supervisor'];
const COUNTRY_OPTIONS = ['CO', 'MX', 'CL'];
const COUNTRY_FLAGS = { CO: '🇨🇴', MX: '🇲🇽', CL: '🇨🇱' };

export default function UsersPage() {
  const [email, setEmail] = useState('');
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
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();
  const { session, isSessionReady, sessionError, clearSession, csrfFetch } = useSession();

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => String(a.email).localeCompare(String(b.email))),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedUsers.filter((user) => {
      const matchesSearch =
        !query || user.email?.toLowerCase().includes(query) || user.role?.toLowerCase().includes(query);
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesCountry = filterCountry === 'all' || user.country === filterCountry;
      const matchesActive =
        filterActive === 'all' || (filterActive === 'active' ? user.activo : !user.activo);
      return matchesSearch && matchesRole && matchesCountry && matchesActive;
    });
  }, [sortedUsers, search, filterRole, filterCountry, filterActive]);

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

  const bootstrap = async (savedEmail, savedRole) => {
    try {
      setLoading(true);
      setAuthError('');

      setEmail(savedEmail);
      setRole(savedRole);
      setSessionStarted(true);

      const res = await csrfFetch(
        `/api/users?email=${encodeURIComponent(savedEmail)}`
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
    if (!session?.email) {
      router.replace('/login');
      return;
    }
    if (!ALLOWED_ROLES.includes(session.role)) {
      setAuthError('Solo admin puede gestionar usuarios');
      router.replace('/dialer');
      return;
    }
    setEmail(session.email);
    setRole(session.role || 'ejecutivo');
    setSessionStarted(true);
    bootstrap(session.email, session.role || 'ejecutivo');
  }, [isSessionReady, session, sessionError, router]);
  const reload = async () => {
    if (!email) return;
    const res = await csrfFetch(`/api/users?email=${encodeURIComponent(email)}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
  };

  const handleSave = async () => {
    if (!email || !targetEmail || !targetCountry) return;
    try {
      setSaving(true);
      setAuthError('');
      const res = await csrfFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email,
          targetEmail,
          role: targetRole,
          country: targetCountry,
          activo: targetActive
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'No se pudo guardar');
        return false;
      }
      setTargetEmail('');
      setTargetRole('ejecutivo');
      setTargetCountry('CO');
      setTargetActive(true);
      await reload();
      return true;
    } catch (error) {
      console.error('Error guardando usuario:', error);
      setAuthError('Error guardando usuario');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editUser || !email) return;
    try {
      setEditSaving(true);
      const res = await csrfFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email,
          targetEmail: editUser.email,
          role: editUser.role,
          country: editUser.country,
          activo: editUser.activo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'No se pudo guardar');
        return;
      }
      setEditUser(null);
      await reload();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      setAuthError('Error guardando usuario');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleActive = async (user) => {
    if (!email || !user?.email) return;
    try {
      setSaving(true);
      const res = await csrfFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email,
          targetEmail: user.email,
          role: user.role,
          country: user.country,
          activo: !user.activo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'No se pudo actualizar');
        return;
      }
      await reload();
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      setAuthError('Error actualizando usuario');
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
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
        }
        .toolbar-left {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border-strong);
          background: var(--surface-strong);
          color: var(--text-primary);
        }
        .search input {
          border: none;
          outline: none;
          background: transparent;
          color: inherit;
          font-weight: 600;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-soft);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-subtle);
        }
        .filter {
          min-width: 130px;
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
          grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 0.6fr)) minmax(0, 0.8fr);
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-soft-3);
          font-weight: 600;
          font-size: 13px;
          align-items: center;
        }
        .item-header {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-subtle);
          background: transparent;
          border: none;
          padding: 0 12px;
        }
        .actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .flag {
          font-size: 16px;
          margin-right: 6px;
        }
        .icon-btn {
          border: 1px solid var(--border-strong);
          background: var(--surface-soft);
          color: var(--text-primary);
          border-radius: 10px;
          padding: 6px 10px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .icon-btn.secondary {
          background: transparent;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          font-size: 12px;
          font-weight: 700;
          background: var(--surface-soft);
        }
        .status-pill.active {
          color: var(--success);
        }
        .status-pill.inactive {
          color: var(--danger);
        }
        .modal {
          position: fixed;
          inset: 0;
          background: rgba(5, 8, 20, 0.5);
          display: grid;
          place-items: center;
          z-index: 40;
          padding: 24px;
        }
        .modal-card {
          width: min(520px, 95vw);
          background: var(--surface);
          border: 1px solid var(--border-subtle);
          border-radius: 18px;
          padding: 18px;
          box-shadow: var(--shadow-strong);
          display: grid;
          gap: 12px;
        }
        .read-only {
          background: var(--surface-soft);
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 600;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 800;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
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
          .actions {
            justify-content: flex-start;
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
                <div className="label">Mi perfil</div>
                <div className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{email}</div>
                    <div className="label" style={{ textTransform: 'none' }}>
                      {role} · {session?.country ? (
                        <>
                          <span className="flag">{COUNTRY_FLAGS[session.country] || '🏳️'}</span>
                          {session.country}
                        </>
                      ) : (
                        'Sin país'
                      )}
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() =>
                      setEditUser({
                        email,
                        role,
                        country: session?.country || 'CO',
                        activo: true
                      })
                    }
                  >
                    <Pencil size={14} />
                    Editar perfil
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="label">Acciones rápidas</div>
                <div className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div className="label" style={{ textTransform: 'none' }}>
                    Crea un usuario nuevo y asigna rol + país.
                  </div>
                  <button className="btn" type="button" onClick={() => setCreateOpen(true)}>
                    <CheckCircle2 size={16} />
                    Crear usuario
                  </button>
                </div>
                {authError && <div className="error">{authError}</div>}
              </div>

              <div className="card">
                <div className="label">Usuarios</div>
                <div className="toolbar">
                  <div className="toolbar-left">
                    <div className="search">
                      <Search size={14} />
                      <input
                        placeholder="Buscar por email o rol"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <div className="filter-group">
                      <span className="filter-pill">Filtros</span>
                      <select className="select filter" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                        <option value="all">Roles</option>
                        <option value="admin">admin</option>
                        <option value="supervisor">supervisor</option>
                        <option value="ejecutivo">ejecutivo</option>
                      </select>
                      <select
                        className="select filter"
                        value={filterCountry}
                        onChange={(e) => setFilterCountry(e.target.value)}
                      >
                        <option value="all">País</option>
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select filter"
                        value={filterActive}
                        onChange={(e) => setFilterActive(e.target.value)}
                      >
                        <option value="all">Estado</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                      </select>
                    </div>
                  </div>
                </div>
                {loading && (
                  <div className="empty">
                    <Loader2 className="spin" />
                    Cargando...
                  </div>
                )}
                {!loading && filteredUsers.length === 0 && (
                  <div className="empty">
                    <ShieldAlert />
                    No hay usuarios para este filtro.
                  </div>
                )}
                {!loading && filteredUsers.length > 0 && (
                  <div className="list">
                    <div className="item item-header">
                      <div>Email</div>
                      <div>Rol</div>
                      <div>País</div>
                      <div>Estado</div>
                      <div style={{ textAlign: 'right' }}>Acciones</div>
                    </div>
                    {filteredUsers.map((u) => (
                      <div key={u.email} className="item">
                        <div>{u.email}</div>
                        <div>{u.role}</div>
                        <div>
                          {u.country ? (
                            <>
                              <span className="flag">{COUNTRY_FLAGS[u.country] || '🏳️'}</span>
                              {u.country}
                            </>
                          ) : (
                            '-'
                          )}
                        </div>
                        <div>
                          <span className={`status-pill ${u.activo ? 'active' : 'inactive'}`}>
                            {u.activo ? 'activo' : 'inactivo'}
                          </span>
                        </div>
                        <div className="actions">
                          <button className="icon-btn secondary" onClick={() => setEditUser({ ...u })}>
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button className="icon-btn" onClick={() => toggleActive(u)}>
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {editUser && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Editar usuario</div>
              <button className="icon-btn secondary" onClick={() => setEditUser(null)}>
                Cerrar
              </button>
            </div>
            <div className="row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="label">Email</div>
              <div className="read-only">{editUser.email}</div>
              <div className="label">Rol</div>
              <select
                className="select"
                value={editUser.role}
                onChange={(e) => setEditUser((prev) => ({ ...prev, role: e.target.value }))}
              >
                {role === 'admin' && <option value="admin">admin</option>}
                <option value="supervisor">supervisor</option>
                <option value="ejecutivo">ejecutivo</option>
              </select>
              <div className="label">País</div>
              <select
                className="select"
                value={editUser.country || 'CO'}
                onChange={(e) => setEditUser((prev) => ({ ...prev, country: e.target.value }))}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="label">Estado</div>
              <select
                className="select"
                value={editUser.activo ? 'true' : 'false'}
                onChange={(e) => setEditUser((prev) => ({ ...prev, activo: e.target.value === 'true' }))}
              >
                <option value="true">activo</option>
                <option value="false">inactivo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditUser(null)}>
                Cancelar
              </button>
              <button className="btn" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Crear usuario</div>
              <button className="icon-btn secondary" onClick={() => setCreateOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="label">Email</div>
              <input
                className="input"
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="usuario@houm.com"
              />
              <div className="label">Rol</div>
              <select className="select" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                {role === 'admin' && <option value="admin">admin</option>}
                <option value="supervisor">supervisor</option>
                <option value="ejecutivo">ejecutivo</option>
              </select>
              <div className="label">País</div>
              <select className="select" value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)}>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="label">Estado</div>
              <select
                className="select"
                value={targetActive ? 'true' : 'false'}
                onChange={(e) => setTargetActive(e.target.value === 'true')}
              >
                <option value="true">activo</option>
                <option value="false">inactivo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  const ok = await handleSave();
                  if (ok) setCreateOpen(false);
                }}
                disabled={saving}
              >
                {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                Crear usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
