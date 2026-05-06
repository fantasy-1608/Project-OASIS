import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { X, RotateCcw, Trash2, History } from 'lucide-react';

export function HistoryModal({ isOpen, onClose, surgeries, onRestore, onDelete }) {
  if (!isOpen) return null;

  const completed = useMemo(() => {
    return (surgeries || [])
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [surgeries]);

  return (
    <div className="cal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-panel glass-panel" style={{ maxWidth: '600px' }}>
        <div className="cal-header">
          <div className="cal-title-group">
            <span className="cal-title-icon"><History size={24} color="var(--accent-primary)" /></span>
            <div>
              <div className="cal-title">Lịch sử ca mổ</div>
              <div className="cal-subtitle">Danh sách các ca đã mổ xong</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="history-list" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {completed.length === 0 ? (
            <div className="shift-empty" style={{ margin: 'auto', opacity: 0.5 }}>Chưa có ca mổ nào được hoàn thành.</div>
          ) : (
            completed.map(s => (
              <div key={s.id} className="history-item glass-panel" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>{s.patient_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    📅 {s.date} • {s.shift === 'morning' ? 'Ca Sáng' : s.shift === 'afternoon' ? 'Ca Chiều' : 'Chờ'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    🔪 {s.surgical_method || s.diagnosis}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => onRestore(s.id)}>
                    <RotateCcw size={14} /> Khôi phục
                  </button>
                  <button className="card-btn card-btn--delete" style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => {
                    if (window.confirm(`Xóa vĩnh viễn ca mổ của ${s.patient_name}?`)) onDelete(s.id);
                  }}>
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
