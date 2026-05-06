/* global chrome */
import { useState, useCallback } from 'react';
import { ChevronRight, CalendarDays, Clock } from 'lucide-react';
import { format, addDays } from 'date-fns';

const PRIORITY_CONFIG = {
  emergency: { label: 'Cấp cứu', color: 'var(--error)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  urgent:    { label: 'Bán cấp',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  elective:  { label: 'Chương trình', color: 'var(--accent-muted)', bg: 'rgba(161,135,100,0.12)', border: 'rgba(161,135,100,0.3)' },
};

const SHIFT_LABELS = { morning: '🌅 Ca Sáng', afternoon: '🌆 Ca Chiều', waiting: '🕐 Chờ' };

export function SurgeryCard({ surgery, index, onEdit, onDelete, onMoveToWaiting, onSchedule, provided, isDragging }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const priority = PRIORITY_CONFIG[surgery.priority] || PRIORITY_CONFIG.elective;
  const isEmergency = surgery.priority === 'emergency';
  const isWaiting = surgery.shift === 'waiting';

  const handleEdit = useCallback((e) => { e.stopPropagation(); onEdit?.(surgery); }, [surgery, onEdit]);
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (window.confirm(`Xác nhận xoá ca mổ của ${surgery.patient_name}?`)) onDelete?.(surgery.id);
  }, [surgery, onDelete]);

  const handleMoveToWaiting = useCallback((e) => {
    e.stopPropagation();
    onMoveToWaiting?.(surgery.id);
  }, [surgery.id, onMoveToWaiting]);

  const handleSchedule = useCallback((e, shift, date) => {
    e.stopPropagation();
    onSchedule?.(surgery.id, shift, date);
    setShowDatePicker(false);
  }, [surgery.id, onSchedule]);

  const toggleDatePicker = useCallback((e) => {
    e.stopPropagation();
    setShowDatePicker(v => !v);
  }, []);

  // Tạo 5 ngày nhanh
  const today = new Date();
  const quickDates = [0, 1, 2, 3, 4].map(d => {
    const date = addDays(today, d);
    return { value: format(date, 'yyyy-MM-dd'), label: format(date, 'dd/MM') };
  });

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      className={`surgery-card ${isEmergency ? 'surgery-card--emergency' : ''} ${isDragging ? 'surgery-card--dragging' : ''}`}
      style={provided?.draggableProps?.style}
      onClick={() => setIsExpanded(v => !v)}
      onDoubleClick={() => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query({ url: '*://*.vncare.vn/*' }, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                type: 'OPEN_PATIENT',
                payload: { maBA: surgery.patient_id }
              }).catch(() => {});
            });
          });
        }
      }}
    >
      {isEmergency && <div className="card-emergency-bar" />}

      {/* Priority badge + shift info + expand icon */}
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="priority-badge" style={{ color: priority.color, background: priority.bg, border: `1px solid ${priority.border}` }}>
            {priority.label}
          </span>
          {!isWaiting && surgery.date && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' }}>
              {format(new Date(surgery.date), 'dd/MM')}
            </span>
          )}
        </div>
        <ChevronRight size={13} className={`expand-icon ${isExpanded ? 'expand-icon--open' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* Patient name */}
      <div className="card-patient-name">{surgery.patient_name}</div>

      {/* Diagnosis */}
      <div className="card-diagnosis">{surgery.diagnosis}</div>

      {/* Info tags: PP Mổ + Ngày nhập viện */}
      {(surgery.surgical_method || surgery.admission_date) && (
        <div className="card-info-tags">
          {surgery.surgical_method && (
            <div className="card-info-tag card-info-tag--method">
              <span className="card-info-tag-icon">🔪</span>
              <span>{surgery.surgical_method}</span>
            </div>
          )}
          {surgery.admission_date && (
            <div className="card-info-tag card-info-tag--date">
              <span className="card-info-tag-icon">🏥</span>
              <span>Nhập viện: {surgery.admission_date}</span>
            </div>
          )}
        </div>
      )}

      {/* Expanded: Actions */}
      {isExpanded && (
        <div className="card-expanded-actions">
          {/* Quick action buttons */}
          <div className="card-actions-row">
            <button className="card-btn card-btn--edit" onClick={handleEdit}>✏️ Sửa</button>
            {!isWaiting && (
              <button className="card-btn card-btn--waiting" onClick={handleMoveToWaiting}>
                <Clock size={12} /> Trả về chờ
              </button>
            )}
            <button className="card-btn card-btn--schedule" onClick={toggleDatePicker}>
              <CalendarDays size={12} /> Xếp lịch
            </button>
            <button className="card-btn card-btn--delete" onClick={handleDelete}>🗑️</button>
          </div>

          {/* Date picker dropdown */}
          {showDatePicker && (
            <div className="card-date-picker" onClick={e => e.stopPropagation()}>
              <div className="card-date-label">Chọn ngày & ca:</div>
              <div className="card-date-grid">
                {quickDates.map(d => (
                  <div key={d.value} className="card-date-col">
                    <span className="card-date-day">{d.label}</span>
                    <button className="card-date-shift card-date-shift--morning" onClick={e => handleSchedule(e, 'morning', d.value)}>Sáng</button>
                    <button className="card-date-shift card-date-shift--afternoon" onClick={e => handleSchedule(e, 'afternoon', d.value)}>Chiều</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
