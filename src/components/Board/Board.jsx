import { useState, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { SurgeryCard } from '../SurgeryCard/SurgeryCard';
import { Plus } from 'lucide-react';

// ── Waiting list column (vertical, left side) ──────────────────
function WaitingColumn({ tasks, onEdit, onDelete, onAddNew, onMoveToWaiting, onSchedule, onMarkStatus, isUnlocked }) {
  return (
    <div className="waiting-panel glass-panel">
      <div className="waiting-header">
        <div className="waiting-title-row">
          <span className="waiting-icon">📋</span>
          <span className="waiting-title">Danh sách chờ</span>
        </div>
        <span className="column-count-badge">{tasks.length} ca</span>
      </div>

      <Droppable droppableId="waiting" direction="vertical">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`waiting-drop-zone ${snapshot.isDraggingOver ? 'drop-zone--active' : ''}`}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="empty-state">
                <span>📝</span>
                <span>Chưa có ca nào</span>
              </div>
            )}
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!isUnlocked}>
                {(prov, snap) => (
                  <SurgeryCard
                    surgery={task}
                    index={index}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveToWaiting={onMoveToWaiting}
                    onSchedule={onSchedule} onMarkStatus={onMarkStatus}
                    provided={prov}
                    isDragging={snap.isDragging}
                    compact
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {isUnlocked && (
        <button className="waiting-add-btn" onClick={() => onAddNew?.('waiting')}>
          <Plus size={15} /> Thêm ca mổ
        </button>
      )}
    </div>
  );
}

// ── Shift row (horizontal, right side) ────────────────────────
const SHIFT_META = {
  morning:   { icon: '🌅', label: 'Ca Sáng',  time: '07:30 – 11:30', color: '#f59e0b', bg: 'rgba(245,158,11,0.05)' },
  afternoon: { icon: '🌆', label: 'Ca Chiều', time: '13:30 – 17:00', color: '#d4a25a', bg: 'rgba(212,162,90,0.05)' },
};

function ShiftRow({ shiftId, tasks, onEdit, onDelete, onAddNew, onMoveToWaiting, onSchedule, onMarkStatus, isUnlocked }) {
  const meta = SHIFT_META[shiftId];
  const emergencyCount = tasks.filter(t => t.priority === 'emergency').length;
  const isOverload = tasks.length > 4;

  const [isWide, setIsWide] = useState(window.innerWidth >= 700);

  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 700);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`shift-row glass-panel ${isOverload ? 'shift-row--overload' : ''}`} style={{ borderLeft: `3px solid ${isOverload ? 'var(--error)' : meta.color}` }}>
      {/* Row Header */}
      <div className="shift-row-header">
        <div className="shift-row-title-group">
          <span className="shift-row-icon">{meta.icon}</span>
          <div>
            <div className="shift-row-title" style={{ color: isOverload ? 'var(--error)' : 'inherit' }}>
              {meta.label} {isOverload && <span style={{ fontSize: '12px', background: 'var(--error)', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>⚠️ Quá tải</span>}
            </div>
            <div className="shift-row-time">{meta.time}</div>
          </div>
        </div>
        <div className="shift-row-badges">
          {emergencyCount > 0 && (
            <span className="emergency-count-badge">{emergencyCount} cấp cứu</span>
          )}
          <span className="column-count-badge" style={{ background: isOverload ? 'var(--error)' : '', color: isOverload ? 'white' : '' }}>
            {tasks.length} ca
          </span>
          {isUnlocked && (
            <button className="column-add-btn" onClick={() => onAddNew?.(shiftId)} title="Thêm ca mổ">
              <Plus size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal / Vertical droppable */}
      <Droppable droppableId={shiftId} direction={isWide ? 'horizontal' : 'vertical'}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`shift-cards-row ${snapshot.isDraggingOver ? 'drop-zone--active' : ''}`}
            style={{ background: snapshot.isDraggingOver ? 'rgba(212,162,90,0.08)' : meta.bg }}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="shift-empty">
                <span style={{ fontSize: '22px', opacity: 0.35 }}>{meta.icon}</span>
                <span>Kéo ca mổ vào đây</span>
              </div>
            )}
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!isUnlocked}>
                {(prov, snap) => (
                  <SurgeryCard
                    surgery={task}
                    index={index}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveToWaiting={onMoveToWaiting}
                    onSchedule={onSchedule} onMarkStatus={onMarkStatus}
                    provided={prov}
                    isDragging={snap.isDragging}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ── Main Board ─────────────────────────────────────────────────
export function Board({ boardState, onEdit, onDelete, onAddNew, onMoveToWaiting, onSchedule, onMarkStatus, isUnlocked }) {
  const waitingTasks = (boardState.columns['waiting']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);
  const morningTasks = (boardState.columns['morning']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);
  const afternoonTasks = (boardState.columns['afternoon']?.taskIds || []).map(id => boardState.tasks[id]).filter(Boolean);

  return (
    <div className="board-layout">
      {/* Waiting Column */}
      <WaitingColumn 
        tasks={waitingTasks}
        onEdit={onEdit} onDelete={onDelete} onAddNew={onAddNew} 
        onMoveToWaiting={onMoveToWaiting} onSchedule={onSchedule} onMarkStatus={onMarkStatus}
        isUnlocked={isUnlocked}
      />

      {/* Shifts */}
      <div className="shift-rows-area">
        <ShiftRow 
          shiftId="morning" tasks={morningTasks} 
          onEdit={onEdit} onDelete={onDelete} onAddNew={onAddNew} 
          onMoveToWaiting={onMoveToWaiting} onSchedule={onSchedule} onMarkStatus={onMarkStatus}
          isUnlocked={isUnlocked}
        />
        <ShiftRow 
          shiftId="afternoon" tasks={afternoonTasks} 
          onEdit={onEdit} onDelete={onDelete} onAddNew={onAddNew} 
          onMoveToWaiting={onMoveToWaiting} onSchedule={onSchedule} onMarkStatus={onMarkStatus}
          isUnlocked={isUnlocked}
        />
      </div>
    </div>
  );
}
