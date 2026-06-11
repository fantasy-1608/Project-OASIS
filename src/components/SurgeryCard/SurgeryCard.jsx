/* global chrome */
import { useState, useCallback } from 'react';
import { ChevronRight, CalendarDays, Clock, CheckCircle, Scissors, User, Calendar, Bed } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { evaluateSurgeryReadiness, formatReadinessMissingText } from '../../lib/readiness';

const PRIORITY_CONFIG = {
  emergency: { label: 'Cấp cứu', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' },
  urgent:    { label: 'Bán cấp',  color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)' },
  elective:  { label: 'Chương trình', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
};

export function SurgeryCard({ surgery, onEdit, onDelete, onMoveToWaiting, onSchedule, onMarkStatus, provided, isDragging }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isExtension = typeof chrome !== 'undefined' && window.location.protocol === 'chrome-extension:';
  const priority = PRIORITY_CONFIG[surgery.priority] || PRIORITY_CONFIG.elective;
  const isWaiting = surgery.shift === 'waiting';
  const readiness = evaluateSurgeryReadiness(surgery);
  const readinessMissingText = readiness.status === 'missing' ? formatReadinessMissingText(readiness, 5) : '';
  const demographics = [surgery.gender, surgery.birth_year || surgery.age].filter(Boolean).join(' • ');
  const readinessTitle = readinessMissingText
    ? `${readiness.label}: thiếu ${readinessMissingText}`
    : readiness.label;

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
        const isExtensionContext = typeof chrome !== 'undefined' && window.location.protocol === 'chrome-extension:';
        if (isExtensionContext && chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'OPEN_PATIENT',
                payload: { maBA: surgery.patient_id, hoTen: surgery.patient_name }
              }).catch(() => {});
            }
          });
        }
      }}
    >
      {/* Priority badge + shift info + expand icon */}
      <div className="card-header">
        <div className="card-badge-row">
          <span className="priority-badge" style={{ color: priority.color, background: priority.bg, border: `1px solid ${priority.border}` }}>
            {priority.label}
          </span>
          <span className={`readiness-badge readiness-badge--${readiness.status}`} title={readinessTitle}>
            {readiness.status === 'missing' ? `Thiếu ${readiness.missingItems.length}` : readiness.label}
          </span>
          {!isWaiting && surgery.date && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' }}>
              {format(new Date(surgery.date), 'dd/MM')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isExtension && (
            <button 
              title="Mở bệnh án trên VNPT HIS"
              style={{ 
                background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', padding: '2px 6px', 
                color: '#0ea5e9', fontSize: '10px', fontWeight: '500', cursor: 'pointer', borderRadius: '4px',
                display: 'flex', alignItems: 'center', gap: '4px'
              }} 
              onClick={(e) => {
                e.stopPropagation();
                const isExtensionContext = typeof chrome !== 'undefined' && window.location.protocol === 'chrome-extension:';
                if (isExtensionContext && chrome.tabs) {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs && tabs.length > 0) {
                      chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'OPEN_PATIENT',
                        payload: { maBA: surgery.patient_id, hoTen: surgery.patient_name }
                      }).catch(() => {});
                    }
                  });
                }
              }}
            >
              🏥 HIS
            </button>
          )}
          <ChevronRight size={13} className={`expand-icon ${isExpanded ? 'expand-icon--open' : ''}`} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Patient name */}
      <div className="card-patient-name">{surgery.patient_name}</div>
      <div className="card-patient-meta">
        {demographics && <span>{demographics}</span>}
        <span className="card-pid">Mã BA: {surgery.patient_id}</span>
      </div>

      {/* Diagnosis */}
      <div className="card-diagnosis" title={surgery.diagnosis}>{surgery.diagnosis}</div>

      {/* Info tags: PP Mổ + Ngày nhập viện */}
      {(surgery.surgical_method || surgery.admission_date || surgery.surgeon) && (
        <div className="card-info-tags">
          {surgery.surgical_method && (
            <div className="card-info-tag card-info-tag--method">
              <span className="card-info-tag-icon"><Scissors size={12} /></span>
              <span>{surgery.surgical_method}</span>
            </div>
          )}
          {surgery.room && (
            <div className="card-info-tag card-info-tag--room">
              <span className="card-info-tag-icon"><Bed size={12} /></span>
              <span>Buồng: {surgery.room}</span>
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
          <div className={`card-readiness-detail card-readiness-detail--${readiness.status}`}>
            <div className="card-readiness-top">
              <span className="card-readiness-title">{readiness.label}</span>
              <span className="card-readiness-count">{readiness.completedRequired}/{readiness.totalRequired}</span>
            </div>
            {readinessMissingText && (
              <div className="card-readiness-missing">Thiếu: {readinessMissingText}</div>
            )}
            {!readinessMissingText && readiness.status === 'ready' && (
              <div className="card-readiness-missing card-readiness-missing--muted">Đã kiểm đủ hồ sơ trước mổ</div>
            )}
          </div>

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
