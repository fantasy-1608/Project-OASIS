import React, { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  if (!isOpen) return null;

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

  const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <div className="cal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-panel glass-panel">
        {/* Header */}
        <div className="cal-header">
          <div className="cal-title-group">
            <span className="cal-title-icon">📅</span>
            <div>
              <div className="cal-title">Lịch mổ tuần này</div>
              <div className="cal-subtitle">
                {format(weekStart, 'dd/MM', { locale: vi })} – {format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: vi })}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
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
                onClick={() => onSelectDate(day)}
              >
                {/* Day header */}
                <div className="cal-day-header">
                  <span className="cal-day-name">{DAY_NAMES[i]}</span>
                  <span className="cal-day-num">{format(day, 'dd')}</span>
                  {isTodayDay && <span className="cal-today-dot" />}
                </div>

                {/* Total badge */}
                {daySurgeries.length > 0 && (
                  <div className="cal-total-row">
                    <span className="cal-total-badge">{daySurgeries.length} ca</span>
                    {emergencyCount > 0 && (
                      <span className="cal-emergency-badge">🚨{emergencyCount}</span>
                    )}
                  </div>
                )}

                {/* Shift breakdown */}
                {morningCases.length > 0 && (
                  <div className="cal-shift-block cal-shift--morning">
                    <span className="cal-shift-label">🌅 {morningCases.length}</span>
                    <div className="cal-mini-list">
                      {morningCases.slice(0, 3).map(s => (
                        <div key={s.id} className="cal-mini-item">
                          <span className="cal-mini-dot" style={{ background: PRIORITY_DOT[s.priority] }} />
                          <span className="cal-mini-name">{s.patient_name}</span>
                        </div>
                      ))}
                      {morningCases.length > 3 && (
                        <div className="cal-mini-more">+{morningCases.length - 3} khác</div>
                      )}
                    </div>
                  </div>
                )}

                {afternoonCases.length > 0 && (
                  <div className="cal-shift-block cal-shift--afternoon">
                    <span className="cal-shift-label">🌆 {afternoonCases.length}</span>
                    <div className="cal-mini-list">
                      {afternoonCases.slice(0, 3).map(s => (
                        <div key={s.id} className="cal-mini-item">
                          <span className="cal-mini-dot" style={{ background: PRIORITY_DOT[s.priority] }} />
                          <span className="cal-mini-name">{s.patient_name}</span>
                        </div>
                      ))}
                      {afternoonCases.length > 3 && (
                        <div className="cal-mini-more">+{afternoonCases.length - 3} khác</div>
                      )}
                    </div>
                  </div>
                )}

                {waitingCases.length > 0 && (
                  <div className="cal-waiting-count">
                    📋 {waitingCases.length} chờ
                  </div>
                )}

                {daySurgeries.length === 0 && (
                  <div className="cal-empty-label">Trống</div>
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
          <span className="cal-legend-hint">Nhấn vào ngày để xem chi tiết</span>
        </div>
      </div>
    </div>
  );
}
