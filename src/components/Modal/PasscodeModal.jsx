import { useState, useEffect, useRef } from 'react';
import { X, Lock, ShieldAlert } from 'lucide-react';

export function PasscodeModal({ isOpen, onClose, onConfirm, actionLabel = 'để chỉnh sửa hệ thống' }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Autofocus input on open
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passcode || submitting) return;

    try {
      setSubmitting(true);
      setError('');
      await onConfirm(passcode);
      onClose();
    } catch (err) {
      setError(err?.message || 'Mật khẩu không chính xác!');
      setPasscode('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel glass-panel" style={{ maxWidth: '380px', borderRadius: '8px' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={18} className="text-primary" style={{ color: 'var(--accent-primary)' }} />
            <div className="modal-title" style={{ fontSize: '15px', fontWeight: '700' }}>{ 'Xác thực mở khóa' }</div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.45', textAlign: 'center' }}>
              { 'Vui lòng nhập mã bảo mật ' }<strong style={{ color: 'var(--text-primary)' }}>{actionLabel}</strong>.
            </div>

            <div className="form-field">
              <input
                ref={inputRef}
                type="password"
                className={`form-input ${error ? 'form-input--error' : ''}`}
                placeholder={ 'Nhập mã bảo mật...' }
                value={passcode}
                disabled={submitting}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError('');
                }}
                style={{
                  textAlign: 'center',
                  letterSpacing: '6px',
                  fontSize: '16px',
                  fontWeight: '700',
                  padding: '10px',
                  borderRadius: '6px'
                }}
              />
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--error)',
                fontSize: '12px',
                background: '#fef2f2',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                justifyContent: 'center'
              }}>
                <ShieldAlert size={14} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-footer" style={{ borderTop: 'none', padding: '0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ width: '100%', justifyContent: 'center', padding: '8px 0', borderRadius: '6px' }}>
                { 'Hủy bỏ' }
              </button>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '8px 0', borderRadius: '6px' }}>
                {submitting ? 'Đang xác minh...' : 'Mở khóa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
