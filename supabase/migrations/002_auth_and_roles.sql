-- ============================================================
-- PROJECT OASIS — Migration 002: Auth & Role-Based Access
-- ============================================================
-- TRẠNG THÁI: ⏸️  CHƯA CHẠY
--
-- Mục đích:
--   1. Tạo bảng user_profiles với role system
--   2. Thay thế RLS "Allow all" bằng policies thật sự
--   3. Bảo vệ các bảng surgeons và operating_rooms
--
-- Yêu cầu trước khi chạy:
--   - Supabase Auth đã được bật (mặc định đã bật)
--   - Migration 001 đã chạy thành công
--   - Đã tạo ít nhất 1 user trong Supabase Auth để làm admin
--
-- Sau khi chạy:
--   1. Vào bảng user_profiles, set role = 'admin' cho tài khoản admin đầu tiên
--   2. Bật FEATURES.AUTH_ENABLED = true trong featureFlags.js
--
-- CẢNH BÁO: Sau khi chạy migration này, anon key sẽ không còn
--   quyền write vào DB. App phải dùng Supabase Auth.
-- ============================================================

-- ============================================================
-- 1. Bảng User Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'scheduler', 'nurse', 'viewer')),
  department    TEXT DEFAULT 'CTCH',
  employee_id   TEXT UNIQUE,           -- Mã nhân viên nội bộ
  avatar        TEXT DEFAULT '👤',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime cho user_profiles (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

-- RLS cho user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Mọi user đã đăng nhập xem được profile của chính họ
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin xem được tất cả profiles
CREATE POLICY "admin_read_all_profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Chỉ admin mới tạo/sửa profile người khác
CREATE POLICY "admin_manage_profiles" ON user_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. Xoá RLS "Allow all" → Thay bằng role-based policies
-- ============================================================

-- SURGERIES TABLE
DROP POLICY IF EXISTS "Allow all" ON surgeries;

-- Mọi user đã đăng nhập có thể xem
CREATE POLICY "authenticated_read_surgeries" ON surgeries
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- scheduler + admin thêm ca
CREATE POLICY "scheduler_insert_surgeries" ON surgeries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'scheduler') AND is_active = TRUE
    )
  );

-- scheduler + nurse + admin sửa ca
-- (nurse chỉ sửa status: in_progress, completed — enforce ở app level)
CREATE POLICY "scheduler_update_surgeries" ON surgeries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'scheduler', 'nurse') AND is_active = TRUE
    )
  );

-- Chỉ admin mới xoá ca
CREATE POLICY "admin_delete_surgeries" ON surgeries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- SURGEONS TABLE
DROP POLICY IF EXISTS "Allow all" ON surgeons;

CREATE POLICY "authenticated_read_surgeons" ON surgeons
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_surgeons" ON surgeons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- OPERATING ROOMS TABLE
DROP POLICY IF EXISTS "Allow all" ON operating_rooms;

CREATE POLICY "authenticated_read_rooms" ON operating_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_rooms" ON operating_rooms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. Function Helper — Lấy role của user hiện tại
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- 4. Trigger — Auto-create profile khi user mới đăng ký
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, 'Người dùng mới'),
    'viewer'  -- Mặc định là viewer, admin tự nâng role sau
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. Seed admin đầu tiên (THAY UUID BÊN DƯỚI)
-- ============================================================
-- Sau khi tạo account trong Supabase Auth, lấy UUID từ Dashboard
-- và chạy lệnh này để set role admin:
--
-- INSERT INTO user_profiles (id, display_name, role, department)
-- VALUES (
--   'YOUR-USER-UUID-HERE',
--   'Admin OASIS',
--   'admin',
--   'CTCH'
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
