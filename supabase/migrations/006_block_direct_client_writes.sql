-- ============================================================
-- PROJECT OASIS — Migration 006: Block Direct Client Writes
-- ============================================================
-- Mục đích:
--   1. Giữ anonymous/client quyền đọc lịch mổ và metadata cần thiết.
--   2. Chặn anonymous/client INSERT/UPDATE/DELETE trực tiếp.
--   3. Buộc mọi thao tác ghi đi qua Edge Function oasis-surgery-api.
--
-- Chỉ chạy sau khi:
--   - Migration 005 đã chạy.
--   - Edge Function oasis-surgery-api đã deploy.
--   - OASIS_EDIT_PASSCODE_SHA256, OASIS_EDIT_TOKEN_SECRET,
--     OASIS_CRYPTO_SECRET đã được set qua Supabase secrets hoặc
--     oasis_runtime_config.
--   - Smoke test read + verify passcode đã đạt.
--   - UI staging/preview đã ghi qua Edge Function thành công.
-- ============================================================

-- 1. Surgeries: client đọc được, nhưng không ghi trực tiếp.
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON surgeries;
DROP POLICY IF EXISTS "anon_read_surgeries" ON surgeries;
DROP POLICY IF EXISTS "authenticated_read_surgeries" ON surgeries;
DROP POLICY IF EXISTS "scheduler_insert_surgeries" ON surgeries;
DROP POLICY IF EXISTS "scheduler_update_surgeries" ON surgeries;
DROP POLICY IF EXISTS "admin_delete_surgeries" ON surgeries;

CREATE POLICY "anon_read_surgeries" ON surgeries
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Surgeons/rooms: giữ quyền đọc metadata, chặn ghi trực tiếp.
ALTER TABLE surgeons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON surgeons;
DROP POLICY IF EXISTS "anon_read_surgeons" ON surgeons;
DROP POLICY IF EXISTS "authenticated_read_surgeons" ON surgeons;
DROP POLICY IF EXISTS "admin_manage_surgeons" ON surgeons;

CREATE POLICY "anon_read_surgeons" ON surgeons
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE operating_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON operating_rooms;
DROP POLICY IF EXISTS "anon_read_operating_rooms" ON operating_rooms;
DROP POLICY IF EXISTS "authenticated_read_rooms" ON operating_rooms;
DROP POLICY IF EXISTS "admin_manage_rooms" ON operating_rooms;

CREATE POLICY "anon_read_operating_rooms" ON operating_rooms
  FOR SELECT
  TO anon, authenticated
  USING (true);
