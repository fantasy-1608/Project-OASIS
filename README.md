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
3. Tạo file `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

4. Restart `npm run dev`

## 🗂️ Cấu trúc

```
src/
├── components/     # UI Components
├── hooks/          # Data hooks (useSurgeries)
├── lib/            # Supabase client, mock data, business rules
supabase/
└── schema.sql      # Database schema
```
