-- ============================================================
-- PROJECT OASIS — Migration 005: Shared Passcode Unlock Attempts
-- ============================================================
-- Mục đích:
--   1. Tạo bảng ghi nhận lần mở khóa để Edge Function rate-limit.
--   2. Không thay đổi quyền đọc/ghi hiện tại của các bảng nghiệp vụ.
--
-- Yêu cầu sau khi chạy:
--   supabase secrets set OASIS_EDIT_PASSCODE_SHA256=<sha256 của mật khẩu chỉnh sửa>
--   supabase secrets set OASIS_EDIT_TOKEN_SECRET=<chuỗi ngẫu nhiên dài>
--   supabase secrets set OASIS_CRYPTO_SECRET=<khóa mã hóa PHI hiện hành>
--   supabase secrets set OASIS_LEGACY_CRYPTO_SECRET=<khóa legacy cũ, nếu còn dữ liệu cũ>
--   supabase functions deploy oasis-surgery-api
-- Nếu chưa dùng được CLI secrets, chạy migration 007 và lưu các giá trị tương
-- đương trong oasis_runtime_config. Bảng đó bị deny-all với client.
--
-- Sau khi smoke test function thành công, chạy migration 006 để chặn direct write.
-- ============================================================

CREATE TABLE IF NOT EXISTS edit_unlock_attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_fingerprint TEXT NOT NULL,
  success            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_unlock_attempts_fingerprint_created
  ON edit_unlock_attempts (client_fingerprint, created_at DESC);

ALTER TABLE edit_unlock_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to edit unlock attempts" ON edit_unlock_attempts;
CREATE POLICY "No direct client access to edit unlock attempts"
  ON edit_unlock_attempts
  FOR ALL
  USING (false)
  WITH CHECK (false);
