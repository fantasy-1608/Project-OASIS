import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const TOAST_CONFIG = {
  success: { icon: CheckCircle2, color: 'var(--success)', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  error: { icon: XCircle, color: 'var(--error)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  info: { icon: Info, color: 'var(--accent-primary)', bg: 'rgba(212,162,90,0.12)', border: 'rgba(212,162,90,0.3)' },
};

export function Toast({ id, type = 'info', message, onDismiss, duration = 4000 }) {
  const cfg = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const Icon = cfg.icon;
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timerRef.current);
  }, [id, duration, onDismiss]);

  return (
    <div
      className="toast"
      style={{ background: cfg.bg, borderColor: cfg.border }}
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={() => { timerRef.current = setTimeout(() => onDismiss(id), 2000); }}
    >
      <Icon size={16} style={{ color: cfg.color, flexShrink: 0 }} />
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={() => onDismiss(id)}>
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
