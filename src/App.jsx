/* global chrome */
import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Header } from './components/Header/Header';
import { Board } from './components/Board/Board';
import { SurgeryModal } from './components/Modal/SurgeryModal';
import { WeekCalendar } from './components/WeekCalendar/WeekCalendar';
import { ToastContainer } from './components/Toast/Toast';
import { useSurgeries } from './hooks/useSurgeries';
import { format } from 'date-fns';
import './index.css';

let toastIdCounter = 0;

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [toasts, setToasts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState(null);
  const [defaultShift, setDefaultShift] = useState('morning');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const particleIntervalRef = useRef(null);

  const dateStr = format(currentDate, 'yyyy-MM-dd');

  const {
    surgeries, boardState,
    loading, isOnline,
    addSurgery, updateSurgery, deleteSurgery, moveSurgery, refresh,
  } = useSurgeries(dateStr);
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
        setEditingSurgery(msg.payload);
        setDefaultShift(msg.payload.priority === 'urgent' ? 'morning' : 'waiting');
        setModalOpen(true);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      
      // Check if there is pending surgery data from before the sidebar opened
      chrome.storage.local.get(['oasis_pending_surgery'], (result) => {
        if (result.oasis_pending_surgery) {
          setEditingSurgery(result.oasis_pending_surgery);
          setDefaultShift(result.oasis_pending_surgery.priority === 'urgent' ? 'morning' : 'waiting');
          setModalOpen(true);
          // Xoá ngay sau khi load để không bị loop mở lại
          chrome.storage.local.remove('oasis_pending_surgery');
        }
      });
      
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);


  // ---- Toast system ----
  const showToast = useCallback((type, message, duration = 3500) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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

  // ---- Drag & Drop (no business rules) ----
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

    moveSurgery(draggableId, targetShift, destination.index);

    if (targetShift !== 'waiting' && source.droppableId === 'waiting') {
      const shiftLabel = targetShift === 'morning' ? 'Ca Sáng' : 'Ca Chiều';
      showToast('success', `✅ ${surgery?.patient_name} → ${shiftLabel}`);
    }
  }, [boardState, moveSurgery, showToast]);

  // ---- Modal handlers ----
  const handleOpenAdd = useCallback((shift = 'morning') => {
    setEditingSurgery(null);
    setDefaultShift(shift);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((surgery) => {
    setEditingSurgery(surgery);
    setModalOpen(true);
  }, []);

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
    const surgery = surgeries.find(s => s.id === id);
    const { error } = await deleteSurgery(id);
    if (error) showToast('error', `❌ Lỗi xoá: ${error}`);
    else showToast('info', `🗑️ Đã xoá: ${surgery?.patient_name || ''}`);
  }, [surgeries, deleteSurgery, showToast]);

  // ---- Card quick actions ----
  const handleMoveToWaiting = useCallback(async (id) => {
    const surgery = surgeries.find(s => s.id === id);
    moveSurgery(id, 'waiting', 0);
    const { error } = await updateSurgery(id, { shift: 'waiting' });
    if (error) showToast('error', `❌ Lỗi: ${error.message || JSON.stringify(error)}`);
    else showToast('info', `🕐 ${surgery?.patient_name || ''} → Danh sách chờ`);
  }, [surgeries, moveSurgery, updateSurgery, showToast]);

  const handleSchedule = useCallback(async (id, shift, date) => {
    const surgery = surgeries.find(s => s.id === id);
    moveSurgery(id, shift, 999);
    const { error } = await updateSurgery(id, { shift, date });
    const shiftLabel = shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều';
    if (error) showToast('error', `❌ Lỗi: ${error.message || JSON.stringify(error)}`);
    else showToast('success', `📅 ${surgery?.patient_name || ''} → ${shiftLabel} ${date.slice(5)}`);
  }, [surgeries, moveSurgery, updateSurgery, showToast]);

  // Connection toast
  useEffect(() => {
    if (!isOnline) {
      setTimeout(() => {
        showToast('info', '🔌 Chế độ demo. Kết nối Supabase để dùng thật.', 5000);
      }, 0);
    }
  }, [isOnline, showToast]);

  return (
    <div className={`app-root ${isDraggingGlobal ? 'is-dragging' : ''}`}>
      {/* Header */}
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        isOnline={isOnline}
        onAddNew={() => handleOpenAdd()}
        onRefresh={refresh}
        totalCases={Object.keys(boardState.tasks).length}
        onOpenCalendar={() => setCalendarOpen(true)}
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
            <span className="loading-text">Đang tải lịch mổ...</span>
          </div>
        ) : (
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <Board
              boardState={boardState}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onAddNew={handleOpenAdd}
              onMoveToWaiting={handleMoveToWaiting}
              onSchedule={handleSchedule}
            />
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

      {/* Week Calendar */}
      <WeekCalendar
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        currentDate={currentDate}
        onSelectDate={(d) => { setCurrentDate(d); setCalendarOpen(false); }}
        allSurgeries={surgeries}
      />

      {/* Toast */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
