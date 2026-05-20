

const formatDate = (dateStr) => {
  if (!dateStr) return '---';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function TableView({ boardState }) {
  // Aggregate tasks from morning and afternoon
  const morningTasks = (boardState.columns['morning']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);
  const afternoonTasks = (boardState.columns['afternoon']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);
  const allTasks = [...morningTasks, ...afternoonTasks];

  if (allTasks.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Không có dự kiến mổ nào trong ngày.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg-primary)' }}>
      <div className="glass-panel" style={{ padding: '1px', overflowX: 'auto' }}>
        <div className="print-title">DANH SÁCH DỰ KIẾN MỔ</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Buổi</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Ngày mổ</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Ưu tiên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Mã bệnh nhân</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Họ và tên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Chẩn đoán / PT Dự kiến</th>
            </tr>
          </thead>
          <tbody>
            {allTasks.map((task) => {
              const isMorning = task.shift === 'morning';
              const shiftLabel = isMorning ? 'Sáng' : 'Chiều';
              const priorityColor = task.priority === 'emergency' ? 'var(--error)' : task.priority === 'urgent' ? '#f59e0b' : 'var(--text-muted)';
              const priorityLabel = task.priority === 'emergency' ? 'Cấp cứu' : task.priority === 'urgent' ? 'Bán cấp' : 'Chương trình';
              
              return (
                <tr key={task.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                  <td style={{ padding: '12px 16px', color: isMorning ? '#f59e0b' : '#d4a25a', fontWeight: 'bold' }}>{shiftLabel}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{formatDate(task.date)}</td>
                  <td style={{ padding: '12px 16px', color: priorityColor }}>{priorityLabel}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{task.patient_id || '---'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{task.patient_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{task.diagnosis}</div>
                    <div style={{ color: 'var(--accent-muted)', fontSize: '11px' }}>{task.surgical_method}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
