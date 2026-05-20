/**
 * ============================================================
 * PROJECT OASIS — Feature Flags
 * ============================================================
 *
 * Tất cả flags mặc định = false → app chạy y hệt hiện tại.
 * Khi sẵn sàng deploy một giai đoạn, chỉ cần đổi false → true.
 *
 * KHÔNG thêm logic mới vào App.jsx cho đến khi flag tương ứng = true.
 *
 * Thứ tự khuyến nghị bật:
 *   GĐ 1: NORMALIZED_SCHEMA → AUDIT_LOG_ENABLED → AUTH_ENABLED
 *   GĐ 2: CAPACITY_RULES → SURGEON_AVAILABILITY → SCHEDULER_ENGINE → OPERATIONS_DASHBOARD
 *   GĐ 3: AI_SCHEDULING → OVERLOAD_FORECAST → HIS_SYNC_PHASE2
 * ============================================================
 */

export const FEATURES = {
  // ----------------------------------------------------------
  // GIAI ĐOẠN 1 — Nền Móng (Schema + Auth + Audit)
  // ----------------------------------------------------------

  /**
   * NORMALIZED_SCHEMA
   * Khi true: useSurgeries.js đọc từ cột thật (surgical_method, admission_date,
   * body_region, implant_required...) thay vì unpack từ JSON trong cột notes.
   * Yêu cầu: đã chạy migration 001_normalize_schema.sql + script backfill.
   */
  NORMALIZED_SCHEMA: false,

  /**
   * AUDIT_LOG_ENABLED
   * Khi true: mọi thao tác add/update/delete/move sẽ ghi vào bảng surgery_audit_log.
   * Yêu cầu: đã chạy migration 003_audit_log.sql.
   */
  AUDIT_LOG_ENABLED: true,

  /**
   * AUTH_ENABLED
   * Khi true: thay window.prompt('CTCH') bằng Supabase Auth + role-based access.
   * LoginModal.jsx sẽ được render thay cho cơ chế unlock hiện tại.
   * Yêu cầu: đã chạy migration 002_auth_and_roles.sql.
   * CẢNH BÁO: Breaking change với App.jsx — test kỹ trước khi bật.
   */
  AUTH_ENABLED: true,

  // ----------------------------------------------------------
  // GIAI ĐOẠN 2 — Scheduling Engine
  // ----------------------------------------------------------

  /**
   * CAPACITY_RULES
   * Khi true: enforce giới hạn số ca mỗi buổi theo capacity_per_shift của phòng mổ.
   * Hiện cảnh báo nếu vượt quá, không block kéo thả (chỉ warn).
   */
  CAPACITY_RULES: false,

  /**
   * SURGEON_AVAILABILITY
   * Khi true: kiểm tra lịch trực bác sĩ trước khi xếp ca.
   * Yêu cầu: đã chạy migration 004_surgeon_schedules.sql + có dữ liệu lịch trực.
   */
  SURGEON_AVAILABILITY: false,

  /**
   * SCHEDULER_ENGINE
   * Khi true: khi xếp ca vào buổi, engine chạy toàn bộ rules và hiện:
   *   - ConflictWarning.jsx nếu có xung đột
   *   - SlotSuggestion.jsx gợi ý buổi phù hợp hơn
   * Yêu cầu: NORMALIZED_SCHEMA = true (cần cột implant_ready, needs_carm...).
   */
  SCHEDULER_ENGINE: false,

  /**
   * OPERATIONS_DASHBOARD
   * Khi true: hiện panel dashboard tổng quan bên cạnh board (toggle qua Header).
   * Dashboard: tổng ca, ca cấp cứu, tải buổi, tải bác sĩ, tải phòng, readiness summary.
   */
  OPERATIONS_DASHBOARD: false,

  /**
   * PROGRAM_LOCK
   * Khi true: admin có thể "chốt" chương trình mổ trong ngày.
   * Sau khi chốt, chỉ admin mới sửa được. Hiện banner thông báo cho mọi người.
   * Yêu cầu: AUTH_ENABLED = true (cần biết ai là admin).
   */
  PROGRAM_LOCK: false,

  /**
   * DAILY_SNAPSHOT
   * Khi true: tự động lưu snapshot chương trình mổ vào cuối ngày (23:55).
   * Dùng Supabase Edge Function hoặc cron job riêng.
   */
  DAILY_SNAPSHOT: false,

  // ----------------------------------------------------------
  // GIAI ĐOẠN 3 — AI & Scale
  // ----------------------------------------------------------

  /**
   * AI_SCHEDULING
   * Khi true: gợi ý ngày/buổi mổ tối ưu dựa trên ML model (weighted scoring v1).
   * Yêu cầu: ≥ 3 tháng data sạch với schema chuẩn hóa.
   */
  AI_SCHEDULING: false,

  /**
   * OVERLOAD_FORECAST
   * Khi true: hiện biểu đồ dự báo quá tải 7 ngày dựa trên trend lịch sử.
   */
  OVERLOAD_FORECAST: false,

  /**
   * HIS_SYNC_PHASE2
   * Khi true: bật xuất PDF chương trình mổ + share link nội bộ.
   * (Phase 1: HIS → OASIS đã có qua extension/message bridge)
   */
  HIS_SYNC_PHASE2: false,

  /**
   * HIS_SYNC_PHASE3
   * Khi true: đồng bộ trạng thái sau mổ từ HIS về OASIS (2 chiều).
   * NGUY HIỂM: Chỉ bật khi đã có lõi dữ liệu + auth + audit chắc chắn.
   */
  HIS_SYNC_PHASE3: false,
};

/**
 * Helper: kiểm tra flag có bật không (type-safe, fail-safe = false)
 * @param {keyof typeof FEATURES} flag
 * @returns {boolean}
 */
export function isEnabled(flag) {
  return FEATURES[flag] === true;
}

/**
 * Helper dùng trong dev console để xem trạng thái tất cả flags
 * Gọi: window.__oasisFlags() trong browser DevTools
 */
if (typeof window !== 'undefined') {
  window.__oasisFlags = () => {
    const enabled = Object.entries(FEATURES).filter(([, v]) => v).map(([k]) => k);
    const disabled = Object.entries(FEATURES).filter(([, v]) => !v).map(([k]) => k);
    console.group('🏥 OASIS Feature Flags');
    console.log('%c✅ Enabled:', 'color: green; font-weight: bold;', enabled.length ? enabled : '(none)');
    console.log('%c🔒 Disabled:', 'color: gray;', disabled);
    console.groupEnd();
    return FEATURES;
  };
}
