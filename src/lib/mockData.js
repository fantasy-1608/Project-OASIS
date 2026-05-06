// ============================================================
// MOCK DATA — Dữ liệu mẫu cho chế độ offline (chưa kết nối Supabase)
// Khi Supabase được cấu hình, file này chỉ còn buildInitialBoardState
// ============================================================

export const MOCK_SURGEONS = [];
export const MOCK_ROOMS = [];

const today = new Date();
const fmt = (d) => d.toISOString().split('T')[0];

export const MOCK_SURGERIES = [
  {
    id: 'demo-001',
    patient_name: 'Nguyễn Văn A',
    diagnosis: 'Thoát vị đĩa đệm L4-L5',
    priority: 'elective',
    status: 'scheduled',
    date: fmt(today),
    shift: 'morning',
    order_in_shift: 1,
  },
  {
    id: 'demo-002',
    patient_name: 'Trần Thị B',
    diagnosis: 'U nang buồng trứng',
    priority: 'urgent',
    status: 'scheduled',
    date: fmt(today),
    shift: 'waiting',
    order_in_shift: 1,
  },
];

// ---- Board State Builder ----
// - waiting : TẤT CẢ ca chưa lên lịch (không phụ thuộc ngày xem)
// - morning/afternoon : chỉ ca của ngày đang xem
export function buildInitialBoardState(surgeries, date) {
  const tasks = {};
  surgeries.forEach(s => { tasks[s.id] = s; });

  const waitingIds = surgeries
    .filter(s => s.shift === 'waiting' || !s.shift)
    .sort((a, b) => (a.order_in_shift || 999) - (b.order_in_shift || 999))
    .map(s => s.id);

  const daySurgeries = surgeries.filter(s => s.date === date);
  const morningIds   = daySurgeries.filter(s => s.shift === 'morning').map(s => s.id);
  const afternoonIds = daySurgeries.filter(s => s.shift === 'afternoon').map(s => s.id);

  return {
    tasks,
    columns: {
      waiting:   { id: 'waiting',   title: 'Danh sách chờ', taskIds: waitingIds },
      morning:   { id: 'morning',   title: 'Ca Sáng',  subtitle: '07:30 – 11:30', taskIds: morningIds },
      afternoon: { id: 'afternoon', title: 'Ca Chiều', subtitle: '13:30 – 17:00', taskIds: afternoonIds },
    },
    columnOrder: ['waiting', 'morning', 'afternoon'],
  };
}
