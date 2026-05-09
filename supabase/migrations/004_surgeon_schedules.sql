-- ============================================================
-- PROJECT OASIS — Migration 004: Surgeon Schedules
-- ============================================================
-- TRẠNG THÁI: ⏸️  CHƯA CHẠY
--
-- Mục đích:
--   1. Bảng lịch trực của từng bác sĩ theo ngày
--   2. Scheduling engine dùng để kiểm tra availability trước khi xếp ca
--
-- Yêu cầu:
--   - Migrations 001, 002, 003 đã chạy
--
-- Sau khi chạy:
--   Bật FEATURES.SURGEON_AVAILABILITY = true trong featureFlags.js
-- ============================================================

-- ============================================================
-- 1. Bảng Lịch Trực Bác Sĩ
-- ============================================================
CREATE TABLE IF NOT EXISTS surgeon_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_id    TEXT NOT NULL REFERENCES surgeons(id) ON DELETE CASCADE,
  date          DATE NOT NULL,

  -- Ca trực
  shift         TEXT NOT NULL CHECK (shift IN (
    'morning',    -- Trực ca sáng
    'afternoon',  -- Trực ca chiều
    'all_day',    -- Trực cả ngày
    'on_call',    -- Trực gọi (cấp cứu)
    'off'         -- Nghỉ / không trực
  )),

  -- Metadata
  is_lead       BOOLEAN DEFAULT FALSE,   -- Bác sĩ chính (không phải phụ mổ)
  max_cases     INTEGER DEFAULT NULL,    -- Override max_cases_per_day của surgeon
  note          TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(surgeon_id, date, shift)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_surgeon_schedule_date ON surgeon_schedules (date);
CREATE INDEX IF NOT EXISTS idx_surgeon_schedule_surgeon ON surgeon_schedules (surgeon_id, date);

-- RLS
ALTER TABLE surgeon_schedules ENABLE ROW LEVEL SECURITY;

-- Mọi user đăng nhập xem được lịch trực
CREATE POLICY "authenticated_read_schedules" ON surgeon_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin và scheduler quản lý lịch trực
CREATE POLICY "scheduler_manage_schedules" ON surgeon_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'scheduler')
    )
  );

-- ============================================================
-- 2. Bảng Operating Room Schedules (optional, cho tương lai)
-- ============================================================
-- Quản lý phòng mổ nào được dùng ngày nào (bảo trì, dọn dẹp...)

CREATE TABLE IF NOT EXISTS room_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL REFERENCES operating_rooms(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  reason      TEXT,    -- Lý do không available (vd: "Bảo trì định kỳ")
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, date)
);

ALTER TABLE room_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_room_schedules" ON room_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_room_schedules" ON room_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. View — Surgeon availability cho một ngày cụ thể
-- ============================================================
CREATE OR REPLACE VIEW surgeon_daily_availability AS
SELECT
  s.id AS surgeon_id,
  s.name AS surgeon_name,
  s.max_cases_per_day,
  ss.date,
  ss.shift,
  ss.is_lead,
  COALESCE(ss.max_cases, s.max_cases_per_day) AS effective_max_cases,
  -- Đếm số ca đã xếp
  COUNT(surg.id) FILTER (WHERE surg.status = 'scheduled') AS scheduled_cases,
  -- Còn slot không
  COALESCE(ss.max_cases, s.max_cases_per_day) - COUNT(surg.id) FILTER (
    WHERE surg.status = 'scheduled'
  ) AS remaining_slots
FROM surgeons s
LEFT JOIN surgeon_schedules ss ON ss.surgeon_id = s.id
LEFT JOIN surgeries surg ON surg.surgeon_id = s.id AND surg.date = ss.date
WHERE ss.shift != 'off'
GROUP BY s.id, s.name, s.max_cases_per_day, ss.date, ss.shift, ss.is_lead, ss.max_cases;

-- ============================================================
-- 4. Seed lịch trực mẫu (comment out, chạy thủ công sau)
-- ============================================================
-- INSERT INTO surgeon_schedules (surgeon_id, date, shift, is_lead) VALUES
--   ('s1', CURRENT_DATE, 'morning', true),
--   ('s2', CURRENT_DATE, 'afternoon', true),
--   ('s3', CURRENT_DATE, 'all_day', true),
--   ('s1', CURRENT_DATE + 1, 'on_call', false),
--   ('s4', CURRENT_DATE + 1, 'morning', true);
