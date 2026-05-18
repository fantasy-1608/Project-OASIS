/**
 * ============================================================
 * PROJECT OASIS — Hook: useAuditLog
 * ============================================================
 *
 * Phase 2 — Kích hoạt Audit Log
 *
 * Khi FEATURES.AUDIT_LOG_ENABLED = true:
 *   - Đọc log từ surgery_audit_readable view
 *   - Ghi log thủ công cho các action không qua DB trigger
 *
 * Khi FEATURES.AUDIT_LOG_ENABLED = false:
 *   - Hoạt động như no-op, không ảnh hưởng app
 *
 * Yêu cầu:
 *   - Migration 003_audit_log.sql đã chạy
 *   - Migration 002_auth_and_roles.sql đã chạy
 * ============================================================
 */

import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isEnabled } from '../lib/featureFlags';

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
  const fetchLogs = useCallback(async (options = {}) => {
    if (!isEnabled('AUDIT_LOG_ENABLED') || !isSupabaseConfigured || !supabase) {
      if (import.meta.env.DEV) {
        console.info('[useAuditLog] fetchLogs: AUDIT_LOG_ENABLED is false or Supabase not configured.');
      }
      setLogs([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('surgery_audit_readable')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

      if (options.surgeryId) query = query.eq('surgery_id', options.surgeryId);
      if (options.date) {
        query = query.gte('created_at', `${options.date}T00:00:00`)
                     .lte('created_at', `${options.date}T23:59:59`);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err) {
      setError(err);
      console.error('[useAuditLog] fetchLogs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Ghi log thủ công (dùng cho các action không qua DB trigger)
   * Ví dụ: program_locked, program_unlocked
   */
  const writeLog = useCallback(async (surgeryId, action, options = {}) => {
    if (!isEnabled('AUDIT_LOG_ENABLED') || !isSupabaseConfigured || !supabase) {
      if (import.meta.env.DEV) {
        console.info(`[useAuditLog] writeLog (no-op): ${action} on ${surgeryId}`, options);
      }
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('surgery_audit_log')
        .insert([{
          surgery_id: surgeryId,
          action,
          notes: options.notes,
          before_data: options.beforeData,
          after_data: options.afterData,
        }]);

      if (insertError) {
        console.error('[useAuditLog] writeLog error:', insertError);
      }
    } catch (err) {
      console.error('[useAuditLog] writeLog error:', err);
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
