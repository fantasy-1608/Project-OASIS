/**
 * ============================================================
 * PROJECT OASIS — Scheduler: CTCH Rules Configuration
 * ============================================================
 *
 * TRẠNG THÁI: ⏸️  CHƯA KẾT NỐI VÀO APP
 *
 * File này định nghĩa tất cả quy tắc xếp lịch mổ cho khoa CTCH.
 * Engine sẽ dùng file này khi FEATURES.SCHEDULER_ENGINE = true.
 *
 * Để thêm quy tắc mới:
 *   1. Định nghĩa rule object theo interface SchedulingRule
 *   2. Thêm vào mảng CTCH_RULES
 *   3. Test với engine.js trước khi bật flag
 * ============================================================
 */

// ============================================================
// Constants cho CTCH
// ============================================================
export const CTCH_CONFIG = {
  // Số ca tối đa mỗi buổi (mặc định, có thể override theo phòng)
  MAX_CASES_MORNING: 5,
  MAX_CASES_AFTERNOON: 4,

  // Ca được coi là "ca dài" (phút)
  LONG_CASE_THRESHOLD_MINUTES: 180,

  // Khoảng nghỉ tối thiểu giữa 2 ca dài cùng phòng (phút)
  MIN_TURNOVER_TIME_MINUTES: 30,

  // Số slot phòng cấp cứu luôn phải để trống
  EMERGENCY_ROOM_RESERVE_SLOTS: 1,

  // ID phòng cấp cứu
  EMERGENCY_ROOM_ID: 'r4',

  // Urgency levels theo thứ tự ưu tiên (cao → thấp)
  URGENCY_PRIORITY: ['emergency', 'semi_urgent', 'elective', 're_operation'],

  // Thời gian cảnh báo sớm khi ca cần implant (ngày)
  IMPLANT_ALERT_DAYS_AHEAD: 2,
};

// ============================================================
// Interface (JSDoc) — SchedulingRule
// ============================================================
/**
 * @typedef {Object} SchedulingRule
 * @property {string}   id        - Unique identifier
 * @property {string}   name      - Tên quy tắc (hiện cho user)
 * @property {string}   category  - Nhóm: 'capacity'|'availability'|'resource'|'safety'
 * @property {'error'|'warning'|'info'} severity
 *   - error: block xếp lịch
 *   - warning: cảnh báo nhưng vẫn cho phép
 *   - info: gợi ý
 * @property {Function} check - (surgery, context) => { valid: boolean, message: string }
 */

// ============================================================
// Context object (sẽ được engine.js build trước khi chạy rules)
// ============================================================
/**
 * @typedef {Object} SchedulingContext
 * @property {string} targetDate
 * @property {'morning'|'afternoon'} targetShift
 * @property {Array}  scheduledSurgeries - Ca đã xếp trong ngày đó
 * @property {Array}  surgeonSchedules   - Lịch trực bác sĩ ngày đó
 * @property {Array}  roomSchedules      - Trạng thái phòng mổ ngày đó
 * @property {Object} boardState         - Board state hiện tại
 */

