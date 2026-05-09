/**
 * ============================================================
 * PROJECT OASIS — Hook: useSchedulerEngine
 * ============================================================
 *
 * TRẠNG THÁI: ⏸️  SKELETON — CHƯA KẾT NỐI VÀO APP
 *
 * Khi FEATURES.SCHEDULER_ENGINE = true:
 *   1. Trong SurgeryModal: gọi validate() trước khi save
 *   2. Khi kéo thả: gọi validate() trước khi moveSurgery()
 *   3. Hiện ConflictWarning.jsx nếu có conflicts
 *   4. Hiện SlotSuggestion.jsx với gợi ý buổi
 *
 * Yêu cầu:
 *   - NORMALIZED_SCHEMA = true (cần cột implant_required, needs_carm...)
 *   - Migration 004 chạy xong (để check surgeon availability)
 * ============================================================
 */

import { useState, useCallback } from 'react';
import { validateScheduling, suggestBestSlot, detectBoardConflicts } from '../lib/scheduler/engine.js';
import { FEATURES } from '../lib/featureFlags.js';

export function useSchedulerEngine() {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState(null);

  /**
   * Validate một ca trước khi xếp vào buổi.
   * Safe no-op khi FEATURES.SCHEDULER_ENGINE = false.
   *
   * @param {Object} surgery       - Ca cần xếp
   * @param {string} targetDate    - Ngày xếp (YYYY-MM-DD)
   * @param {string} targetShift   - 'morning' | 'afternoon'
   * @param {Object} boardContext  - { surgeries, surgeonSchedules, roomSchedules, boardState }
   * @returns {{ valid, canForce, errors, warnings, infos }}
   */
  const validate = useCallback(async (surgery, targetDate, targetShift, boardContext) => {
    if (!FEATURES.SCHEDULER_ENGINE) {
      // No-op: trả về valid = true để app hoạt động bình thường
      return { valid: true, canForce: true, errors: [], warnings: [], infos: [] };
    }

    setIsValidating(true);
    try {
      const context = {
        targetDate,
        targetShift,
        scheduledSurgeries: (boardContext.surgeries || []).filter(s =>
          s.date === targetDate && ['morning', 'afternoon'].includes(s.shift)
        ),
        surgeonSchedules: boardContext.surgeonSchedules || [],
        roomSchedules: boardContext.roomSchedules || [],
        boardState: boardContext.boardState,
      };

      const result = validateScheduling(surgery, context);
      setLastValidation(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  /**
   * Gợi ý slot tốt nhất cho một ca.
   * Safe no-op khi FEATURES.SCHEDULER_ENGINE = false.
   *
   * @param {Object} surgery
   * @param {Object} boardContext
   * @returns {Array<{ date, shift, score, reasons, conflicts }>}
   */
  const suggest = useCallback((surgery, boardContext) => {
    if (!FEATURES.SCHEDULER_ENGINE) return [];
    return suggestBestSlot(surgery, boardContext);
  }, []);

  /**
   * Kiểm tra toàn bộ board và trả về danh sách xung đột.
   * Dùng để hiện "board health indicator" trong dashboard.
   *
   * @param {Array}  surgeries
   * @param {Object} boardContext
   * @returns {Array<{ surgeryId, surgery, conflicts }>}
   */
  const scanBoard = useCallback((surgeries, boardContext) => {
    if (!FEATURES.SCHEDULER_ENGINE) return [];
    return detectBoardConflicts(surgeries, boardContext);
  }, []);

  return {
    validate,
    suggest,
    scanBoard,
    isValidating,
    lastValidation,
  };
}
