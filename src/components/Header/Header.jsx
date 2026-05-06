import { useState } from 'react';
import { ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, Plus, CalendarDays, Lock, Unlock, LayoutDashboard, List, Search, Printer } from 'lucide-react';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { vi } from 'date-fns/locale';

function formatDateLabel(date) {
  if (isToday(date)) return 'Hôm nay';
  if (isYesterday(date)) return 'Hôm qua';
  if (isTomorrow(date)) return 'Ngày mai';
  return format(date, 'dd/MM/yyyy');
}

export function Header({ currentDate, onDateChange, isOnline, onAddNew, onRefresh, totalCases, onOpenCalendar, onOpenHistory, isUnlocked, onToggleLock, searchQuery, onSearchChange, viewMode, onViewModeChange }) {
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

        <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '4px 8px', gap: '6px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Tìm tên, mã BN..." 
            value={searchQuery} 
            onChange={e => onSearchChange(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '120px', fontSize: '12px' }}
          />
        </div>

        {viewMode === 'table' && (
          <button className="icon-btn" onClick={() => window.print()} title="In / Xuất PDF">
            <Printer size={16} />
          </button>
        )}

        <button className="icon-btn" onClick={() => onViewModeChange(viewMode === 'board' ? 'table' : 'board')} title={viewMode === 'board' ? 'Chế độ bảng' : 'Chế độ thẻ'}>
          {viewMode === 'board' ? <List size={16} /> : <LayoutDashboard size={16} />}
        </button>

        <button className="icon-btn" onClick={onToggleLock} title={isUnlocked ? 'Đang mở khóa' : 'Đang khóa (Chỉ xem)'} style={{ color: isUnlocked ? '#10b981' : 'var(--text-muted)' }}>
          {isUnlocked ? <Unlock size={16} /> : <Lock size={16} />}
        </button>

        <button className="icon-btn" onClick={handleRefresh} title="Tải lại">
          <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>

        <button className="icon-btn" onClick={onOpenHistory} title="Lịch sử ca mổ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        </button>

        <button className="icon-btn" onClick={onOpenCalendar} title="Lịch tuần">
          <CalendarDays size={16} />
        </button>

        {isUnlocked && (
          <button className="btn-primary" onClick={() => onAddNew?.()}>
            <Plus size={16} />
            Thêm ca mổ
          </button>
        )}
      </div>
    </header>
  );
}
