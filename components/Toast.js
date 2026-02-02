import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const COLORS = {
  success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
  error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  info: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#6366f1' }
};

let toastIdCounter = 0;

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const Icon = ICONS[toast.type] || Info;
  const color = COLORS[toast.type] || COLORS.info;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 5000);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`toast-item ${exiting ? 'toast-exit' : 'toast-enter'}`}
      style={{ background: color.bg, borderColor: color.border }}
    >
      <Icon style={{ width: 18, height: 18, color: color.text, flexShrink: 0 }} />
      <span className="toast-msg">{toast.message}</span>
      <button className="toast-close" onClick={handleClose} type="button">
        <X style={{ width: 14, height: 14 }} />
      </button>

      <style jsx>{`
        .toast-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          min-width: 280px;
          max-width: 420px;
          backdrop-filter: blur(12px);
          animation: toast-in 0.3s ease forwards;
        }
        .toast-exit {
          animation: toast-out 0.3s ease forwards;
        }
        .toast-msg {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
          line-height: 1.4;
        }
        .toast-close {
          background: none;
          border: none;
          color: var(--text-muted, #888);
          cursor: pointer;
          padding: 2px;
          border-radius: 6px;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .toast-close:hover {
          background: rgba(128,128,128,0.15);
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(40px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(40px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, message, duration: duration || 5000 }]);
    return id;
  }, []);

  const toast = useCallback({
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur || 7000),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur)
  }, [addToast]);

  // Fix: useCallback can't wrap an object, use useMemo-like pattern
  const toastApi = useRef(null);
  if (!toastApi.current) {
    toastApi.current = {
      success: (msg, dur) => addToast('success', msg, dur),
      error: (msg, dur) => addToast('error', msg, dur || 7000),
      warning: (msg, dur) => addToast('warning', msg, dur),
      info: (msg, dur) => addToast('info', msg, dur)
    };
  }
  // Keep methods updated
  toastApi.current._add = addToast;

  return (
    <ToastContext.Provider value={toastApi.current}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>

      <style jsx>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        }
        .toast-container > :global(*) {
          pointer-events: auto;
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if not in provider — use basic console
    return {
      success: (msg) => console.log('[toast:success]', msg),
      error: (msg) => console.error('[toast:error]', msg),
      warning: (msg) => console.warn('[toast:warning]', msg),
      info: (msg) => console.log('[toast:info]', msg)
    };
  }
  return {
    success: (msg, dur) => ctx._add('success', msg, dur),
    error: (msg, dur) => ctx._add('error', msg, dur || 7000),
    warning: (msg, dur) => ctx._add('warning', msg, dur),
    info: (msg, dur) => ctx._add('info', msg, dur)
  };
}
