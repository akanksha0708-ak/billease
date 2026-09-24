// Small reusable UI building blocks.
import { useEffect } from 'react';
import Icon from './Icon';

export function Spinner({ small }) {
  return <span className={small ? 'spinner spinner-sm' : 'spinner'} role="status" aria-label="Loading" />;
}

export function Loading({ text = 'Loading…' }) {
  return <div className="loading"><Spinner /> <span>{text}</span></div>;
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error">
      <Icon name="alert" /> <span>{message}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon = 'invoice', title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

// Button that shows a spinner and is disabled while `loading` is true.
export function Button({ loading, disabled, children, className = 'btn-primary', ...props }) {
  return (
    <button className={`btn ${className}`} disabled={loading || disabled} {...props}>
      {loading && <Spinner small />} {children}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }) {
  // Close with the Escape key.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Label + input wrapper with an optional error message under the field.
export function Field({ label, error, required, children, hint }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}{required && <span className="req"> *</span>}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
