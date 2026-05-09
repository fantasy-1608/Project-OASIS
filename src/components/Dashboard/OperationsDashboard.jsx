/**
 * ============================================================
 * PROJECT OASIS — Component: Operations Dashboard
 * ============================================================
 * TRẠNG THÁI: ⏸️  SKELETON — CHƯA KẾT NỐI VÀO APP
 *
 * Khi FEATURES.OPERATIONS_DASHBOARD = true:
 *   - Render panel dashboard tổng quan bên phải màn hình
 *   - Metrics: tổng ca, ca cấp cứu, tải buổi, readiness, tải bác sĩ
 *
 * Cách kết nối vào App.jsx:
 *   1. Bật FEATURES.OPERATIONS_DASHBOARD = true
 *   2. Thêm state: const [showDashboard, setShowDashboard] = useState(false)
 *   3. Truyền onOpenDashboard={() => setShowDashboard(true)} vào Header
 *   4. Render: <OperationsDashboard isOpen={showDashboard} onClose={...} surgeries={surgeries} boardState={boardState} currentDate={dateStr} />
 * ============================================================
 */

import { useMemo } from 'react';
import { FEATURES } from '../../lib/featureFlags.js';

export function OperationsDashboard({ isOpen, onClose, surgeries = [], boardState, currentDate }) {
  if (!FEATURES.OPERATIONS_DASHBOARD || !isOpen) return null;
  return <DashboardPanel surgeries={surgeries} boardState={boardState} currentDate={currentDate} onClose={onClose} />;
}

function DashboardPanel({ surgeries, currentDate, onClose }) {
  const metrics = useMemo(() => {
    const todaySurgeries = surgeries.filter(s => s.date === currentDate);
    const scheduled = todaySurgeries.filter(s => s.status === 'scheduled');
    const morning = scheduled.filter(s => s.shift === 'morning');
    const afternoon = scheduled.filter(s => s.shift === 'afternoon');
    const waiting = scheduled.filter(s => s.shift === 'waiting');
    const emergency = scheduled.filter(s => s.priority === 'emergency');
    const completed = todaySurgeries.filter(s => s.status === 'completed');
    const postponed = todaySurgeries.filter(s => s.status === 'postponed');

    const readyCount = scheduled.filter(s =>
      s.ready_labs && s.ready_imaging && s.ready_consent &&
      s.ready_fasting && s.ready_antibiotics && s.ready_insurance
    ).length;

    const surgeonLoad = {};
    scheduled.forEach(s => {
      if (s.surgeon_id) {
        if (!surgeonLoad[s.surgeon_id]) surgeonLoad[s.surgeon_id] = { name: s.surgeon_id, count: 0 };
        surgeonLoad[s.surgeon_id].count += 1;
      }
    });

    return { total: scheduled.length, morning: morning.length, afternoon: afternoon.length, waiting: waiting.length, emergency: emergency.length, completed: completed.length, postponed: postponed.length, readyCount, notReadyCount: scheduled.length - readyCount, surgeonLoad: Object.values(surgeonLoad) };
  }, [surgeries, currentDate]);

  const cardStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,162,90,0.15)', borderRadius: 10, padding: '0.75rem 1rem' };
  const pct = metrics.total > 0 ? (metrics.readyCount / metrics.total) * 100 : 0;

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 300, height: '100vh', background: 'rgba(15,10,5,0.95)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(212,162,90,0.2)', zIndex: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(212,162,90,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>📊 Dashboard Vận Hành</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{currentDate}</div>
        </div>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng quan hôm nay</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[['Tổng ca', metrics.total, '#d4a25a'], ['Cấp cứu', metrics.emergency, '#ef4444'], ['Ca Sáng', metrics.morning, '#86efac'], ['Ca Chiều', metrics.afternoon, '#93c5fd'], ['Chờ', metrics.waiting, '#fbbf24'], ['Đã mổ', metrics.completed, '#22c55e']].map(([label, value, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Readiness Bệnh Nhân</div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 50 ? '#d4a25a' : '#ef4444', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginTop: '0.4rem' }}>
            <span style={{ color: '#22c55e' }}>✅ Đủ: {metrics.readyCount}</span>
            <span style={{ color: '#ef4444' }}>⚠️ Chưa: {metrics.notReadyCount}</span>
          </div>
          {!FEATURES.NORMALIZED_SCHEMA && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>* Cần NORMALIZED_SCHEMA để chính xác</div>}
        </div>
        {metrics.surgeonLoad.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tải Theo Bác Sĩ</div>
            {metrics.surgeonLoad.map(sl => (
              <div key={sl.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{sl.name}</span>
                <span style={{ color: '#d4a25a', fontWeight: 600 }}>{sl.count} ca</span>
              </div>
            ))}
          </div>
        )}
        {metrics.postponed > 0 && (
          <div style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>⏸️ Hoãn hôm nay: {metrics.postponed} ca</div>
          </div>
        )}
        <div style={{ fontSize: '0.65rem', color: 'rgba(212,162,90,0.4)', textAlign: 'center', padding: '0.5rem', borderTop: '1px solid rgba(212,162,90,0.1)', marginTop: 'auto' }}>
          FEATURES.OPERATIONS_DASHBOARD = true
        </div>
      </div>
    </div>
  );
}
