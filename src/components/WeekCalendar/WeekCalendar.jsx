import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { X, Calendar, AlertTriangle, Zap, Clock, ClipboardList } from 'lucide-react';

const PRIORITY_DOT = {
  emergency: '#ef4444',
  urgent:    '#f59e0b',
  elective:  '#a18764',
};

const PRIORITY_LABEL = {
  emergency: 'Cấp cứu',
  urgent:    'Bán cấp',
  elective:  'CT',
};

export function WeekCalendar({ isOpen, onClose, currentDate, onSelectDate, allSurgeries }) {
  // Week start = Monday
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group surgeries by date
  const byDate = useMemo(() => {
    const map = {};
    (allSurgeries || []).forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [allSurgeries]);

  // Calculate comprehensive weekly stats for the dashboard
  const weeklyStats = useMemo(() => {
    let total = 0;
    let emergency = 0;
    let urgent = 0;
    let elective = 0;
    let waiting = 0;

    const weekDates = new Set(days.map(d => format(d, 'yyyy-MM-dd')));

    (allSurgeries || []).forEach(s => {
      if (weekDates.has(s.date)) {
        total++;
        if (s.priority === 'emergency') emergency++;
        else if (s.priority === 'urgent') urgent++;
        else elective++;

        if (s.shift === 'waiting') waiting++;
      }
    });

    return { total, emergency, urgent, elective, waiting };
  }, [allSurgeries, days]);

  if (!isOpen) return null;

  const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  return (
    <div className="cal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-panel glass-panel">
        {/* Header */}
        <div className="cal-header">
          <div className="cal-title-group">
            <span className="cal-title-icon">📅</span>
            <div>
              <div className="cal-title">Dự kiến mổ tuần này</div>
              <div className="cal-subtitle">
                Tuần từ {format(weekStart, 'dd/MM', { locale: vi })} đến {format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: vi })}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Weekly Stats Dashboard */}
        <div className="cal-summary-dashboard">
          <div className="cal-stat-widget cal-stat-widget--total">
            <div className="cal-stat-icon-wrapper">
              <Calendar size={18} />
            </div>
            <div className="cal-stat-info">
              <span className="cal-stat-value">{weeklyStats.total} ca</span>
              <span className="cal-stat-label">Tổng ca mổ tuần</span>
            </div>
          </div>

          <div className="cal-stat-widget cal-stat-widget--emergency">
            <div className="cal-stat-icon-wrapper">
              <AlertTriangle size={18} />
            </div>
            <div className="cal-stat-info">
              <span className="cal-stat-value">{weeklyStats.emergency} ca</span>
              <span className="cal-stat-label">Cấp cứu khẩn cấp</span>
            </div>
          </div>

          <div className="cal-stat-widget cal-stat-widget--urgent">
            <div className="cal-stat-icon-wrapper">
              <Zap size={18} />
            </div>
            <div className="cal-stat-info">
              <span className="cal-stat-value">{weeklyStats.urgent} ca</span>
              <span className="cal-stat-label">Bán cấp ưu tiên</span>
            </div>
          </div>

          <div className="cal-stat-widget cal-stat-widget--waiting">
            <div className="cal-stat-icon-wrapper">
              <Clock size={18} />
            </div>
            <div className="cal-stat-info">
              <span className="cal-stat-value">{weeklyStats.waiting} ca</span>
              <span className="cal-stat-label">Chờ xếp phòng mổ</span>
            </div>
          </div>
        </div>

        {/* Week grid */}
        <div className="cal-grid">
          {days.map((day, i) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySurgeries = byDate[dateKey] || [];
            const isSelected = isSameDay(day, currentDate);
            const isTodayDay = isToday(day);
            
            const morningCases   = daySurgeries.filter(s => s.shift === 'morning');
            const afternoonCases = daySurgeries.filter(s => s.shift === 'afternoon');
            const waitingCases   = daySurgeries.filter(s => s.shift === 'waiting');
            const emergencyCount = daySurgeries.filter(s => s.priority === 'emergency').length;

            return (
              <div
                key={dateKey}
                className={`cal-day-cell ${isSelected ? 'cal-day--selected' : ''} ${isTodayDay ? 'cal-day--today' : ''} ${daySurgeries.length === 0 ? 'cal-day--empty' : ''}`}
                onClick={() => {
                  onSelectDate(day);
                  onClose();
                }}
              >
                {/* Day header */}
                <div className="cal-day-header">
                  <span className="cal-day-name">{DAY_NAMES[i]}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {emergencyCount > 0 && (
                      <span className="cal-day-alert-dot" title={`Có ${emergencyCount} ca cấp cứu`} />
                    )}
                    <span className="cal-day-num">{format(day, 'dd')}</span>
                  </div>
                </div>

                {/* Case counts indicator */}
                {daySurgeries.length > 0 && (
                  <div className="cal-total-row">
                    <span className="cal-total-badge">{daySurgeries.length} ca dự kiến</span>
                  </div>
                )}

                {/* Scrollable list inside the cell */}
                <div className="cal-day-scroll-container">
                  {/* Shift breakdown - Morning */}
                  {morningCases.length > 0 && (
                    <div className="cal-shift-group">
                      <div className="cal-shift-header">🌅 Sáng ({morningCases.length})</div>
                      <div className="cal-mini-list">
                        {morningCases.map(s => {
                          const priorityColor = PRIORITY_DOT[s.priority] || 'var(--text-muted)';
                          return (
                            <div key={s.id} className="cal-case-micro-card" style={{ borderLeft: `3px solid ${priorityColor}` }}>
                              <div className="cal-case-top">
                                <span className="cal-case-name">{s.patient_name}</span>
                                {s.room && <span className="cal-case-room">P.{s.room}</span>}
                              </div>
                              {s.surgical_method && (
                                <div className="cal-case-method" title={s.surgical_method}>{s.surgical_method}</div>
                              )}
                              {s.surgeon && (
                                <div className="cal-case-surgeon">PTV: {s.surgeon}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Shift breakdown - Afternoon */}
                  {afternoonCases.length > 0 && (
                    <div className="cal-shift-group">
                      <div className="cal-shift-header">🌆 Chiều ({afternoonCases.length})</div>
                      <div className="cal-mini-list">
                        {afternoonCases.map(s => {
                          const priorityColor = PRIORITY_DOT[s.priority] || 'var(--text-muted)';
                          return (
                            <div key={s.id} className="cal-case-micro-card" style={{ borderLeft: `3px solid ${priorityColor}` }}>
                              <div className="cal-case-top">
                                <span className="cal-case-name">{s.patient_name}</span>
                                {s.room && <span className="cal-case-room">P.{s.room}</span>}
                              </div>
                              {s.surgical_method && (
                                <div className="cal-case-method" title={s.surgical_method}>{s.surgical_method}</div>
                              )}
                              {s.surgeon && (
                                <div className="cal-case-surgeon">PTV: {s.surgeon}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Shift breakdown - Waiting */}
                  {waitingCases.length > 0 && (
                    <div className="cal-shift-group">
                      <div className="cal-shift-header" style={{ color: 'var(--text-muted)' }}>📋 Chờ ({waitingCases.length})</div>
                      <div className="cal-mini-list">
                        {waitingCases.map(s => {
                          const priorityColor = PRIORITY_DOT[s.priority] || 'var(--text-muted)';
                          return (
                            <div key={s.id} className="cal-case-micro-card cal-case-micro-card--waiting" style={{ borderLeft: `3px solid ${priorityColor}` }}>
                              <div className="cal-case-top">
                                <span className="cal-case-name">{s.patient_name}</span>
                              </div>
                              {s.surgical_method && (
                                <div className="cal-case-method" title={s.surgical_method}>{s.surgical_method}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {daySurgeries.length === 0 && (
                  <div className="cal-day-empty-state">
                    <ClipboardList size={18} className="cal-empty-icon" />
                    <span>Trống</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="cal-legend">
          {Object.entries(PRIORITY_DOT).map(([k, color]) => (
            <span key={k} className="cal-legend-item">
              <span className="cal-mini-dot" style={{ background: color }} />
              {PRIORITY_LABEL[k]}
            </span>
          ))}
          <span className="cal-legend-hint">Nhấp vào ngày bất kỳ để chuyển nhanh lịch làm việc</span>
        </div>
      </div>
    </div>
  );
}
