import { useState } from 'react';
import { ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, Plus, CalendarDays, Lock, Unlock, LayoutDashboard, List, Search, Printer, MoreHorizontal } from 'lucide-react';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { vi } from 'date-fns/locale';

function formatDateLabel(date) {
  if (isToday(date)) return 'Hôm nay';
  if (isYesterday(date)) return 'Hôm qua';
  if (isTomorrow(date)) return 'Ngày mai';
  return format(date, 'dd/MM/yyyy');
}

import { isEnabled } from '../../lib/featureFlags';

export function Header({ 
  currentDate, 
  onDateChange, 
  isOnline, 
  onAddNew, 
  onRefresh, 
  totalCases, 
  currentDayCases = totalCases,
  weekCases = totalCases,
  onOpenCalendar, 
  onOpenHistory, 
  isUnlocked, 
  onToggleLock, 
  searchQuery, 
  onSearchChange, 
  viewMode, 
  onViewModeChange,
  user,
  role,
  displayName,
  isAuthenticated
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const counterLabel = currentDayCases === 1 ? 'ca ngày này' : 'ca ngày này';
  const weekLabel = weekCases === 1 ? '1 ca tuần' : `${weekCases} ca tuần`;

  // Map Vietnamese role name for display
  const getRoleLabel = (r) => {
    const maps = {
      admin: 'Quản trị viên',
      scheduler: 'Điều phối viên',
      nurse: 'Điều dưỡng',
      viewer: 'Chỉ xem'
    };
    return maps[r] || r;
  };

  return (
    <header className="app-header">
      {/* Left: Brand */}
      <div className="header-brand">
        <span className="brand-genie">🧞</span>
        <div>
          <div className="brand-name">Aladinn <span className="brand-oasis">OASIS</span></div>
          <div className="brand-sub">Bảng dự kiến mổ nội bộ</div>
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
          <span>{isOnline ? 'Dữ liệu khoa' : 'Demo'}</span>
        </div>

        <div className="cases-counter" title={`${currentDayCases} ca trong ngày đang xem, ${weekCases} ca trong tuần`}>
          <span className="cases-count-number">{currentDayCases}</span>
          <span className="cases-count-label">{counterLabel}</span>
          <span className="cases-count-week">{weekLabel}</span>
        </div>

        <div className="search-box">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Tìm tên, mã BN..." 
            value={searchQuery} 
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <button className="icon-btn" onClick={() => onViewModeChange(viewMode === 'board' ? 'table' : 'board')} title={viewMode === 'board' ? 'Chế độ bảng' : 'Chế độ thẻ'}>
          {viewMode === 'board' ? <List size={16} /> : <LayoutDashboard size={16} />}
        </button>

        {/* User Profile Badge (Auth Mode Only) */}
        {isEnabled('AUTH_ENABLED') && isAuthenticated && user && (
          <div className="user-profile-badge" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(255, 255, 255, 0.06)', 
            padding: '3px 10px', 
            borderRadius: '20px', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease'
          }}>
            <div className="user-avatar" style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #a855f7, #6366f1)', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '11px', 
              fontWeight: '700', 
              textTransform: 'uppercase',
              boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)'
            }}>
              {displayName ? displayName.charAt(0) : (user.email ? user.email.charAt(0) : 'U')}
            </div>
            <div className="user-info" style={{ display: 'flex', flexDirection: 'column', gap: '0px', textAlign: 'left' }}>
              <span className="user-name" style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.2', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName || user.email.split('@')[0]}
              </span>
              <span className="user-role" style={{ fontSize: '8px', textTransform: 'uppercase', color: '#cbd5e1', fontWeight: '500', opacity: 0.8, letterSpacing: '0.3px', lineHeight: '1' }}>
                {getRoleLabel(role)}
              </span>
            </div>
          </div>
        )}

        <button 
          className="icon-btn" 
          onClick={onToggleLock} 
          title={
            isEnabled('AUTH_ENABLED')
              ? (isAuthenticated ? `Đã đăng nhập: ${displayName || user?.email} (Đăng xuất)` : 'Đăng nhập hệ thống')
              : (isUnlocked ? 'Đang mở khóa' : 'Đang khóa (Chỉ xem)')
          } 
          style={{ 
            color: isEnabled('AUTH_ENABLED')
              ? (isAuthenticated ? '#a855f7' : 'var(--text-muted)')
              : (isUnlocked ? '#10b981' : 'var(--text-muted)'),
            border: isEnabled('AUTH_ENABLED') && isAuthenticated ? '1px solid rgba(168, 85, 247, 0.3)' : 'none',
            borderRadius: '50%',
            background: isEnabled('AUTH_ENABLED') && isAuthenticated ? 'rgba(168, 85, 247, 0.05)' : 'transparent',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isEnabled('AUTH_ENABLED')
            ? (isAuthenticated ? <Unlock size={15} /> : <Lock size={15} />)
            : (isUnlocked ? <Unlock size={16} /> : <Lock size={16} />)
          }
        </button>

        <button className="icon-btn" onClick={handleRefresh} title="Tải lại">
          <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>

        <button
          className={`icon-btn header-more-btn ${mobileMenuOpen ? 'header-more-btn--open' : ''}`}
          type="button"
          onClick={() => setMobileMenuOpen(open => !open)}
          title="Thao tác khác"
        >
          <MoreHorizontal size={16} />
        </button>

        {isUnlocked && (
          <button className="btn-primary" onClick={() => onAddNew?.()}>
            <Plus size={16} />
            Thêm dự kiến
          </button>
        )}

        <div className={`header-secondary-actions ${mobileMenuOpen ? 'header-secondary-actions--open' : ''}`}>
          {viewMode === 'table' && (
            <button className="icon-btn" onClick={() => { setMobileMenuOpen(false); window.print(); }} title="In / Xuất PDF">
              <Printer size={16} />
            </button>
          )}

          <button className="icon-btn" onClick={() => { setMobileMenuOpen(false); onOpenHistory?.(); }} title="Kho lưu trữ dự kiến mổ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
          </button>

          <button className="icon-btn" onClick={() => { setMobileMenuOpen(false); onOpenCalendar?.(); }} title="Lịch tuần">
            <CalendarDays size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
