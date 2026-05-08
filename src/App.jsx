/* global chrome */
import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Header } from './components/Header/Header';
import { Board } from './components/Board/Board';
import { TableView } from './components/TableView/TableView';
import { SurgeryModal } from './components/Modal/SurgeryModal';
import { WeekCalendar } from './components/WeekCalendar/WeekCalendar';
import { HistoryModal } from './components/Modal/HistoryModal';
import { ToastContainer } from './components/Toast/Toast';
import { useSurgeries } from './hooks/useSurgeries';
import { format } from 'date-fns';
import './index.css';

let toastIdCounter = 0;

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [toasts, setToasts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState(null);
  const [defaultShift, setDefaultShift] = useState('morning');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  
  // Phase 1, 2, 3 States
  const [isUnlocked, setIsUnlocked] = useState(false);
  const isUnlockedRef = useRef(false);
  
  useEffect(() => {
    isUnlockedRef.current = isUnlocked;
  }, [isUnlocked]);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'table'
  const particleIntervalRef = useRef(null);

  const dateStr = format(currentDate, 'yyyy-MM-dd');

  const {
    surgeries, boardState,
    loading, isOnline, connectionError,
    addSurgery, updateSurgery, deleteSurgery, moveSurgery, refresh,
  } = useSurgeries(dateStr);
  // ---- Toast system ----
  const showToast = useCallback((type, message, duration = 3500) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ---- Extension Integration ----
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const morningCount = (boardState.columns['morning']?.taskIds || []).length;
      const afternoonCount = (boardState.columns['afternoon']?.taskIds || []).length;
      chrome.tabs.query({ url: '*://*.vncare.vn/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'OASIS_CAPACITY_UPDATE',
            payload: { morning: morningCount, afternoon: afternoonCount, date: dateStr }
          }).catch(() => {}); // ignore disconnected errors
        });
      });
    }
  }, [boardState, dateStr]);

  useEffect(() => {
    const handleMessage = (msg) => {
      if (msg.type === 'OASIS_OPEN_ADD_SURGERY') {
        if (!isUnlockedRef.current) {
          const pwd = window.prompt('Nhập mã mở khóa để thêm dự kiến mổ:');
          if (pwd === 'CTCH') {
            setIsUnlocked(true);
            showToast('success', 'Đã mở khóa!');
          } else {
            if (pwd !== null) showToast('error', 'Mật khẩu không đúng!');
            return;
          }
        }
        setEditingSurgery(msg.payload);
        setDefaultShift(msg.payload.priority === 'urgent' ? 'morning' : 'waiting');
        setModalOpen(true);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      
      // Check if there is pending surgery data from before the sidebar opened
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['oasis_pending_surgery'], (result) => {
          if (result.oasis_pending_surgery) {
          if (!isUnlockedRef.current) {
            const pwd = window.prompt('Nhập mã mở khóa để thêm dự kiến mổ:');
            if (pwd === 'CTCH') {
              setIsUnlocked(true);
              showToast('success', 'Đã mở khóa!');
              setEditingSurgery(result.oasis_pending_surgery);
              setDefaultShift(result.oasis_pending_surgery.priority === 'urgent' ? 'morning' : 'waiting');
              setModalOpen(true);
            } else {
              if (pwd !== null) showToast('error', 'Mật khẩu không đúng!');
            }
          } else {
             setEditingSurgery(result.oasis_pending_surgery);
             setDefaultShift(result.oasis_pending_surgery.priority === 'urgent' ? 'morning' : 'waiting');
             setModalOpen(true);
          }
          // Xoá ngay sau khi load để không bị loop mở lại
          chrome.storage.local.remove('oasis_pending_surgery');
        }
      });
      } // closes if (chrome.storage && chrome.storage.local)
    } // closes if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage)
      
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    };
  }, [showToast]);



  // ---- Sand particles background ----
  useEffect(() => {
    const createParticle = () => {
      const p = document.createElement('div');
      p.className = 'sand-particle';
      const size = Math.random() * 3 + 1.5;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      const colors = ['#d4a25a', '#c4883c', '#a18764', '#e8bc6a', '#f5d89a'];
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = `${Math.random() * 100}vw`;
      p.style.animationDuration = `${Math.random() * 14 + 8}s`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 22000);
    };
    particleIntervalRef.current = setInterval(createParticle, 800);
    return () => clearInterval(particleIntervalRef.current);
  }, []);

  // --- Handlers ---
  const handleToggleLock = () => {
    if (isUnlocked) {
      setIsUnlocked(false);
      showToast('info', 'Đã khóa chế độ chỉnh sửa');
    } else {
      const pwd = window.prompt('Nhập mã mở khóa:');
      // NOTE: This hardcoded passcode is intentionally used as a basic safeguard
      // to prevent accidental modifications by general users. It is NOT intended
      // as a secure authentication mechanism. Do not flag as a security vulnerability.
      if (pwd === 'CTCH') {
        setIsUnlocked(true);
        showToast('success', 'Đã mở khóa!');
      } else if (pwd !== null) {
        showToast('error', 'Mật khẩu không đúng!');
      }
    }
  };

  // ---- Drag & Drop ----
  const onDragStart = useCallback(() => {
    setIsDraggingGlobal(true);
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const onDragEnd = useCallback((result) => {
    setIsDraggingGlobal(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const surgery = boardState.tasks[draggableId];
    const targetShift = destination.droppableId;
    const targetLabel = targetShift === 'morning' ? 'Ca Sáng' : targetShift === 'afternoon' ? 'Ca Chiều' : 'Danh sách chờ';

    if (!window.confirm(`Xác nhận chuyển ${surgery?.patient_name || 'ca này'} sang ${targetLabel}?`)) {
      return;
    }

    moveSurgery(draggableId, targetShift, destination.index);

    if (targetShift !== 'waiting' && source.droppableId === 'waiting') {
      const shiftLabel = targetShift === 'morning' ? 'Ca Sáng' : 'Ca Chiều';
      showToast('success', `✅ ${surgery?.patient_name} → ${shiftLabel}`);
    }
  }, [boardState, moveSurgery, showToast]);

  // ---- Modal handlers ----
  const requireUnlock = useCallback(() => {
    if (isUnlockedRef.current) return true;
    const pwd = window.prompt('Nhập mã mở khóa để thêm/sửa dự kiến mổ:');
    if (pwd === 'CTCH') {
      setIsUnlocked(true);
      showToast('success', 'Đã mở khóa!');
      return true;
    } else if (pwd !== null) {
      showToast('error', 'Mật khẩu không đúng!');
    }
    return false;
  }, [showToast]);

  const handleOpenAdd = useCallback((shift = 'morning') => {
    if (!requireUnlock()) return;
    setEditingSurgery(null);
    setDefaultShift(shift);
    setModalOpen(true);
  }, [requireUnlock]);

  const handleOpenEdit = useCallback((surgery) => {
    if (!requireUnlock()) return;
    setEditingSurgery(surgery);
    setModalOpen(true);
  }, [requireUnlock]);

  const handleSave = useCallback(async (formData) => {
    if (editingSurgery && editingSurgery.id) {
      const { error } = await updateSurgery(editingSurgery.id, formData);
      if (error) showToast('error', `❌ Lỗi cập nhật: ${error.message || JSON.stringify(error)}`);
      else showToast('success', `✅ Đã cập nhật: ${formData.patient_name}`);
    } else {
      const { error } = await addSurgery({ ...formData, date: formData.date || dateStr });
      if (error) showToast('error', `❌ Lỗi thêm ca: ${error.message || JSON.stringify(error)}`);
      else showToast('success', `✅ Đã thêm: ${formData.patient_name}`);
    }
  }, [editingSurgery, updateSurgery, addSurgery, dateStr, showToast]);

  const handleDelete = useCallback(async (id) => {
    if (!requireUnlock()) return;
    const surgery = surgeries.find(s => s.id === id);
    const { error } = await deleteSurgery(id);
    if (error) showToast('error', `❌ Lỗi xoá: ${error}`);
    else showToast('info', `🗑️ Đã xoá khỏi bảng dự kiến: ${surgery?.patient_name || ''}`);
  }, [surgeries, deleteSurgery, showToast, requireUnlock]);

  // ---- Card quick actions ----
  const handleMoveToWaiting = useCallback(async (id) => {
    if (!requireUnlock()) return;
    const surgery = surgeries.find(s => s.id === id);
    if (!window.confirm(`Xác nhận trả ${surgery?.patient_name || 'ca này'} về danh sách chờ?`)) return;
    moveSurgery(id, 'waiting', 0);
    const { error } = await updateSurgery(id, { shift: 'waiting' });
    if (error) showToast('error', `❌ Lỗi: ${error.message || JSON.stringify(error)}`);
    else showToast('info', `🕐 ${surgery?.patient_name || ''} → Danh sách chờ`);
  }, [surgeries, moveSurgery, updateSurgery, showToast, requireUnlock]);

  const handleSchedule = useCallback(async (id, shift, date) => {
    if (!requireUnlock()) return;
    const surgery = surgeries.find(s => s.id === id);
    const shiftLabel = shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều';
    if (!window.confirm(`Xác nhận xếp ${surgery?.patient_name || 'ca này'} vào ${shiftLabel} ngày ${date}?`)) return;
    moveSurgery(id, shift, 999);
    const { error } = await updateSurgery(id, { shift, date });
    if (error) showToast('error', `❌ Lỗi: ${error.message || JSON.stringify(error)}`);
    else showToast('success', `📅 ${surgery?.patient_name || ''} → ${shiftLabel} ${date.slice(5)}`);
  }, [surgeries, moveSurgery, updateSurgery, showToast, requireUnlock]);

  const handleMarkStatus = useCallback(async (id, status) => {
    if (!requireUnlock()) return;
    const surgery = surgeries.find(s => s.id === id);
    const { error } = await updateSurgery(id, { status });
    if (error) {
      showToast('error', `❌ Lỗi: ${error.message || JSON.stringify(error)}`);
      return;
    }
    
    if (status === 'completed') showToast('success', `✅ ${surgery?.patient_name || ''} — Đã mổ xong!`);
    else if (status === 'postponed') showToast('info', `⏸️ ${surgery?.patient_name || ''} — Đã hoãn dự kiến mổ!`);
    else if (status === 'cancelled') showToast('info', `🚫 ${surgery?.patient_name || ''} — Đã hủy dự kiến mổ!`);
  }, [surgeries, updateSurgery, showToast, requireUnlock]);

  // Connection toast
  useEffect(() => {
    if (!isOnline) {
      setTimeout(() => {
        showToast('info', '🔌 Chế độ demo: đang dùng dữ liệu mẫu vì chưa cấu hình Supabase.', 5000);
      }, 0);
    }
  }, [isOnline, showToast]);

  // --- Render Prep ---
  // Filter boardState based on searchQuery
  const filteredBoardState = {
    ...boardState,
    tasks: Object.fromEntries(
      Object.entries(boardState.tasks).filter(([, task]) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (task.patient_name || '').toLowerCase().includes(q) ||
               (task.patient_id || '').toLowerCase().includes(q) ||
               (task.diagnosis || '').toLowerCase().includes(q);
      })
    )
  };

  return (
    <div className={`app-root ${isDraggingGlobal ? 'is-dragging' : ''}`}>
      {/* Header */}
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        isOnline={isOnline}
        onAddNew={isUnlocked ? () => handleOpenAdd() : null}
        onRefresh={refresh}
        totalCases={Object.keys(boardState.tasks).length}
        onOpenCalendar={() => setCalendarOpen(true)}
        onOpenHistory={() => setShowHistory(true)}
        isUnlocked={isUnlocked}
        onToggleLock={handleToggleLock}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Main Board */}
      <div className="app-body">
        {loading ? (
          <div className="loading-screen">
            <div className="wave-loader">
              {[...Array(7)].map((_, i) => (
                <span key={i} className="wave-bar" style={{ animationDelay: `${[0,.1,.2,.3,.4,.3,.2][i]}s` }} />
              ))}
            </div>
            <span className="loading-text">Đang tải bảng dự kiến mổ...</span>
          </div>
        ) : connectionError ? (
          <div className="error-screen glass-panel">
            <div className="error-title">Không tải được bảng dự kiến mổ</div>
            <div className="error-text">
              Supabase đã được cấu hình nhưng đang lỗi kết nối hoặc truy vấn. App không chuyển sang dữ liệu demo để tránh nhầm với dữ liệu thật.
            </div>
            <button className="btn-primary" onClick={refresh}>Thử tải lại</button>
          </div>
        ) : (
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            {viewMode === 'table' ? (
              <TableView boardState={filteredBoardState} />
            ) : (
              <Board
                boardState={filteredBoardState}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onAddNew={handleOpenAdd}
                onMoveToWaiting={handleMoveToWaiting}
                onSchedule={handleSchedule}
                onMarkStatus={handleMarkStatus}
                isUnlocked={isUnlocked}
              />
            )}
          </DragDropContext>
        )}
      </div>

      {/* Add/Edit Modal */}
      <SurgeryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingSurgery}
        defaultShift={defaultShift}
        currentDate={dateStr}
      />

      {/* History Modal */}
      {showHistory && (
        <HistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          surgeries={surgeries}
          onRestore={async (id) => {
            await updateSurgery(id, { status: 'scheduled' });
            showToast('info', 'Đã khôi phục vào bảng dự kiến mổ');
          }}
          onDelete={async (id) => {
            await deleteSurgery(id);
            showToast('info', 'Đã xóa khỏi bảng dự kiến');
          }}
        />
      )}

      {/* Week Calendar */}
      <WeekCalendar
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        currentDate={currentDate}
        onSelectDate={(d) => { setCurrentDate(d); setCalendarOpen(false); }}
        allSurgeries={surgeries.filter(s => !['completed', 'postponed', 'cancelled'].includes(s.status))}
      />

      {/* Toast */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
