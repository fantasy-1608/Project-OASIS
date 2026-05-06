import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, Plus, CalendarDays } from 'lucide-react';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { vi } from 'date-fns/locale';

function formatDateLabel(date) {
  if (isToday(date)) return 'Hôm nay';
  if (isYesterday(date)) return 'Hôm qua';
  if (isTomorrow(date)) return 'Ngày mai';
  return format(date, 'dd/MM/yyyy');
}

export function Header({ currentDate, onDateChange, isOnline, onAddNew, onRefresh, totalCases, onOpenCalendar }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const goTo = (delta) => {
    const newDate = addDays(currentDate, delta);
    onDateChange(newDate);
  };

  const todayLabel = formatDateLabel(currentDate);
  const weekday = format(currentDate, 'EEEE', { locale: vi });
  const fullDate = format(currentDate, 'dd MMMM yyyy', { locale: vi });

  return (
    <header className="app-header">
      {/* Left: Brand */}
      <div className="header-brand">
        <span className="brand-genie">🧞</span>
        <div>
          <div className="brand-name">Aladinn <span className="brand-oasis">OASIS</span></div>
          <div className="brand-sub">Surgical Scheduling Dashboard</div>
        </div>
      </div>

      {/* Center: Date Navigator */}
      <div className="date-navigator">
        <button className="date-nav-btn" onClick={() => goTo(-1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="date-display">
          <div className="date-label">{todayLabel}</div>
          <div className="date-full">
            <span className="date-weekday">{weekday}</span>,&nbsp;{fullDate}
          </div>
        </div>
        <button className="date-nav-btn" onClick={() => goTo(1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="header-actions">
        {/* Online status */}
        <div className={`connection-badge ${isOnline ? 'connection-badge--online' : 'connection-badge--offline'}`}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{isOnline ? 'Supabase' : 'Demo Mode'}</span>
        </div>

        {/* Cases count */}
        <div className="cases-counter">
          <span className="cases-count-number">{totalCases}</span>
          <span className="cases-count-label">ca</span>
        </div>

        <button className="icon-btn" onClick={handleRefresh} title="Tải lại">
          <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>

        <button className="icon-btn" onClick={onOpenCalendar} title="Lịch tuần">
          <CalendarDays size={16} />
        </button>

        <button className="btn-primary" onClick={() => onAddNew?.()}>
          <Plus size={16} />
          Thêm ca mổ
        </button>
      </div>
    </header>
  );
}
