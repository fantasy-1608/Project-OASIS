
import { useMemo } from 'react';

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
  const allTasks = useMemo(() => {
    const morningTasks = (boardState.columns['morning']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);
    const afternoonTasks = (boardState.columns['afternoon']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);
    return [...morningTasks, ...afternoonTasks];
  }, [boardState.columns, boardState.tasks]);

  // Sort tasks: Date ascending -> Shift (morning then afternoon) -> order_in_shift
  const sortedTasks = useMemo(() => {
    return [...allTasks].sort((a, b) => {
      // Sort by date (ascending)
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      
      // Sort by shift (morning first, then afternoon, then others)
      const shiftOrder = { morning: 1, afternoon: 2 };
      const valA = shiftOrder[a.shift] || 99;
      const valB = shiftOrder[b.shift] || 99;
      if (valA !== valB) {
        return valA - valB;
      }
      
      // Sort by order_in_shift (ascending)
      const orderA = a.order_in_shift || 999;
      const orderB = b.order_in_shift || 999;
      return orderA - orderB;
    });
  }, [allTasks]);

  // Compute row spans for grouped Date and Shift cells
  const rowSpans = useMemo(() => {
    const spans = [];
    let i = 0;
    while (i < sortedTasks.length) {
      const currentDateVal = sortedTasks[i].date;
      
      // Find how many rows share this date
      let j = i;
      while (j < sortedTasks.length && sortedTasks[j].date === currentDateVal) {
        j++;
      }
      const dateCount = j - i;
      
      // Within this date group, find shift groups
      let k = i;
      while (k < j) {
        const currentShiftVal = sortedTasks[k].shift;
        let l = k;
        while (l < j && sortedTasks[l].shift === currentShiftVal) {
          l++;
        }
        const shiftCount = l - k;
        
        for (let m = k; m < l; m++) {
          spans[m] = {
            dateSpan: m === i ? dateCount : 0,
            shiftSpan: m === k ? shiftCount : 0
          };
        }
        
        k = l;
      }
      
      i = j;
    }
    return spans;
  }, [sortedTasks]);

  if (allTasks.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Không có dự kiến mổ nào trong ngày.
      </div>
    );
  }

  return (
    <div className="table-view-container" style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg-primary)' }}>
      <div className="glass-panel" style={{ padding: '1px', overflowX: 'auto' }}>
        <div className="print-title">DANH SÁCH DỰ KIẾN MỔ</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>Ngày mổ</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>Buổi</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>Ưu tiên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>Mã bệnh nhân</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>Họ và tên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>Chẩn đoán / PT Dự kiến</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task, idx) => {
              const spans = rowSpans[idx] || { dateSpan: 1, shiftSpan: 1 };
              const isMorning = task.shift === 'morning';
              const shiftLabel = isMorning ? 'Sáng' : 'Chiều';
              const priorityColor = task.priority === 'emergency' ? 'var(--error)' : task.priority === 'urgent' ? '#f59e0b' : 'var(--text-muted)';
              const priorityLabel = task.priority === 'emergency' ? 'Cấp cứu' : task.priority === 'urgent' ? 'Bán cấp' : 'Chương trình';
              
              return (
                <tr key={task.id} style={{ background: 'var(--bg-card)' }}>
                  {/* Ngày mổ (Grouped) */}
                  {spans.dateSpan > 0 && (
                    <td
                      rowSpan={spans.dateSpan}
                      style={{
                        padding: '12px 16px',
                        color: 'var(--text-primary)',
                        fontWeight: 'bold',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRight: '1px solid var(--border-subtle)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      {formatDate(task.date)}
                    </td>
                  )}

                  {/* Buổi (Grouped) */}
                  {spans.shiftSpan > 0 && (
                    <td
                      rowSpan={spans.shiftSpan}
                      style={{
                        padding: '12px 16px',
                        color: isMorning ? '#f59e0b' : '#d4a25a',
                        fontWeight: 'bold',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        background: 'rgba(255, 255, 255, 0.01)',
                        borderRight: '1px solid var(--border-subtle)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      {shiftLabel}
                    </td>
                  )}

                  {/* Ưu tiên */}
                  <td style={{ padding: '12px 16px', color: priorityColor, borderBottom: '1px solid var(--border-subtle)' }}>
                    {priorityLabel}
                  </td>

                  {/* Mã bệnh nhân */}
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', borderBottom: '1px solid var(--border-subtle)' }}>
                    {task.patient_id || '---'}
                  </td>

                  {/* Họ và tên */}
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {task.patient_name}
                  </td>

                  {/* Chẩn đoán / PT Dự kiến */}
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
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

