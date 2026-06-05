# Project OASIS — Bảng dự kiến mổ nội bộ (v1.1.5)

> Ứng dụng xếp dự kiến mổ realtime cho khoa Ngoại — Powered by Aladinn 🧞

Chi tiết các phiên bản cập nhật xem tại [CHANGELOG.md](CHANGELOG.md).

## ✨ Tính năng

- **Kanban Drag & Drop** — Kéo thả dự kiến mổ giữa danh sách chờ, ca sáng, ca chiều
- **Business Rules Engine** — Cảnh báo quá tải buổi mổ và thao tác cần xác nhận
- **Realtime** — Nhiều người dùng thấy thay đổi ngay lập tức (qua Supabase)
- **Date Navigation** — Chuyển ngày xem bảng dự kiến mổ quá khứ/hiện tại/tương lai
- **Thống kê** — Tổng số dự kiến, ca cấp cứu và tải theo buổi
- **Toast Notifications** — Cảnh báo thông minh khi vi phạm nghiệp vụ
- **Offline Demo Mode** — Chạy với dữ liệu mẫu khi chưa cấu hình Supabase

## 🚀 Khởi động

```bash
npm install
npm run dev
```

## ⚡ Kết nối Supabase (để dùng thật)

1. Tạo project tại [supabase.com](https://supabase.com)
2. Chạy `supabase/schema.sql` trong SQL Editor
3. Đăng nhập Supabase CLI, hoặc đặt `SUPABASE_ACCESS_TOKEN` trong shell triển khai.
4. Set Edge Function secrets trước khi chặn direct write. Cách khuyến nghị là dùng Supabase secrets:

```bash
supabase login
supabase secrets set OASIS_EDIT_PASSCODE_SHA256=7b3c8f23a512a7fcb68eab1ae8c359dde7043cb84d63686ae71f0f47ea429a5a
supabase secrets set OASIS_CRYPTO_SECRET=<khóa-mã-hóa-PHI-hiện-hành>
# Khuyến nghị có để tách khóa ký phiên khỏi service-role secret:
supabase secrets set OASIS_EDIT_TOKEN_SECRET=<chuỗi-ngẫu-nhiên-dài>
# Chỉ cần nếu database còn dữ liệu mã hóa legacy bằng passphrase cũ:
supabase secrets set OASIS_LEGACY_CRYPTO_SECRET=<khóa-legacy-cũ>
```

Nếu môi trường triển khai chưa dùng được Supabase CLI secrets, chạy migration `supabase/migrations/007_runtime_config.sql` và lưu các giá trị tương đương vào bảng `oasis_runtime_config`. Bảng này bật RLS deny-all, chỉ Edge Function với service role đọc được. Không lưu các giá trị này trong frontend hay README.

5. Deploy Edge Function bảo mật thao tác ghi:

```bash
supabase functions deploy oasis-surgery-api
```

Mật khẩu người dùng nhập vẫn là mật khẩu chung hiện tại. Frontend chỉ nhận token phiên ngắn hạn từ backend và không còn tự so sánh mật khẩu.

6. Chạy migration `supabase/migrations/005_shared_passcode_write_security.sql` để tạo bảng rate-limit mở khóa. Migration này không chặn quyền ghi hiện tại.
7. Smoke test Edge Function trên staging/production. Smoke test không tạo/sửa/xóa ca mổ:

```bash
npm run smoke:supabase
```

Khi function đã đọc được dữ liệu, xác minh được mật khẩu và UI staging/preview chỉnh sửa được qua Edge Function, chạy migration `supabase/migrations/006_block_direct_client_writes.sql` để chặn anonymous write trực tiếp.
8. Tạo file `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

9. Restart `npm run dev`

## 🗂️ Cấu trúc

```
src/
├── components/     # UI Components
├── hooks/          # Data hooks (useSurgeries)
├── lib/            # Supabase client, mock data, business rules
supabase/
└── schema.sql      # Database schema
```
