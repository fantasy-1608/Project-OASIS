-- ============================================================
-- PROJECT OASIS — Migration 001: Normalize Schema
-- ============================================================
-- TRẠNG THÁI: ⏸️  CHƯA CHẠY
--
-- Mục đích:
--   1. Thêm các cột CTCH-specific vào bảng surgeries
--   2. Thêm readiness checklist fields
--   3. Thêm audit metadata (created_by, source)
--
-- Yêu cầu trước khi chạy:
--   - Backup toàn bộ bảng surgeries
--   - Chạy script backfill: scripts/migrate_notes_to_columns.js
--
-- Cách chạy:
--   Supabase Dashboard → SQL Editor → Paste & Run
--   HOẶC: supabase db push (nếu dùng CLI)
--
-- Sau khi chạy:
--   Bật FEATURES.NORMALIZED_SCHEMA = true trong featureFlags.js
-- ============================================================

-- 1. Thêm cột phương pháp mổ (tách khỏi JSON trong notes)
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS surgical_method TEXT;

-- 2. Thêm cột ngày nhập viện (tách khỏi JSON trong notes)
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS admission_date DATE;

-- 3. Loại phẫu thuật (chi tiết hơn priority hiện tại)
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS surgery_type TEXT DEFAULT 'elective'
    CHECK (surgery_type IN ('elective', 'semi_urgent', 'emergency', 're_operation'));

-- 4. Vùng giải phẫu (đặc thù CTCH)
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS body_region TEXT
    CHECK (body_region IN (
      'upper_limb',   -- Chi trên
      'lower_limb',   -- Chi dưới
      'hip',          -- Háng
      'spine',        -- Cột sống
      'soft_tissue',  -- Phần mềm
      'infection',    -- Nhiễm trùng
      'other'
    ));

-- 5. Bên mổ
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS operated_side TEXT
    CHECK (operated_side IN ('left', 'right', 'bilateral', 'none'));

-- 6. Tư thế mổ
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS surgical_position TEXT;

-- 7. Cần C-arm không
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS needs_carm BOOLEAN DEFAULT FALSE;

-- 8. Cần truyền máu
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS needs_blood BOOLEAN DEFAULT FALSE;

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS blood_units INTEGER DEFAULT 0;

-- 9. Implant (mảng tên implant cần chuẩn bị)
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS implant_required TEXT[] DEFAULT '{}';

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS implant_ready BOOLEAN DEFAULT FALSE;

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS implant_notes TEXT;

-- 10. Nhân sự mổ bổ sung
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS assistant_surgeon TEXT;  -- BS phụ mổ

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS preferred_anesthetist TEXT;  -- BS gây mê mong muốn

-- 11. Audit metadata
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- 12. Nguồn nhập ca
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'his_extension', 'api', 'import'));

-- ============================================================
-- READINESS CHECKLIST — 6 boolean flags
-- ============================================================
-- Trước khi mổ, bệnh nhân cần có đủ các điều kiện này.
-- Dùng để tính "readiness score" trong dashboard.

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS ready_labs        BOOLEAN DEFAULT FALSE;  -- Xét nghiệm máu/nước tiểu
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS ready_imaging     BOOLEAN DEFAULT FALSE;  -- Phim X-quang / CT / MRI
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS ready_consent     BOOLEAN DEFAULT FALSE;  -- Ký cam kết phẫu thuật
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS ready_fasting     BOOLEAN DEFAULT FALSE;  -- Nhịn ăn theo quy trình
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS ready_antibiotics BOOLEAN DEFAULT FALSE;  -- Kháng sinh dự phòng
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS ready_insurance   BOOLEAN DEFAULT FALSE;  -- BHYT / thủ tục hành chính

-- ============================================================
-- COMPUTED HELPER (view) — Readiness score
-- ============================================================
-- View này tính % readiness cho mỗi ca. Dùng trong dashboard.

CREATE OR REPLACE VIEW surgery_readiness AS
SELECT
  id,
  patient_name,
  shift,
  date,
  (
    (ready_labs::int + ready_imaging::int + ready_consent::int +
     ready_fasting::int + ready_antibiotics::int + ready_insurance::int)
    * 100 / 6
  ) AS readiness_pct,
  CASE
    WHEN (ready_labs AND ready_imaging AND ready_consent AND
          ready_fasting AND ready_antibiotics AND ready_insurance)
    THEN 'ready'
    WHEN (ready_labs::int + ready_imaging::int + ready_consent::int +
          ready_fasting::int + ready_antibiotics::int + ready_insurance::int) >= 4
    THEN 'almost_ready'
    ELSE 'not_ready'
  END AS readiness_status
FROM surgeries
WHERE status = 'scheduled';

-- ============================================================
-- INDEX — Performance cho các query thường dùng
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_surgeries_date_shift ON surgeries (date, shift);
CREATE INDEX IF NOT EXISTS idx_surgeries_surgeon_date ON surgeries (surgeon_id, date);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON surgeries (status);
CREATE INDEX IF NOT EXISTS idx_surgeries_body_region ON surgeries (body_region);
