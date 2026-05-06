# Project OASIS — Surgical Scheduling Dashboard

> Ứng dụng quản lý lịch mổ realtime cho khoa Ngoại — Powered by Aladinn 🧞

## ✨ Tính năng

- **Kanban Drag & Drop** — Kéo thả ca mổ giữa danh sách chờ, ca sáng, ca chiều
- **Business Rules Engine** — Cảnh báo tự động khi trùng bác sĩ, quá tải phòng mổ
- **Realtime** — Nhiều người dùng thấy thay đổi ngay lập tức (qua Supabase)
- **Date Navigation** — Chuyển ngày xem lịch mổ quá khứ/hiện tại/tương lai
- **Thống kê** — Sidebar thống kê tổng ca, ca cấp cứu, utilization phòng mổ
- **Toast Notifications** — Cảnh báo thông minh khi vi phạm nghiệp vụ
- **Offline Demo Mode** — Chạy với mock data khi chưa có Supabase

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
