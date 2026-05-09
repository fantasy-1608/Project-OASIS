/**
 * ============================================================
 * PROJECT OASIS — Component: Conflict Warning
 * ============================================================
 *
 * TRẠNG THÁI: ⏸️  SKELETON — CHƯA KẾT NỐI VÀO APP
 *
 * Khi FEATURES.SCHEDULER_ENGINE = true:
 *   - Hiện trong SurgeryModal khi validation thất bại
 *   - Hiện trước khi confirm drag & drop
 *   - Cho phép "Force schedule" nếu chỉ có warnings (không có errors)
 * ============================================================
 */

import { FEATURES } from '../../lib/featureFlags.js';

// ============================================================
// ConflictWarning — Hiện danh sách xung đột
// ============================================================
/**
 * @param {Object} props
 * @param {Array}  props.errors    - Blocking errors từ engine
 * @param {Array}  props.warnings  - Non-blocking warnings
 * @param {Array}  props.infos     - Informational messages
 * @param {boolean} props.canForce - Có thể force qua không
 * @param {Function} props.onForce - Callback khi user force schedule
 * @param {Function} props.onCancel
 */
export function ConflictWarning({ errors = [], warnings = [], infos = [], canForce, onForce, onCancel }) {
  // Khi engine chưa bật: không hiện gì
  if (!FEATURES.SCHEDULER_ENGINE) return null;

  const hasIssues = errors.length > 0 || warnings.length > 0;
  if (!hasIssues && infos.length === 0) return null;

  return (
    <div className="conflict-warning glass-panel" style={{
      padding: '1rem',
      borderRadius: 10,
      margin: '0.75rem 0',
      border: errors.length > 0
        ? '1px solid rgba(239, 68, 68, 0.4)'
        : '1px solid rgba(212, 162, 90, 0.4)',
    }}>
      {/* Errors — Blocking */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
            🚫 Không thể xếp lịch
          </div>
          {errors.map(e => (
            <div key={e.ruleId} style={{
              background: 'rgba(239, 68, 68, 0.08)',
              borderLeft: '3px solid #ef4444',
              padding: '0.4rem 0.6rem',
              borderRadius: '0 6px 6px 0',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              <strong style={{ color: '#ef4444' }}>{e.ruleName}:</strong> {e.message}
            </div>
          ))}
        </div>
      )}

      {/* Warnings — Non-blocking */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ color: '#d4a25a', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
            ⚠️ Lưu ý trước khi xếp
          </div>
          {warnings.map(w => (
            <div key={w.ruleId} style={{
              background: 'rgba(212, 162, 90, 0.08)',
              borderLeft: '3px solid #d4a25a',
              padding: '0.4rem 0.6rem',
              borderRadius: '0 6px 6px 0',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              <strong style={{ color: '#d4a25a' }}>{w.ruleName}:</strong> {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Infos */}
      {infos.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          {infos.map(i => (
            <div key={i.ruleId} style={{
              background: 'rgba(99, 179, 237, 0.08)',
              borderLeft: '3px solid #63b3ed',
              padding: '0.4rem 0.6rem',
              borderRadius: '0 6px 6px 0',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              ℹ️ {i.message}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {(canForce || errors.length > 0) && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          {onCancel && (
            <button className="btn-secondary" onClick={onCancel} style={{ fontSize: '0.8rem' }}>
              Huỷ
            </button>
          )}
          {canForce && onForce && (
            <button
              className="btn-primary"
              onClick={onForce}
              style={{ fontSize: '0.8rem', background: 'rgba(212, 162, 90, 0.3)' }}
            >
              Xếp lịch dù có cảnh báo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SlotSuggestion — Gợi ý buổi/ngày phù hợp
// ============================================================
/**
 * @param {Object}   props
 * @param {Array}    props.suggestions  - Array từ suggestBestSlot()
 * @param {Function} props.onSelect     - Callback khi user chọn một slot
 */
export function SlotSuggestion({ suggestions = [], onSelect }) {
  if (!FEATURES.SCHEDULER_ENGINE) return null;
  if (suggestions.length === 0) return null;

  return (
    <div style={{
      padding: '0.75rem',
      background: 'rgba(99, 179, 237, 0.06)',
      border: '1px solid rgba(99, 179, 237, 0.2)',
      borderRadius: 10,
      margin: '0.75rem 0',
    }}>
      <div style={{ fontSize: '0.78rem', color: '#63b3ed', fontWeight: 600, marginBottom: '0.5rem' }}>
        💡 Gợi ý buổi phù hợp nhất
      </div>
      {suggestions.map((slot, idx) => (
        <div
          key={`${slot.date}-${slot.shift}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 0.6rem',
            borderRadius: 6,
            marginBottom: '0.25rem',
            cursor: 'pointer',
            background: idx === 0 ? 'rgba(99, 179, 237, 0.1)' : 'transparent',
            transition: 'background 0.15s',
          }}
          onClick={() => onSelect?.(slot)}
        >
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {slot.shift === 'morning' ? '☀️ Ca Sáng' : '🌙 Ca Chiều'} · {slot.date.slice(5)}
            </span>
            {slot.reasons.length > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {slot.reasons.join(' · ')}
              </div>
            )}
          </div>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: slot.score >= 80 ? '#22c55e' : slot.score >= 60 ? '#d4a25a' : '#ef4444',
          }}>
            {slot.score}%
          </div>
        </div>
      ))}
    </div>
  );
}
