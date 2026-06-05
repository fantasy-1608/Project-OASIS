-- ============================================================
-- PROJECT OASIS — Migration 007: Server-side Runtime Config
-- ============================================================
-- Mục đích:
--   Lưu các cấu hình runtime chỉ Edge Function dùng khi chưa thể set
--   Supabase Edge Function secrets qua CLI/Dashboard.
--
-- Bảng này bật RLS và không có policy mở cho anon/authenticated.
-- Edge Function dùng service role nên vẫn đọc được.
-- ============================================================

CREATE TABLE IF NOT EXISTS oasis_runtime_config (
  name         TEXT PRIMARY KEY,
  secret_value TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE oasis_runtime_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to oasis runtime config" ON oasis_runtime_config;
CREATE POLICY "No direct client access to oasis runtime config"
  ON oasis_runtime_config
  FOR ALL
  USING (false)
  WITH CHECK (false);
