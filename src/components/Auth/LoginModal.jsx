/**
 * ============================================================
 * PROJECT OASIS — Component: LoginModal
 * ============================================================
 *
 * Phase 2 — Kích hoạt Supabase Auth
 *
 * Khi FEATURES.AUTH_ENABLED = true:
 *   - Modal đăng nhập bằng email/password qua Supabase Auth
 *   - Sau đăng nhập: role được load từ bảng user_profiles
 *
 * Khi FEATURES.AUTH_ENABLED = false:
 *   - Hiện thông báo tính năng chưa được kích hoạt
 * ============================================================
 */

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isEnabled } from '../../lib/featureFlags';

// ============================================================
// LoginModal — Modal đăng nhập
// ============================================================
export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const authEnabled = isEnabled('AUTH_ENABLED');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authEnabled) {
      setError('AUTH_ENABLED = false. Tính năng này chưa được kích hoạt.');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: authError } = await signIn(email, password);
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Email hoặc mật khẩu không đúng'
        : authError.message
      );
      setIsLoading(false);
      return;
    }

    onLoginSuccess?.();
    onClose();
    setIsLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container glass-panel"
        style={{ maxWidth: 400 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title" style={{ fontSize: '1.1rem' }}>
            🏥 Đăng Nhập OASIS
          </h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Status badge — chỉ hiện khi AUTH chưa bật */}
          {!authEnabled && (
            <div style={{
              background: 'rgba(212, 162, 90, 0.12)',
              border: '1px solid rgba(212, 162, 90, 0.3)',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              color: '#d4a25a',
              textAlign: 'center',
            }}>
              ⏸️ Chưa kích hoạt — Bật FEATURES.AUTH_ENABLED = true để sử dụng
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="bacsi@bvctch.vn"
              disabled={!authEnabled}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!authEnabled}
              required
            />
          </div>

          {error && (
            <div style={{
              color: '#ef4444',
              fontSize: '0.8rem',
              padding: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 6,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !authEnabled}
            style={{ width: '100%' }}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        {/* Role info */}
        <div style={{
          padding: '0 1.25rem 1.25rem',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <strong>Phân quyền:</strong> Admin · Scheduler · Nurse · Viewer
          <br />
          Liên hệ admin OASIS để được cấp tài khoản.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RoleGuard — HOC kiểm tra quyền trước khi render
// ============================================================
/**
 * Bọc component cần quyền truy cập.
 * Nếu user không đủ quyền: render fallback hoặc null.
 *
 * Usage:
 *   <RoleGuard permission="canDelete" fallback={<span>Không có quyền</span>}>
 *     <DeleteButton />
 *   </RoleGuard>
 *
 * Khi AUTH_ENABLED = false: luôn render children (no-op guard)
 */
export function RoleGuard({ permission, children, fallback = null }) {
  const { can } = useAuth();

  // Khi AUTH chưa bật: cho qua tất cả
  if (!isEnabled('AUTH_ENABLED')) return children;

  // Kiểm tra quyền
  if (permission && !can(permission)) return fallback;

  return children;
}
