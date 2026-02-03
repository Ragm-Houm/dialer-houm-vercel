import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BarChart3, Loader2, ShieldAlert, Users } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useSession } from '../lib/session';

const ALLOWED_ROLES = ['admin', 'supervisor'];

export default function MetricsPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ejecutivo');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [execCampaignFilter, setExecCampaignFilter] = useState('all');
  const [rankMetric, setRankMetric] = useState('contactRate');
  const [datePreset, setDatePreset] = useState('7d');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [totals, setTotals] = useState({
    campaigns: 0,
    calls: 0,
    leadsCompleted: 0,
    leadsSkipped: 0,
    callSeconds: 0,
    activeSeconds: 0
  });
  const router = useRouter();
  const { session, isSessionReady, sessionError, clearSession, csrfFetch } = useSession();

  const topCampaigns = useMemo(() => (Array.isArray(campaigns) ? campaigns.slice(0, 6) : []), [campaigns]);
  const topUsers = useMemo(() => (Array.isArray(users) ? users.slice(0, 12) : []), [users]);
  const execRows = useMemo(() => {
    if (execCampaignFilter === 'all') {
      return topUsers;
    }
    const campaignList = Array.isArray(campaigns) ? campaigns : [];
    const campaign = campaignList.find((c) => c.campaignKey === execCampaignFilter);
    if (!campaign || !campaign.executives) return [];
    return campaign.executives.slice(0, 12);
  }, [execCampaignFilter, campaigns, topUsers]);

  const getBucketValue = (bucketMap, key) => {
    if (!bucketMap) return 0;
    return bucketMap[key] || 0;
  };

  // Sumar bucket nuevo + legacy para compatibilidad con datos existentes
  const getBucketGroup = (bucketMap, ...keys) => {
    if (!bucketMap) return 0;
    return keys.reduce((sum, k) => sum + (bucketMap[k] || 0), 0);
  };

  const computeContactRate = (user) => {
    const contacted = getBucketGroup(user.buckets,
      'contacto_efectivo', 'conversion', 'interesado', 'agendado', 'publicada', 'reservada', 'arrendada');
    const total = user.calls || 0;
    if (!total) return 0;
    return contacted / total;
  };

  const rankingRows = useMemo(() => {
    if (!users || users.length === 0) return [];
    const scored = users.map((user) => {
      const contactRate = computeContactRate(user);
      const scoreMap = {
        contactRate,
        callsPerHour: user.callsPerHour || 0,
        leadsCompleted: user.leadsCompleted || 0,
        skipRate: user.skipRate || 0,
        talkRatio: user.talkRatio || 0
      };
      return { ...user, contactRate, score: scoreMap[rankMetric] ?? 0 };
    });
    const sorted = [...scored].sort((a, b) => {
      if (rankMetric === 'skipRate') {
        return a.score - b.score;
      }
      return b.score - a.score;
    });
    return sorted.slice(0, 10);
  }, [users, rankMetric]);

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
    setAuthError(sessionError || '');
    if (!session?.email) {
      router.replace('/login');
      return;
    }
    if (!ALLOWED_ROLES.includes(session.role)) {
      setAuthError('Tu rol no tiene acceso a metricas');
      router.replace('/dialer');
      return;
    }
    setEmail(session.email);
    setRole(session.role || 'ejecutivo');
    setSessionStarted(true);
  }, [isSessionReady, session, sessionError, router]);

  const loadMetrics = async (userEmail) => {
    try {
      setSyncStatus('loading');
      setLoading(true);
      const res = await csrfFetch(
        `/api/metrics-campaigns?email=${encodeURIComponent(userEmail)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'No se pudieron cargar metricas');
        return;
      }
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setTotals(
        data.totals || {
          campaigns: 0,
          calls: 0,
          leadsCompleted: 0,
          leadsSkipped: 0,
          callSeconds: 0,
          activeSeconds: 0
        }
      );
      setLastSyncAt(new Date());
      setSyncStatus('ok');
    } catch (error) {
      console.error('Error cargando metricas:', error);
      setAuthError('Error cargando metricas');
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionStarted || !email) return;
    loadMetrics(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted, email, dateFrom, dateTo]);

  const handleLogout = () => {
    clearSession();
    router.replace('/dialer');
    setSessionStarted(false);
    setCampaigns([]);
    setUsers([]);
    setAlerts([]);
    setTotals({
      campaigns: 0,
      calls: 0,
      leadsCompleted: 0,
      leadsSkipped: 0,
      callSeconds: 0,
      activeSeconds: 0
    });
    setRole('ejecutivo');
    setIdToken('');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor((seconds || 0) / 60);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0) return `${hrs}h ${rem}m`;
    return `${rem}m`;
  };

  const formatSync = (date) => {
    if (!date) return 'Sin sincronizar';
    const diff = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace unos segundos';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `Hace ${hrs}h ${mins % 60}m`;
  };

  const applyDatePreset = (preset) => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start = end;
    if (preset === 'today') {
      start = end;
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().slice(0, 10);
    } else if (preset === '15d') {
      const d = new Date();
      d.setDate(d.getDate() - 15);
      start = d.toISOString().slice(0, 10);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(1);
      start = d.toISOString().slice(0, 10);
    } else {
      return;
    }
    setDatePreset(preset);
    setDateFrom(start);
    setDateTo(end);
  };

  return (
    <>
      <Head>
        <title>Métricas de campañas</title>
      </Head>

      <style jsx global>{`
        body {
          --page-bg: radial-gradient(1100px circle at 5% 10%, var(--accent-glow), transparent 60%),
            radial-gradient(900px circle at 85% 15%, var(--success-glow), transparent 65%),
            var(--bg);
          color: var(--text-primary);
        }
      `}</style>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px 20px 60px;
        }
        .container {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }
        .header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .header-nav {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
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
        .title h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.4px;
        }
        .title p {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .session {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .chip {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-soft-2);
          font-size: 12px;
          font-weight: 700;
        }
        .sync-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .sync-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
        }
        .sync-dot::after {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-muted);
        }
        .sync-dot.ok::after {
          background: #22c55e;
        }
        .sync-dot.loading::after {
          background: #f59e0b;
        }
        .sync-dot.error::after {
          background: #ef4444;
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--border-subtle);
          border-radius: 18px;
          padding: 16px;
          box-shadow: var(--shadow-strong);
        }
        .auth-card {
          max-width: 460px;
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }
        .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--text-subtle);
        }
        .input {
          width: 100%;
          background: var(--surface-strong);
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
          padding: 12px;
          border-radius: 12px;
          font-weight: 600;
        }
        .btn {
          border: none;
          padding: 12px 16px;
          border-radius: 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: var(--text-on-accent);
        }
        .btn-secondary {
          background: var(--surface-soft-2);
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
        }
        .google-btn {
          display: flex;
          justify-content: center;
          padding: 6px 0;
        }
        .error {
          font-size: 12px;
          color: var(--danger);
          font-weight: 600;
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .metric-value {
          font-size: 26px;
          font-weight: 700;
          margin-top: 4px;
        }
        .grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          gap: 16px;
        }
        .campaign-list {
          display: grid;
          gap: 10px;
        }
        .campaign-item {
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          padding: 12px;
          background: var(--surface-soft-3);
          display: grid;
          gap: 6px;
        }
        .campaign-title {
          font-weight: 700;
        }
        .campaign-meta {
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          flex-wrap: wrap;
          gap: 6px 12px;
        }
        .exec-list {
          display: grid;
          gap: 8px;
        }
        .exec-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 10px 12px;
          background: var(--surface-soft-3);
          font-size: 13px;
          gap: 8px;
        }
        .exec-email {
          font-weight: 600;
          word-break: break-word;
        }
        .exec-stats {
          display: flex;
          gap: 10px;
          color: var(--text-strong);
          font-weight: 600;
        }
        .campaign-filter {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
        }
        .date-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: flex-start;
        }
        .date-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .date-chip {
          border: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--text-primary);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .date-chip.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .date-inputs {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .date-inputs .campaign-filter {
          width: auto;
          min-width: 140px;
        }
        .rank-card {
          display: grid;
          gap: 12px;
        }
        .rank-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .rank-list {
          display: grid;
          gap: 8px;
        }
        .rank-item {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-soft-3);
        }
        .rank-index {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
        }
        .rank-name {
          font-weight: 700;
          font-size: 13px;
          color: var(--text-primary);
        }
        .rank-meta {
          font-size: 11px;
          color: var(--text-muted);
        }
        .rank-score {
          font-weight: 700;
          font-size: 13px;
          color: var(--text-primary);
        }
        .alerts-card {
          display: grid;
          gap: 10px;
        }
        .alert-item {
          border-radius: 12px;
          border: 1px solid var(--alert-border);
          background: var(--alert-bg);
          padding: 10px 12px;
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .alert-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--alert-dot);
          box-shadow: 0 0 0 3px var(--alert-dot-glow);
        }
        .outcomes-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .outcome-chip {
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-soft);
          font-size: 11px;
          color: var(--text-muted);
        }
        .empty {
          padding: 28px 12px;
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
        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .header-nav {
            width: 100%;
          }
        }
      `}</style>

      <div className="page">
        <div className="container">
          {sessionStarted && <AppHeader email={email} role={role} picture={session?.picture} onLogout={handleLogout} />}
          <div className="header">
            <div className="title">
              <h1>Métricas de campañas</h1>
              <p>Resumen del rendimiento por campaña y por ejecutivo.</p>
            </div>
            {sessionStarted && (
              <div className="session">
                <span className="chip sync-chip">
                  <span className={`sync-dot ${syncStatus}`} />
                  {syncStatus === 'loading' ? 'Sincronizando...' : formatSync(lastSyncAt)}
                </span>
                <div className="chip">{email} · {role}</div>
              </div>
            )}
          </div>

          {sessionStarted && (
            <div className="card date-card">
              <div className="label">Rango de fechas</div>
              <div className="date-presets">
                {[
                  { value: 'today', label: 'Hoy' },
                  { value: '7d', label: '7 días' },
                  { value: '15d', label: '15 días' },
                  { value: '30d', label: '30 días' },
                  { value: 'month', label: 'Este mes' }
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`date-chip ${datePreset === preset.value ? 'active' : ''}`}
                    onClick={() => applyDatePreset(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="date-inputs">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setDatePreset('custom');
                  }}
                  className="campaign-filter"
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>a</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setDatePreset('custom');
                  }}
                  className="campaign-filter"
                />
                <button className="btn btn-secondary" onClick={() => loadMetrics(email)}>
                  Actualizar
                </button>
              </div>
              <div className="label" style={{ textTransform: 'none' }}>
                Los indicadores se calculan con el rango seleccionado.
              </div>
            </div>
          )}

          {!sessionStarted ? (
            <div className="card auth-card">
              <div className="label">Sesion requerida</div>
              <div className="label" style={{ textTransform: 'none' }}>
                Inicia sesion una sola vez desde el Dialer.
              </div>
              {authError && <div className="error">{authError}</div>}
              <div className="google-btn">
                <Link className="btn btn-primary" href="/dialer">
                  Ir al Dialer
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="summary">
                <div className="card" title="Número de campañas activas en el rango seleccionado.">
                  <div className="label">Campañas activas</div>
                  <div className="metric-value">{totals.campaigns}</div>
                </div>
                <div className="card" title="Total de llamadas iniciadas dentro del rango.">
                  <div className="label">Llamadas realizadas</div>
                  <div className="metric-value">{totals.calls}</div>
                </div>
                <div className="card" title="Leads con resultado guardado (gestión completada).">
                  <div className="label">Leads gestionados</div>
                  <div className="metric-value">{totals.leadsCompleted}</div>
                </div>
                <div className="card" title="Leads avanzados sin llamada, con razón registrada.">
                  <div className="label">Leads saltados</div>
                  <div className="metric-value">{totals.leadsSkipped}</div>
                </div>
                <div className="card" title="Tiempo total en llamadas dentro del rango.">
                  <div className="label">Tiempo en llamada</div>
                  <div className="metric-value">{formatDuration(totals.callSeconds)}</div>
                </div>
                <div className="card" title="Tiempo total activo en campañas dentro del rango.">
                  <div className="label">Tiempo activo</div>
                  <div className="metric-value">{formatDuration(totals.activeSeconds)}</div>
                </div>
              </div>

              {loading && (
                <div className="card empty">
                  <Loader2 className="spin" />
                  Cargando metricas...
                </div>
              )}

              {!loading && campaigns.length === 0 && (
                <div className="card empty">
                  <ShieldAlert />
                  Aún no hay datos de campañas.
                </div>
              )}

              {!loading && campaigns.length > 0 && (
                <div className="grid">
                  <div className="card">
                    <div className="label" style={{ marginBottom: 10 }}>
                      <BarChart3 size={14} style={{ marginRight: 6 }} /> Campañas con mayor actividad
                    </div>
                    <div className="campaign-list">
                      {topCampaigns.map((c) => (
                        <div key={c.campaignKey} className="campaign-item">
                          <div className="campaign-title">
                            {c.name || `${c.country} · ${c.stageName || `Etapa ${c.stageId}`}`}
                          </div>
                          <div className="campaign-meta">
                            <span title="Leads pendientes por gestionar en la campaña.">Pendientes: {c.totals.pending}</span>
                            <span title="Leads actualmente bloqueados/en cola por otro ejecutivo.">En cola: {c.totals.locked}</span>
                            <span title="Llamadas realizadas en la campaña.">Llamadas: {c.totals.calls}</span>
                            <span title="Leads gestionados con resultado final.">Gestionados: {c.totals.leadsCompleted}</span>
                            <span title="Leads saltados con razón registrada.">Saltos: {c.totals.leadsSkipped}</span>
                            <span title="Leads con contacto efectivo.">🟢 Contactados: {getBucketGroup(c.totals.buckets, 'contacto_efectivo', 'interesado', 'contactado')}</span>
                            <span title="Resultados positivos (agenda/cierre).">🏆 Cierres positivos: {getBucketGroup(c.totals.buckets, 'conversion', 'agendado', 'publicada', 'reservada', 'arrendada')}</span>
                            <span title="Intentos sin contacto (no contesta).">📵 No contestan: {getBucketGroup(c.totals.buckets, 'no_contacto', 'no_contesta')}</span>
                            <span title="Leads con seguimiento futuro asignado.">🔄 Seguimiento futuro: {getBucketGroup(c.totals.buckets, 'seguimiento', 'futuro')}</span>
                            <span title="Leads descartados definitivamente.">🚫 Descartes: {getBucketGroup(c.totals.buckets, 'descarte', 'perdido', 'falso', 'caro')}</span>
                            <span title="Contactados / llamadas realizadas.">
                              Tasa de contacto:{' '}
                              {(() => {
                                const contacted = getBucketGroup(c.totals.buckets,
                                  'contacto_efectivo', 'conversion', 'interesado', 'agendado', 'publicada', 'reservada', 'arrendada', 'contactado');
                                const totalCalls = c.totals.calls || 0;
                                if (!totalCalls) return '0%';
                                return `${Math.round((contacted / totalCalls) * 100)}%`;
                              })()}
                            </span>
                          </div>
                          {c.outcomes && Object.keys(c.outcomes).length > 0 && (
                            <div className="outcomes-list">
                              {Object.entries(c.outcomes).slice(0, 6).map(([key, value]) => (
                                <span key={key} className="outcome-chip">
                                  {key.replace(/_/g, ' ')} · {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="label" style={{ marginBottom: 10 }}>
                      <Users size={14} style={{ marginRight: 6 }} /> Ejecutivos (rendimiento)
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <select
                        value={execCampaignFilter}
                        onChange={(event) => setExecCampaignFilter(event.target.value)}
                        className="campaign-filter"
                      >
                        <option value="all">Todas las campañas</option>
                        {campaigns.map((campaign) => (
                          <option key={campaign.campaignKey} value={campaign.campaignKey}>
                            {campaign.name || `${campaign.country} · ${campaign.stageName || `Etapa ${campaign.stageId}`}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="exec-list">
                      {execRows.length === 0 && (
                        <div className="empty">Sin ejecutivos para este filtro.</div>
                      )}
                      {execRows.map((exec) => (
                        <div key={`${exec.email}-${exec.leadsCompleted}-${exec.calls}`} className="exec-item">
                          <div className="exec-email">{exec.email}</div>
                          <div className="exec-stats">
                            <span>Llamadas: {exec.calls}</span>
                            <span>Leads gestionados: {exec.leadsCompleted}</span>
                            <span>Saltos: {exec.leadsSkipped}</span>
                            <span>Tiempo en llamada: {formatDuration(exec.callSeconds)}</span>
                            <span>
                              Tasa de contacto:{' '}
                              {(() => {
                                const contacted = getBucketGroup(exec.buckets,
                                  'contacto_efectivo', 'conversion', 'interesado', 'agendado', 'publicada', 'reservada', 'arrendada', 'contactado');
                                const total = exec.calls || 0;
                                if (!total) return '0%';
                                return `${Math.round((contacted / total) * 100)}%`;
                              })()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!loading && alerts.length > 0 && (
                <div className="card alerts-card">
                  <div className="label">Alertas operativas</div>
                  {alerts.map((alert) => (
                    <div key={`${alert.type}-${alert.email}`} className="alert-item">
                      <span className="alert-dot" />
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}

              {!loading && users.length > 0 && (
                <div className="card rank-card">
                  <div className="rank-header">
                    <div className="label">Ranking de ejecutivos</div>
                    <select
                      className="campaign-filter"
                      value={rankMetric}
                      onChange={(event) => setRankMetric(event.target.value)}
                    >
                      <option value="contactRate">Tasa de contacto</option>
                      <option value="callsPerHour">Llamadas por hora</option>
                      <option value="leadsCompleted">Leads gestionados</option>
                      <option value="talkRatio">Porcentaje en llamada</option>
                      <option value="skipRate">Menor tasa de saltos</option>
                    </select>
                  </div>
                  <div className="rank-list">
                    {rankingRows.map((user, index) => (
                      <div key={`${user.email}-${rankMetric}`} className="rank-item">
                        <div className="rank-index">{index + 1}</div>
                        <div>
                          <div className="rank-name">{user.email}</div>
                          <div className="rank-meta">
                            Leads: {user.leadsCompleted} · Llamadas: {user.calls} · Tiempo:{' '}
                            {formatDuration(user.callSeconds)}
                          </div>
                        </div>
                        <div className="rank-score">
                          {rankMetric === 'contactRate' && `${Math.round(user.contactRate * 100)}%`}
                          {rankMetric === 'callsPerHour' && user.callsPerHour.toFixed(1)}
                          {rankMetric === 'leadsCompleted' && user.leadsCompleted}
                          {rankMetric === 'talkRatio' && `${Math.round(user.talkRatio * 100)}%`}
                          {rankMetric === 'skipRate' && `${Math.round(user.skipRate * 100)}%`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
