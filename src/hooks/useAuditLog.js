/**
 * ============================================================
 * PROJECT OASIS — Hook: useAuditLog
 * ============================================================
 *
 * TRẠNG THÁI: ⏸️  SKELETON — CHƯA KẾT NỐI VÀO APP
 *
 * Khi FEATURES.AUDIT_LOG_ENABLED = true + AUTH_ENABLED = true:
 *   - Admin có thể xem toàn bộ lịch sử thao tác
 *   - Hiện trong AuditLogModal (chưa tạo)
 *
 * Yêu cầu:
 *   - Migration 003_audit_log.sql đã chạy
 *   - User đang đăng nhập với role 'admin'
 * ============================================================
 */

import { useState, useCallback } from 'react';
// import { supabase } from '../lib/supabase'; // Uncomment khi kết nối

// ============================================================
// Action labels (tiếng Việt cho UI)
// ============================================================
export const AUDIT_ACTION_LABELS = {
  created:          '➕ Thêm ca mổ',
  updated:          '✏️ Cập nhật thông tin',
  deleted:          '🗑️ Xoá ca mổ',
  moved_shift:      '↔️ Chuyển buổi',
  marked_completed: '✅ Đánh dấu đã mổ',
  marked_postponed: '⏸️ Hoãn ca',
  marked_cancelled: '🚫 Huỷ ca',
  restored:         '🔄 Khôi phục ca',
  scheduled:        '📅 Xếp lịch',
  program_locked:   '🔒 Chốt chương trình',
  program_unlocked: '🔓 Mở chốt chương trình',
};

export function useAuditLog() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Tải audit log cho một ca mổ cụ thể hoặc theo ngày
   * @param {Object} options
   * @param {string} [options.surgeryId]
   * @param {string} [options.date]       - Lọc theo ngày (YYYY-MM-DD)
   * @param {number} [options.limit]      - Số records tối đa (mặc định 50)
   */
  const fetchLogs = useCallback(async (_options = {}) => {
    setIsLoading(true);
    setError(null);

    // TODO: Uncomment khi FEATURES.AUDIT_LOG_ENABLED = true
    // try {
    //   let query = supabase
    //     .from('surgery_audit_readable')
    //     .select('*')
    //     .order('created_at', { ascending: false })
    //     .limit(options.limit || 50);
    //
    //   if (options.surgeryId) query = query.eq('surgery_id', options.surgeryId);
    //   if (options.date) {
    //     query = query.gte('created_at', `${options.date}T00:00:00`)
    //                  .lte('created_at', `${options.date}T23:59:59`);
    //   }
    //
    //   const { data, error } = await query;
    //   if (error) throw error;
    //   setLogs(data || []);
    // } catch (err) {
    //   setError(err);
    // } finally {
    //   setIsLoading(false);
    // }

    console.warn('[useAuditLog] fetchLogs: AUDIT_LOG_ENABLED is false. Returning empty logs.');
    setLogs([]);
    setIsLoading(false);
  }, []);

  /**
   * Ghi log thủ công (dùng cho các action không qua DB trigger)
   * Ví dụ: program_locked, program_unlocked
   */
  const writeLog = useCallback(async (surgeryId, action, options = {}) => {
    // TODO: Uncomment khi FEATURES.AUDIT_LOG_ENABLED = true
    // await supabase.from('surgery_audit_log').insert([{
    //   surgery_id: surgeryId,
    //   action,
    //   notes: options.notes,
    //   before_data: options.beforeData,
    //   after_data: options.afterData,
    // }]);

    if (import.meta.env.DEV) {
      console.info(`[useAuditLog] writeLog (no-op): ${action} on ${surgeryId}`, options);
    }
  }, []);

  return {
    logs,
    isLoading,
    error,
    fetchLogs,
    writeLog,
    getActionLabel: (action) => AUDIT_ACTION_LABELS[action] || action,
  };
}
