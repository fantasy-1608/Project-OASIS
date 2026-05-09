/**
 * ============================================================
 * PROJECT OASIS — Scheduler Engine
 * ============================================================
 *
 * TRẠNG THÁI: ⏸️  CHƯA KẾT NỐI VÀO APP
 *
 * Khi FEATURES.SCHEDULER_ENGINE = true:
 *   - Mỗi lần kéo thả hoặc xếp lịch, engine sẽ chạy trước
 *   - Trả về conflicts (errors/warnings) và suggestions
 *   - App quyết định có block hay chỉ hiện warning
 * ============================================================
 */

import { CTCH_RULES, CTCH_CONFIG } from './rules.js';

// ============================================================
// 1. Validate — Kiểm tra một ca trước khi xếp vào buổi
// ============================================================
/**
 * Chạy tất cả rules và trả về kết quả.
 *
 * @param {Object} surgery          - Ca mổ cần kiểm tra
 * @param {Object} context          - Context (scheduledSurgeries, surgeonSchedules...)
 * @param {Array}  [rules]          - Danh sách rules (mặc định: CTCH_RULES)
 * @returns {{
 *   valid: boolean,
 *   canForce: boolean,             - Có thể force qua sau khi confirm không
 *   errors: Array,                 - severity = 'error' và valid = false
 *   warnings: Array,               - severity = 'warning' và valid = false
 *   infos: Array,                  - severity = 'info'
 * }}
 */
export function validateScheduling(surgery, context, rules = CTCH_RULES) {
  const errors = [];
  const warnings = [];
  const infos = [];

  for (const rule of rules) {
    let result;
    try {
      result = rule.check(surgery, context);
    } catch (err) {
      console.warn(`[SchedulerEngine] Rule "${rule.id}" threw an error:`, err);
      continue;
    }

    if (!result.valid || result.message) {
      const item = {
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        message: result.message,
        valid: result.valid,
      };

      if (rule.severity === 'error' && !result.valid) {
        errors.push(item);
      } else if (rule.severity === 'warning' && !result.valid) {
        warnings.push(item);
      } else if (rule.severity === 'info' && result.message) {
        infos.push(item);
      }
    }
  }

  return {
    valid: errors.length === 0,      // false nếu có bất kỳ error nào
    canForce: errors.length === 0,   // Chỉ force được khi không có error, chỉ có warning
    errors,
    warnings,
    infos,
  };
}

// ============================================================
// 2. Suggest — Đề xuất buổi/ngày phù hợp nhất
// ============================================================
/**
 * Gợi ý các slot tốt nhất cho một ca mổ.
 *
 * @param {Object} surgery          - Ca cần xếp
 * @param {Object} boardContext     - Thông tin board (surgeries, schedules...)
 * @param {Object} options
 * @param {number} options.daysAhead  - Số ngày tìm trước (mặc định: 7)
 * @param {number} options.maxResults - Số kết quả tối đa (mặc định: 3)
 * @returns {Array<{
 *   date: string,
 *   shift: string,
 *   score: number,         - 0–100, cao hơn là tốt hơn
 *   reasons: string[],     - Vì sao gợi ý slot này
 *   conflicts: Array,      - Warnings (không phải errors) cần lưu ý
 * }>}
 */
export function suggestBestSlot(surgery, boardContext, options = {}) {
  const { daysAhead = 7, maxResults = 3 } = options;
  const results = [];

  const today = new Date();
  const shifts = ['morning', 'afternoon'];

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    for (const shift of shifts) {
      const context = buildContext(dateStr, shift, boardContext);
      const validation = validateScheduling(surgery, context);

      // Bỏ qua nếu có blocking errors
      if (!validation.valid) continue;

      // Tính score
      const score = calculateScore(surgery, context, validation);

      results.push({
        date: dateStr,
        shift,
        score,
        reasons: buildReasons(surgery, context, score),
        conflicts: validation.warnings,
      });
    }
  }

  // Sort theo score giảm dần, lấy top maxResults
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// ============================================================
// 3. Conflict Detection — Phát hiện xung đột trong board
// ============================================================
/**
 * Quét toàn bộ board và trả về danh sách xung đột.
 * Dùng cho "board health check" khi load app hoặc theo request.
 *
 * @param {Array}  surgeries   - Tất cả ca đã xếp
 * @param {Object} boardContext
 * @returns {Array<{ surgeryId, surgery, conflicts: Array }>}
 */