// ============================================================
// Các quy tắc xếp lịch cho CTCH
// ============================================================
export const CTCH_RULES = [

  // ----------------------------------------------------------
  // NHÓM: CAPACITY (Giới hạn số ca)
  // ----------------------------------------------------------
  {
    id: 'capacity_per_shift',
    name: 'Giới hạn số ca mỗi buổi',
    category: 'capacity',
    severity: 'error',
    check: (surgery, context) => {
      const { targetShift, scheduledSurgeries } = context;
      const inShift = scheduledSurgeries.filter(s => s.shift === targetShift);
      const max = targetShift === 'morning'
        ? CTCH_CONFIG.MAX_CASES_MORNING
        : CTCH_CONFIG.MAX_CASES_AFTERNOON;

      if (inShift.length >= max) {
        return {
          valid: false,
          message: `${targetShift === 'morning' ? 'Ca sáng' : 'Ca chiều'} đã đủ ${max} ca. Không thể xếp thêm.`,
        };
      }
      return { valid: true };
    },
  },

  {
    id: 'emergency_room_reserve',
    name: 'Dự trữ slot phòng cấp cứu',
    category: 'capacity',
    severity: 'error',
    check: (surgery, context) => {
      if (surgery.priority === 'emergency') return { valid: true };

      const { targetShift, scheduledSurgeries } = context;
      const inEmergencyRoom = scheduledSurgeries.filter(s =>
        s.room_id === CTCH_CONFIG.EMERGENCY_ROOM_ID &&
        s.shift === targetShift
      );
      const roomCapacity = 2; // capacity_per_shift của phòng cấp cứu

      if (inEmergencyRoom.length >= roomCapacity - CTCH_CONFIG.EMERGENCY_ROOM_RESERVE_SLOTS) {
        return {
          valid: false,
          message: `Phòng cấp cứu (PM-CC) cần giữ ${CTCH_CONFIG.EMERGENCY_ROOM_RESERVE_SLOTS} slot cho ca cấp cứu.`,
        };
      }
      return { valid: true };
    },
  },

  // ----------------------------------------------------------
  // NHÓM: AVAILABILITY (Bác sĩ / Phòng mổ)
  // ----------------------------------------------------------
  {
    id: 'surgeon_availability',
    name: 'Kiểm tra lịch trực bác sĩ',
    category: 'availability',
    severity: 'warning',
    check: (surgery, context) => {
      if (!surgery.surgeon_id) return { valid: true }; // Chưa chọn bác sĩ
      const { targetDate, targetShift, surgeonSchedules } = context;

      const schedule = surgeonSchedules.find(ss =>
        ss.surgeon_id === surgery.surgeon_id &&
        ss.date === targetDate &&
        ['morning', 'afternoon', 'all_day', 'on_call'].includes(ss.shift)
      );

      if (!schedule) {
        return {
          valid: false,
          message: `Bác sĩ không có lịch trực ngày ${targetDate}. Xác nhận trước khi xếp.`,
        };
      }

      if (schedule.shift !== 'all_day' && schedule.shift !== targetShift && schedule.shift !== 'on_call') {
        return {
          valid: false,
          message: `Bác sĩ chỉ trực ${schedule.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}, không phải ${targetShift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}.`,
        };
      }

      return { valid: true };
    },
  },

  {
    id: 'surgeon_workload',
    name: 'Giới hạn số ca mỗi bác sĩ trong ngày',
    category: 'availability',
    severity: 'warning',
    check: (surgery, context) => {
      if (!surgery.surgeon_id) return { valid: true };
      const { targetDate, scheduledSurgeries, surgeonSchedules } = context;

      const scheduleInfo = surgeonSchedules.find(ss => ss.surgeon_id === surgery.surgeon_id);
      const maxCases = scheduleInfo?.max_cases || 4;

      const surgeonCases = scheduledSurgeries.filter(s =>
        s.surgeon_id === surgery.surgeon_id &&
        s.date === targetDate
      );

      if (surgeonCases.length >= maxCases) {
        return {
          valid: false,
          message: `Bác sĩ đã có ${surgeonCases.length}/${maxCases} ca trong ngày. Vượt giới hạn.`,
        };
      }
      return { valid: true };
    },
  },

  // ----------------------------------------------------------
  // NHÓM: RESOURCE (Dụng cụ / Thiết bị)
  // ----------------------------------------------------------
  {
    id: 'implant_readiness',
    name: 'Implant phải sẵn sàng trước khi xếp lịch',
    category: 'resource',
    severity: 'warning',
    check: (surgery, _context) => {
      if (!surgery.implant_required?.length) return { valid: true };

      if (!surgery.implant_ready) {
        return {
          valid: false,
          message: `Ca cần implant [${surgery.implant_required.join(', ')}] nhưng chưa xác nhận sẵn sàng. Liên hệ kho implant trước khi xếp.`,
        };
      }
      return { valid: true };
    },
  },

  {
    id: 'carm_availability',
    name: 'Kiểm tra C-arm khi ca cần',
    category: 'resource',
    severity: 'warning',
    check: (surgery, context) => {
      if (!surgery.needs_carm) return { valid: true };
      const { targetShift, scheduledSurgeries } = context;

      // Đếm ca cần C-arm cùng buổi
      const caseNeedingCArm = scheduledSurgeries.filter(s =>
        s.shift === targetShift && s.needs_carm
      );

      // Giả sử CTCH có 1 C-arm (hardcode, sẽ thành config sau)
      const CARM_COUNT = 1;

      if (caseNeedingCArm.length >= CARM_COUNT) {
        return {
          valid: false,
          message: `C-arm đã được dùng cho ${caseNeedingCArm.length} ca ${targetShift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}. Kiểm tra lại lịch thiết bị.`,
        };
      }
      return { valid: true };
    },
  },

  // ----------------------------------------------------------
  // NHÓM: SAFETY (An toàn lâm sàng)
  // ----------------------------------------------------------
  {
    id: 'long_case_spacing',
    name: 'Không xếp 2 ca dài liền nhau cùng phòng',
    category: 'safety',
    severity: 'warning',
    check: (surgery, context) => {
      if (!surgery.duration_minutes) return { valid: true };
      if (surgery.duration_minutes < CTCH_CONFIG.LONG_CASE_THRESHOLD_MINUTES) return { valid: true };
      if (!surgery.room_id) return { valid: true };

      const { targetShift, scheduledSurgeries } = context;

      const longCasesInRoom = scheduledSurgeries.filter(s =>
        s.room_id === surgery.room_id &&
        s.shift === targetShift &&
        s.duration_minutes >= CTCH_CONFIG.LONG_CASE_THRESHOLD_MINUTES
      );

      if (longCasesInRoom.length >= 1) {
        return {
          valid: false,
          message: `Phòng mổ đã có ${longCasesInRoom.length} ca dài (>${CTCH_CONFIG.LONG_CASE_THRESHOLD_MINUTES}ph) cùng buổi. Cần thêm thời gian dọn phòng (>${CTCH_CONFIG.MIN_TURNOVER_TIME_MINUTES}ph).`,
        };
      }
      return { valid: true };
    },
  },

  {
    id: 'readiness_checklist',
    name: 'Checklist chuẩn bị bệnh nhân',
    category: 'safety',
    severity: 'info',
    check: (surgery) => {
      const checklist = [
        { key: 'ready_labs', label: 'Xét nghiệm' },
        { key: 'ready_imaging', label: 'Phim ảnh' },
        { key: 'ready_consent', label: 'Ký cam kết' },
        { key: 'ready_fasting', label: 'Nhịn ăn' },
        { key: 'ready_antibiotics', label: 'Kháng sinh dự phòng' },
        { key: 'ready_insurance', label: 'BHYT/Hành chính' },
      ];

      const missing = checklist.filter(item => !surgery[item.key]).map(item => item.label);

      if (missing.length > 0) {
        return {
          valid: true, // info: không block, chỉ nhắc
          message: `Chưa hoàn tất: ${missing.join(', ')}.`,
        };
      }
      return { valid: true };
    },
  },

  {
    id: 'emergency_priority',
    name: 'Ca cấp cứu được ưu tiên chen vào',
    category: 'safety',
    severity: 'info',
    check: (surgery, _context) => {
      if (surgery.priority !== 'emergency') return { valid: true };
      // Ca cấp cứu luôn valid, chỉ thêm note
      return {
        valid: true,
        message: '⚡ Ca cấp cứu — được ưu tiên xếp, hệ thống sẽ thông báo xung đột cho các ca khác.',
      };
    },
  },
];

// ============================================================
// Helper: Lọc rules theo category hoặc severity
// ============================================================
export function getRulesByCategory(category) {
  return CTCH_RULES.filter(r => r.category === category);
}

export function getBlockingRules() {
  return CTCH_RULES.filter(r => r.severity === 'error');
}
