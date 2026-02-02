import { useState } from 'react';
import { AlertTriangle, XCircle, WifiOff, Mic, ChevronDown, ChevronRight, X, ShieldAlert } from 'lucide-react';

const ICONS = {
  connection: WifiOff,
  auth: ShieldAlert,
  mic: Mic,
  error: XCircle,
  warning: AlertTriangle
};

/**
 * ErrorModal - Modal estilizado para errores críticos
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - title: string (e.g. "Error de conexión")
 * - message: string (descripción amigable)
 * - technicalDetail: string (detalles técnicos, solo visible para admin)
 * - role: 'admin' | 'supervisor' | 'ejecutivo'
 * - icon: 'connection' | 'auth' | 'mic' | 'error' | 'warning'
 */
export default function ErrorModal({ open, onClose, title, message, technicalDetail, role, icon = 'error' }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!open) return null;

  const Icon = ICONS[icon] || ICONS.error;
  const isAdmin = role === 'admin';

  return (
    <div className="errmod-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="errmod-card">
        <button className="errmod-close" onClick={onClose} type="button">
          <X style={{ width: 18, height: 18 }} />
        </button>

        <div className="errmod-icon">
          <Icon style={{ width: 28, height: 28 }} />
        </div>

        <h2 className="errmod-title">{title || 'Ha ocurrido un error'}</h2>

        <p className="errmod-message">{message}</p>

        {!isAdmin && technicalDetail && (
          <p className="errmod-hint">Reporta este error a un administrador para que pueda revisarlo.</p>
        )}

        {isAdmin && technicalDetail && (
          <div className="errmod-details">
            <button
              className="errmod-details-toggle"
              onClick={() => setShowDetails(!showDetails)}
              type="button"
            >
              {showDetails ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
              Detalles técnicos
            </button>
            {showDetails && (
              <pre className="errmod-details-content">{technicalDetail}</pre>
            )}
          </div>
        )}

        <button className="errmod-btn" onClick={onClose} type="button">
          Entendido
        </button>
      </div>

      <style jsx>{`
        .errmod-overlay {
          position: fixed;
          inset: 0;
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          background: rgba(0,0,0,0.5);
          animation: errmod-fadein 0.2s ease;
        }
        .errmod-card {
          background: var(--surface, #fff);
          border-radius: 22px;
          padding: 36px 32px 28px;
          text-align: center;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          position: relative;
          animation: errmod-scalein 0.25s ease;
        }
        .errmod-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: var(--surface-alt, #f3f4f6);
          border: 1px solid var(--border, #e5e7eb);
          color: var(--text-muted, #888);
          cursor: pointer;
          padding: 6px;
          border-radius: 10px;
          transition: all 0.15s;
        }
        .errmod-close:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.3);
          color: #ef4444;
        }
        .errmod-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(239,68,68,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
          color: #ef4444;
        }
        .errmod-title {
          margin: 0 0 10px;
          font-size: 19px;
          font-weight: 700;
          color: var(--text-primary, #111);
        }
        .errmod-message {
          margin: 0 0 6px;
          font-size: 13px;
          color: var(--text-secondary, #666);
          line-height: 1.6;
        }
        .errmod-hint {
          margin: 12px 0 0;
          font-size: 12px;
          color: var(--text-muted, #999);
          font-style: italic;
          line-height: 1.5;
          padding: 8px 12px;
          background: var(--surface-alt, #f9fafb);
          border-radius: 10px;
          border: 1px solid var(--border, #e5e7eb);
        }
        .errmod-details {
          margin-top: 14px;
          text-align: left;
        }
        .errmod-details-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-muted, #888);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 0;
          transition: color 0.15s;
        }
        .errmod-details-toggle:hover {
          color: var(--text-primary, #333);
        }
        .errmod-details-content {
          margin: 8px 0 0;
          padding: 10px 12px;
          background: rgba(0,0,0,0.06);
          border-radius: 10px;
          border: 1px solid var(--border, #e5e7eb);
          font-size: 11px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: var(--text-secondary, #666);
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 120px;
          overflow-y: auto;
        }
        :global(body[data-theme='dark']) .errmod-details-content {
          background: rgba(255,255,255,0.06);
        }
        .errmod-btn {
          margin-top: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 36px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, var(--accent, #f94730), var(--accent-strong, #e03e28));
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .errmod-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(249,71,47,0.35);
        }
        @keyframes errmod-fadein {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes errmod-scalein {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