export function detectBoardConflicts(surgeries, boardContext) {
  const conflictedSurgeries = [];

  for (const surgery of surgeries) {
    if (!['morning', 'afternoon'].includes(surgery.shift)) continue;

    const context = buildContext(surgery.date, surgery.shift, boardContext);
    // Loại ca hiện tại ra khỏi scheduledSurgeries để tránh self-conflict
    context.scheduledSurgeries = context.scheduledSurgeries.filter(s => s.id !== surgery.id);

    const validation = validateScheduling(surgery, context);

    if (!validation.valid || validation.warnings.length > 0) {
      conflictedSurgeries.push({
        surgeryId: surgery.id,
        surgery,
        conflicts: [...validation.errors, ...validation.warnings],
      });
    }
  }

  return conflictedSurgeries;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Build context object từ boardContext cho một ngày/buổi cụ thể
 */
function buildContext(targetDate, targetShift, boardContext) {
  return {
    targetDate,
    targetShift,
    scheduledSurgeries: (boardContext.surgeries || []).filter(s =>
      s.date === targetDate && ['morning', 'afternoon'].includes(s.shift)
    ),
    surgeonSchedules: (boardContext.surgeonSchedules || []).filter(ss =>
      ss.date === targetDate
    ),
    roomSchedules: (boardContext.roomSchedules || []).filter(rs =>
      rs.date === targetDate
    ),
    boardState: boardContext.boardState,
  };
}

/**
 * Tính score cho một slot (0–100)
 * Cao hơn = tốt hơn cho bệnh nhân và hệ thống
 */
function calculateScore(surgery, context, validation) {
  let score = 100;

  // Trừ điểm cho mỗi warning
  score -= validation.warnings.length * 10;

  // Trừ điểm nếu buổi đã đông
  const { targetShift, scheduledSurgeries } = context;
  const maxCases = targetShift === 'morning'
    ? CTCH_CONFIG.MAX_CASES_MORNING
    : CTCH_CONFIG.MAX_CASES_AFTERNOON;
  const inShift = scheduledSurgeries.filter(s => s.shift === targetShift).length;
  const utilizationPct = (inShift / maxCases) * 100;
  score -= utilizationPct * 0.3; // Trừ tối đa 30 điểm nếu đầy

  // Bonus nếu ca cấp cứu → ưu tiên slot gần nhất
  if (surgery.priority === 'emergency') {
    score += 50;
  }

  // Bonus nếu implant đã sẵn sàng
  if (surgery.implant_required?.length && surgery.implant_ready) {
    score += 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Build mảng reasons giải thích vì sao gợi ý slot này
 */
function buildReasons(surgery, context, score) {
  const reasons = [];
  const { targetShift, scheduledSurgeries } = context;

  const inShift = scheduledSurgeries.filter(s => s.shift === targetShift).length;
  const maxCases = targetShift === 'morning'
    ? CTCH_CONFIG.MAX_CASES_MORNING
    : CTCH_CONFIG.MAX_CASES_AFTERNOON;

  if (inShift < maxCases * 0.5) {
    reasons.push(`Buổi còn ${maxCases - inShift} slot trống`);
  }

  if (surgery.priority === 'emergency') {
    reasons.push('Ca cấp cứu — slot sớm nhất khả dụng');
  }

  if (score >= 80) {
    reasons.push('Ít xung đột nhất');
  }

  return reasons;
}
