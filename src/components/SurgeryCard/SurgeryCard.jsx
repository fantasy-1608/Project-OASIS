/* global chrome */
import { useState, useCallback } from 'react';
import { ChevronRight, CalendarDays, Clock, CheckCircle, Activity, User, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';

const PRIORITY_CONFIG = {
  emergency: { label: 'Cấp cứu', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' },
  urgent:    { label: 'Bán cấp',  color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)' },
  elective:  { label: 'Chương trình', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
};

export function SurgeryCard({ surgery, onEdit, onDelete, onMoveToWaiting, onSchedule, onMarkStatus, provided, isDragging }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const priority = PRIORITY_CONFIG[surgery.priority] || PRIORITY_CONFIG.elective;
  const isEmergency = surgery.priority === 'emergency';
  const isWaiting = surgery.shift === 'waiting';

  const handleEdit = useCallback((e) => { e.stopPropagation(); onEdit?.(surgery); }, [surgery, onEdit]);
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (window.confirm(`Xác nhận xoá ${surgery.patient_name} khỏi bảng dự kiến mổ?`)) onDelete?.(surgery.id);
  }, [surgery, onDelete]);

  const handleMoveToWaiting = useCallback((e) => {
    e.stopPropagation();
    onMoveToWaiting?.(surgery.id);
  }, [surgery.id, onMoveToWaiting]);

  const handleMarkStatus = useCallback((e, status) => {
    e.stopPropagation();
    let msg = '';
    if (status === 'completed') msg = `Xác nhận ${surgery.patient_name} đã mổ xong?`;
    if (status === 'postponed') msg = `Xác nhận HOÃN dự kiến mổ của ${surgery.patient_name}?`;
    if (status === 'cancelled') msg = `Xác nhận HỦY dự kiến mổ của ${surgery.patient_name}?`;
    
    if (window.confirm(msg)) {
      onMarkStatus?.(surgery.id, status);
    }
  }, [surgery.id, surgery.patient_name, onMarkStatus]);

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
      className={`surgery-card surgery-card--${surgery.priority || 'elective'} ${isDragging ? 'surgery-card--dragging' : ''}`}
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
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
        {surgery.gender && <span>{surgery.gender},</span>}
        {(surgery.birth_year || surgery.age) && <span>{surgery.birth_year || surgery.age},</span>}
        <span className="card-pid">Mã BA: {surgery.patient_id}</span>
      </div>

      {/* Diagnosis */}
      <div className="card-diagnosis" title={surgery.diagnosis}>{surgery.diagnosis}</div>

      {/* Info tags: PP Mổ + Ngày nhập viện */}
      {(surgery.surgical_method || surgery.admission_date || surgery.surgeon) && (
        <div className="card-info-tags">
          {surgery.surgical_method && (
            <div className="card-info-tag card-info-tag--method">
              <span className="card-info-tag-icon"><Activity size={12} /></span>
              <span>{surgery.surgical_method}</span>
            </div>
          )}
          {surgery.surgeon && (
            <div className="card-info-tag card-info-tag--date">
              <span className="card-info-tag-icon"><User size={12} /></span>
              <span>PTV: {surgery.surgeon}</span>
            </div>
          )}
          {surgery.admission_date && (
            <div className="card-info-tag card-info-tag--date">
              <span className="card-info-tag-icon"><Calendar size={12} /></span>
              <span>Nhập viện: {surgery.admission_date}</span>
            </div>
          )}
        </div>
      )}

      {/* Expanded: Actions */}
      {isExpanded && onEdit && (
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
              <CalendarDays size={12} /> Xếp dự kiến
            </button>
            {!isWaiting && (
              <button className="card-btn card-btn--done" onClick={(e) => handleMarkStatus(e, 'completed')}>
                <CheckCircle size={12} /> Đã mổ
              </button>
            )}
          </div>
          
          {/* Extra Actions Row */}
          <div className="card-actions-row" style={{ marginTop: '4px' }}>
            <button className="card-btn" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }} onClick={(e) => handleMarkStatus(e, 'postponed')}>⏸️ Hoãn mổ</button>
            <button className="card-btn" style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.1)' }} onClick={(e) => handleMarkStatus(e, 'cancelled')}>🚫 Hủy ca</button>
            <button className="card-btn card-btn--delete" onClick={handleDelete} style={{ marginLeft: 'auto' }}>🗑️ Xóa khỏi bảng</button>
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
