-- ============================================================
-- PROJECT OASIS — Migration 003: Audit Log System
-- ============================================================
-- TRẠNG THÁI: ⏸️  CHƯA CHẠY
--
-- Mục đích:
--   1. Tạo bảng surgery_audit_log
--   2. Trigger tự động ghi log khi surgeries thay đổi
--   3. RLS: chỉ admin đọc được log
--
-- Yêu cầu:
--   - Migration 001 và 002 đã chạy thành công
--
-- Sau khi chạy:
--   Bật FEATURES.AUDIT_LOG_ENABLED = true trong featureFlags.js
-- ============================================================

-- ============================================================
-- 1. Bảng Audit Log
-- ============================================================
CREATE TABLE IF NOT EXISTS surgery_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id  TEXT NOT NULL,

  -- Loại hành động
  action      TEXT NOT NULL CHECK (action IN (
    'created',           -- Thêm ca mới
    'updated',           -- Sửa thông tin ca
    'deleted',           -- Xoá ca
    'moved_shift',       -- Kéo sang buổi khác (waiting/morning/afternoon)
    'marked_completed',  -- Đánh dấu đã mổ xong
    'marked_postponed',  -- Hoãn ca
    'marked_cancelled',  -- Huỷ ca
    'restored',          -- Khôi phục từ history
    'scheduled',         -- Xếp lịch (từ waiting → morning/afternoon)
    'program_locked',    -- Chốt chương trình mổ
    'program_unlocked'   -- Mở khóa chương trình mổ
  )),

  -- Ai thực hiện
  actor_id    UUID REFERENCES auth.users(id),
  actor_name  TEXT,             -- Denormalized để không mất log khi user bị xoá
  actor_role  TEXT,             -- Role tại thời điểm thực hiện

  -- Dữ liệu trước/sau
  before_data JSONB,            -- null nếu action = 'created'
  after_data  JSONB,            -- null nếu action = 'deleted'

  -- Thông tin bổ sung
  ip_address  TEXT,             -- IP nếu có (future)
  notes       TEXT,             -- Ghi chú thêm (vd: lý do huỷ)

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index để query nhanh theo surgery hoặc theo thời gian
CREATE INDEX IF NOT EXISTS idx_audit_surgery_id ON surgery_audit_log (surgery_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON surgery_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON surgery_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON surgery_audit_log (action);

-- ============================================================
-- 2. RLS — Chỉ admin đọc được
-- ============================================================
ALTER TABLE surgery_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log" ON surgery_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Chỉ hệ thống (SECURITY DEFINER functions) mới được ghi
-- Không có policy INSERT cho user thường → bảo toàn tính toàn vẹn

-- ============================================================
-- 3. Trigger tự động ghi log
-- ============================================================
CREATE OR REPLACE FUNCTION log_surgery_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  -- Xác định action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Phân loại update chi tiết hơn
    IF OLD.shift IS DISTINCT FROM NEW.shift THEN
      v_action := 'moved_shift';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      CASE NEW.status
        WHEN 'completed'  THEN v_action := 'marked_completed';
        WHEN 'postponed'  THEN v_action := 'marked_postponed';
        WHEN 'cancelled'  THEN v_action := 'marked_cancelled';
        WHEN 'scheduled'  THEN v_action := 'scheduled';
        ELSE v_action := 'updated';
      END CASE;
    ELSE
      v_action := 'updated';
    END IF;
  END IF;

  -- Lấy thông tin actor (nếu đang dùng auth)
  BEGIN
    SELECT display_name, role INTO v_actor_name, v_actor_role
    FROM user_profiles WHERE id = auth.uid() LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_actor_name := 'system';
    v_actor_role := 'system';
  END;

  -- Ghi log
  INSERT INTO surgery_audit_log (
    surgery_id, action,
    actor_id, actor_name, actor_role,
    before_data, after_data
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    v_action,
    auth.uid(),
    v_actor_name,
    v_actor_role,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn trigger vào bảng surgeries
CREATE OR REPLACE TRIGGER surgeries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON surgeries
  FOR EACH ROW EXECUTE FUNCTION log_surgery_changes();

-- ============================================================
-- 4. View tiện ích — Audit log dễ đọc
-- ============================================================
CREATE OR REPLACE VIEW surgery_audit_readable AS
SELECT
  al.id,
  al.surgery_id,
  al.action,
  al.actor_name,
  al.actor_role,
  al.notes,
  al.created_at,
  -- Thông tin ca mổ từ after_data hoặc before_data
  COALESCE(
    al.after_data->>'patient_name',
    al.before_data->>'patient_name'
  ) AS patient_name,
  COALESCE(
    al.after_data->>'shift',
    al.before_data->>'shift'
  ) AS shift,
  -- Thay đổi shift
  al.before_data->>'shift' AS shift_from,
  al.after_data->>'shift'  AS shift_to,
  -- Thay đổi status
  al.before_data->>'status' AS status_from,
  al.after_data->>'status'  AS status_to
FROM surgery_audit_log al
ORDER BY al.created_at DESC;
