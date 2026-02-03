import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Headphones,
  LogOut,
  Moon,
  PhoneCall,
  Sun,
  Users,
  Mic,
  Volume2
} from 'lucide-react';

const LOGO_URL =
  'https://getonbrd-prod.s3.amazonaws.com/uploads/users/logo/8588/Isotipo_Houm_Square_Negativo__1_.jpg';

function getNavItems(role) {
  if (role === 'admin') {
    return [
      { href: '/dialer', label: 'Dialer' },
      { href: '/review', label: 'Campañas' },
      { href: '/metrics', label: 'Metricas' },
      { href: '/users', label: 'Usuarios' }
    ];
  }
  if (role === 'supervisor') {
    return [
      { href: '/dialer', label: 'Dialer' },
      { href: '/metrics', label: 'Metricas' }
    ];
  }
  return [{ href: '/dialer', label: 'Dialer' }];
}

function getInitials(email) {
  if (!email) return 'H';
  const base = email.split('@')[0] || '';
  const parts = base.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return base.slice(0, 2).toUpperCase() || 'H';
  const initials = parts.slice(0, 2).map((p) => p[0]).join('');
  return initials.toUpperCase();
}

export default function AppHeader({ email, role, picture, onLogout, audioConfig, onMenuReady }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const menuRef = useRef(null);
  const profileRef = useRef(null);
  const followSystemRef = useRef(true);

  const navItems = useMemo(() => getNavItems(role), [role]);
  const initials = useMemo(() => getInitials(email), [email]);
  const avatarUrl = (picture || '').trim();
  const displayName = useMemo(() => (email ? email.split('@')[0] : ''), [email]);
  const activePath = router.pathname;
  const sectionLabel = useMemo(() => {
    const labelMap = {
      '/dialer': 'Dialer',
      '/metrics': 'Dashboard',
      '/users': 'Usuarios',
      '/review': 'Campañas'
    };
    return labelMap[activePath] || 'Dialer';
  }, [activePath]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!menuRef.current || !profileRef.current) return;
      if (menuRef.current.contains(event.target)) return;
      if (profileRef.current.contains(event.target)) return;
      setMenuOpen(false);
    };
    const handleRoute = () => setMenuOpen(false);
    document.addEventListener('mousedown', handleClick);
    router.events.on('routeChangeStart', handleRoute);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      router.events.off('routeChangeStart', handleRoute);
    };
  }, [router.events]);

  useEffect(() => {
    if (!onMenuReady) return;
    onMenuReady(() => setMenuOpen(true));
  }, [onMenuReady]);

  useEffect(() => {
    if (!audioConfig?.onMenuOpen) return;
    audioConfig.onMenuOpen(menuOpen);
  }, [menuOpen, audioConfig]);

  useEffect(() => {
    if (!window.matchMedia) {
      document.body.setAttribute('data-theme', 'dark');
      setTheme('dark');
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const applyTheme = (nextTheme) => {
      document.body.setAttribute('data-theme', nextTheme);
      setTheme(nextTheme);
    };
    try {
      const stored = window.localStorage.getItem('houm_theme');
      if (stored === 'light' || stored === 'dark') {
        followSystemRef.current = false;
        applyTheme(stored);
        return;
      }
    } catch (error) {
      console.error('Error leyendo tema guardado:', error);
    }
    followSystemRef.current = true;
    applyTheme(media.matches ? 'light' : 'dark');
    const handleChange = (event) => {
      if (!followSystemRef.current) return;
      applyTheme(event.matches ? 'light' : 'dark');
    };
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    followSystemRef.current = false;
    setTheme(nextTheme);
    document.body.setAttribute('data-theme', nextTheme);
    try {
      window.localStorage.setItem('houm_theme', nextTheme);
    } catch (error) {
      console.error('Error guardando tema:', error);
    }
  };

  const handleLogout = () => {
    setMenuOpen(false);
    if (onLogout) onLogout();
  };

  return (
    <header className="app-header">
      <div className="app-header__left">
        <Link href="/dialer" className="app-header__brand">
          <img src={LOGO_URL} alt="Houm" className="app-header__logo" />
        </Link>
        <div className="app-header__section" aria-label="Seccion actual">
          {sectionLabel}
        </div>
      </div>

      <div className="app-header__right">
        <button
          ref={profileRef}
          type="button"
          className={`app-header__profile ${menuOpen ? 'is-open' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="app-header__avatar">
            {avatarUrl ? <img src={avatarUrl} alt={email || 'Perfil'} /> : initials}
          </span>
          <span className="app-header__email">{email}</span>
          <ChevronDown className="icon-sm" />
        </button>

        {menuOpen && (
          <div ref={menuRef} className="app-header__menu" role="menu">
            <div className="app-header__menu-profile">
              <div className="app-header__menu-avatar">
                {avatarUrl ? <img src={avatarUrl} alt={email || 'Perfil'} /> : initials}
              </div>
              <div className="app-header__menu-info">
                <strong>{displayName || 'houm'}</strong>
                <span>{email}</span>
              </div>
            </div>
            <div className="app-header__menu-divider" />
            <div className="app-header__menu-heading">Navegacion</div>
            <div className="app-header__menu-section">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className={`app-header__menu-item ${activePath === item.href ? 'active' : ''}`}
                >
                  <span className="app-header__menu-icon">
                    {item.href === '/dialer' && <PhoneCall className="icon-sm" />}
                    {item.href === '/review' && <CheckCircle2 className="icon-sm" />}
                    {item.href === '/metrics' && <BarChart3 className="icon-sm" />}
                    {item.href === '/users' && <Users className="icon-sm" />}
                  </span>
                  <span className="app-header__menu-label">{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="app-header__menu-divider" />
            <div className="app-header__menu-heading">Configuracion</div>
            <div className="app-header__menu-row" role="group" aria-label="Tema">
              <div className="app-header__menu-row-left">
                <span className="app-header__menu-icon">
                  {theme === 'dark' ? <Moon className="icon-sm" /> : <Sun className="icon-sm" />}
                </span>
                <span className="app-header__menu-label">Tema</span>
              </div>
              <button
                type="button"
                className={`app-header__menu-switch ${theme === 'light' ? 'is-on' : ''}`}
                onClick={toggleTheme}
                aria-label="Cambiar tema"
                aria-pressed={theme === 'light'}
              >
                <span className="app-header__menu-switch-thumb" />
              </button>
            </div>
            {audioConfig && (
              <>
                <div className="app-header__menu-divider" />
                <div className="app-header__menu-heading">Audio</div>
                <div className="app-header__menu-audio">
                  <div className="app-header__menu-audio-row">
                    <span className="app-header__menu-icon">
                      <Mic className="icon-sm" />
                    </span>
                    <div className="app-header__menu-audio-content">
                      <span className="app-header__menu-label">Microfono</span>
                      <select
                        className="app-header__menu-select"
                        value={audioConfig.selectedInputId || ''}
                        onChange={(event) => audioConfig.onInputChange?.(event.target.value)}
                      >
                        {(audioConfig.inputs || []).length === 0 && <option value="">Sin dispositivos</option>}
                        {(audioConfig.inputs || []).map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || 'Microfono'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="app-header__menu-audio-row">
                    <span className="app-header__menu-icon">
                      <Volume2 className="icon-sm" />
                    </span>
                    <div className="app-header__menu-audio-content">
                      <span className="app-header__menu-label">Altavoz</span>
                      <select
                        className="app-header__menu-select"
                        value={audioConfig.selectedOutputId || ''}
                        onChange={(event) => audioConfig.onOutputChange?.(event.target.value)}
                      >
                        {(audioConfig.outputs || []).length === 0 && <option value="">Por defecto</option>}
                        {(audioConfig.outputs || []).map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || 'Altavoz'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="app-header__menu-audio-meter">
                    <span className="app-header__menu-icon">
                      <Headphones className="icon-sm" />
                    </span>
                    <div className="app-header__menu-audio-content">
                      <span className="app-header__menu-label">Nivel de entrada</span>
                      <div className="app-header__menu-meter">
                        <span style={{ width: `${Math.min(100, audioConfig.level || 0)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="app-header__menu-divider" />
            <div className="app-header__menu-heading danger">Sesion</div>
            <button type="button" className="app-header__menu-item logout" onClick={handleLogout}>
              <span className="app-header__menu-icon">
                <LogOut className="icon-sm" />
              </span>
              Cerrar sesion
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .app-header__menu :global(a),
        .app-header__menu :global(a:visited),
        .app-header__menu :global(a:hover),
        .app-header__menu :global(a:active),
        .app-header__menu :global(a:focus) {
          text-decoration: none;
          color: inherit;
        }
        .app-header {
          position: sticky;
          top: 16px;
          z-index: 40;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255, 133, 66, 0.45);
          background: linear-gradient(120deg, rgba(227, 80, 38, 0.95), rgba(234, 99, 56, 0.92));
          box-shadow:
            0 22px 40px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 174, 120, 0.25);
        }
        .app-header__left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .app-header__brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #fff;
          text-decoration: none;
        }
        .app-header__logo {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
        }
        .app-header__section {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          padding: 0;
          border-radius: 0;
          background: transparent;
          border: none;
        }
        .app-header__right {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }
        .app-header__profile {
          height: 44px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: rgba(18, 22, 42, 0.18);
          color: #fff;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px 0 6px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
          max-width: min(320px, 60vw);
        }
        .app-header__profile:hover,
        .app-header__profile.is-open {
          background: rgba(18, 22, 42, 0.3);
          transform: translateY(-1px);
        }
        .app-header__avatar {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.32);
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 12px;
          flex-shrink: 0;
          overflow: hidden;
        }
        .app-header__avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .app-header__email {
          font-weight: 700;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .app-header__menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: min(280px, 86vw);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(9, 13, 22, 0.98);
          box-shadow: 0 18px 32px rgba(0, 0, 0, 0.4);
          padding: 12px;
          display: grid;
          gap: 6px;
          z-index: 50;
          --menu-icon-col: 32px;
          --menu-icon-gap: 18px;
          --menu-left-pad: 12px;
          --menu-text-start: calc(var(--menu-left-pad) + var(--menu-icon-col) + var(--menu-icon-gap));
        }
        .app-header__menu-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 6px 10px 6px;
        }
        .app-header__menu-avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          overflow: hidden;
        }
        .app-header__menu-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .app-header__menu-info {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .app-header__menu-info strong {
          font-size: 14px;
          color: #fff;
        }
        .app-header__menu-info span {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .app-header__menu-section {
          display: grid;
          gap: 4px;
        }
        .app-header__menu-heading {
          font-size: 10px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 600;
          padding: 4px 0;
        }
        .app-header__menu-heading.danger {
          color: rgba(255, 123, 118, 0.6);
        }
        .app-header__menu-item {
          width: 100%;
          height: 42px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255, 255, 255, 0.86);
          text-decoration: none;
          padding: 0 var(--menu-left-pad);
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          display: grid;
          align-items: center;
          grid-template-columns: var(--menu-icon-col) 1fr;
          column-gap: var(--menu-icon-gap);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
          position: relative;
        }
        .app-header__menu-icon {
          width: var(--menu-icon-col);
          height: var(--menu-icon-col);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
          flex-shrink: 0;
        }
        .app-header__menu-icon :global(svg) {
          width: 18px;
          height: 18px;
        }
        .app-header__menu-label {
          flex: 1;
          display: inline-flex;
          align-items: center;
        }
        .app-header__menu-row {
          height: 42px;
          border-radius: 12px;
          display: grid;
          align-items: center;
          grid-template-columns: var(--menu-icon-col) 1fr auto;
          column-gap: var(--menu-icon-gap);
          padding: 0 var(--menu-left-pad);
          color: rgba(255, 255, 255, 0.6);
        }
        .app-header__menu-audio {
          display: grid;
          gap: 10px;
        }
        .app-header__menu-audio-row,
        .app-header__menu-audio-meter {
          display: grid;
          grid-template-columns: var(--menu-icon-col) 1fr;
          column-gap: var(--menu-icon-gap);
          align-items: center;
          padding: 0 var(--menu-left-pad);
        }
        .app-header__menu-audio-content {
          display: grid;
          gap: 6px;
        }
        .app-header__menu-select {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font-size: 12px;
          padding: 6px 10px;
        }
        .app-header__menu-select:focus {
          outline: 2px solid rgba(255, 122, 41, 0.8);
          outline-offset: 2px;
        }
        .app-header__menu-meter {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .app-header__menu-meter span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, rgba(255, 122, 41, 0.6), rgba(255, 122, 41, 1));
          transition: width 0.15s ease;
        }
        .app-header__menu-row-left {
          display: contents;
        }
        .app-header__menu-switch {
          width: 40px;
          height: 22px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          position: relative;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .app-header__menu-switch-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.15s ease;
        }
        .app-header__menu-switch.is-on {
          background: rgba(255, 122, 41, 0.9);
          border-color: rgba(255, 122, 41, 0.9);
        }
        .app-header__menu-switch.is-on .app-header__menu-switch-thumb {
          transform: translateX(18px);
        }
        .app-header__menu-switch:focus-visible {
          outline: 2px solid rgba(255, 122, 41, 0.85);
          outline-offset: 2px;
        }
        .app-header__menu-item:visited,
        .app-header__menu-item:active,
        .app-header__menu-item:focus {
          color: rgba(255, 255, 255, 0.86);
          text-decoration: none;
        }
        .app-header__menu-item:focus-visible {
          outline: 2px solid rgba(255, 122, 41, 0.85);
          outline-offset: 2px;
        }
        .app-header__menu-item:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }
        .app-header__menu-item.active {
          border-color: rgba(255, 122, 41, 0.45);
          background: rgba(255, 122, 41, 0.18);
          color: #fff;
        }
        .app-header__menu-item.active::before {
          content: '';
          width: 3px;
          height: 24px;
          border-radius: 999px;
          background: rgba(255, 122, 41, 0.9);
          position: absolute;
          left: 6px;
          top: 50%;
          transform: translateY(-50%);
        }
        .app-header__menu-item.logout {
          color: rgba(255, 123, 118, 0.9);
        }
        .app-header__menu-item.logout .app-header__menu-label {
          justify-self: center;
        }
        .app-header__menu-item.logout:hover {
          background: rgba(255, 82, 82, 0.08);
          border-color: rgba(255, 82, 82, 0.22);
        }
        .app-header__menu-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 2px 0;
        }
        :global(body[data-theme='light']) .app-header__menu {
          border-color: rgba(0, 0, 0, 0.1);
          background: #fff;
          box-shadow: 0 16px 28px rgba(0, 0, 0, 0.12);
        }
        :global(body[data-theme='light']) .app-header__menu-avatar {
          background: rgba(0, 0, 0, 0.08);
          color: #111827;
          border-color: rgba(0, 0, 0, 0.1);
        }
        :global(body[data-theme='light']) .app-header__menu-info strong {
          color: #111827;
        }
        :global(body[data-theme='light']) .app-header__menu-info span {
          color: rgba(17, 24, 39, 0.6);
        }
        :global(body[data-theme='light']) .app-header__menu-item {
          color: rgba(17, 24, 39, 0.8);
        }
        :global(body[data-theme='light']) .app-header__menu-icon {
          color: rgba(17, 24, 39, 0.7);
        }
        :global(body[data-theme='light']) .app-header__menu-item:hover {
          border-color: rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.05);
          color: #111827;
        }
        :global(body[data-theme='light']) .app-header__menu-item.active {
          border-color: rgba(255, 122, 41, 0.35);
          background: rgba(255, 122, 41, 0.15);
          color: #111827;
        }
        :global(body[data-theme='light']) .app-header__menu-item.active::before {
          background: rgba(255, 122, 41, 0.9);
        }
        :global(body[data-theme='light']) .app-header__menu-row {
          color: rgba(17, 24, 39, 0.6);
        }
        :global(body[data-theme='light']) .app-header__menu-select {
          border-color: rgba(0, 0, 0, 0.12);
          background: rgba(0, 0, 0, 0.04);
          color: #111827;
        }
        :global(body[data-theme='light']) .app-header__menu-meter {
          background: rgba(0, 0, 0, 0.08);
        }
        :global(body[data-theme='light']) .app-header__menu-switch {
          border-color: rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.08);
        }
        :global(body[data-theme='light']) .app-header__menu-switch.is-on {
          background: rgba(255, 122, 41, 0.9);
          border-color: rgba(255, 122, 41, 0.9);
        }
        :global(body[data-theme='light']) .app-header__menu-divider {
          background: rgba(0, 0, 0, 0.08);
        }
        :global(body[data-theme='light']) .app-header__menu-item.logout {
          color: rgba(220, 38, 38, 0.85);
        }
        :global(body[data-theme='light']) .app-header__menu-item.logout:hover {
          background: rgba(220, 38, 38, 0.08);
          border-color: rgba(220, 38, 38, 0.18);
        }
        :global(body[data-theme='light']) .app-header__menu-heading {
          color: rgba(17, 24, 39, 0.45);
        }
        :global(body[data-theme='light']) .app-header__menu-heading.danger {
          color: rgba(220, 38, 38, 0.6);
        }
        @media (max-width: 720px) {
          .app-header {
            top: 10px;
            padding: 10px 12px;
          }
          .app-header__section {
            font-size: 12px;
            padding: 4px 8px;
          }
          .app-header__profile {
            max-width: 56vw;
          }
        }
        @media (max-width: 520px) {
          .app-header {
            border-radius: 16px;
          }
          .app-header__email {
            display: none;
          }
          .app-header__profile {
            padding-right: 6px;
          }
          .app-header__section {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
