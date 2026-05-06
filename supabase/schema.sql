-- ============================================================
-- PROJECT OASIS — Supabase Schema
-- Chạy toàn bộ SQL này trong Supabase SQL Editor
-- ============================================================

-- 1. Surgeons
create table if not exists surgeons (
  id text primary key,
  name text not null,
  specialty text,
  avatar text default '👨‍⚕️',
  max_cases_per_day integer default 4,
  created_at timestamptz default now()
);

-- 2. Operating Rooms
create table if not exists operating_rooms (
  id text primary key,
  name text not null,
  code text not null,
  type text default 'Đại phẫu',
  capacity_per_shift integer default 3,
  created_at timestamptz default now()
);

-- 3. Surgeries (main table)
create table if not exists surgeries (
  id text primary key default gen_random_uuid()::text,
  patient_name text not null,
  patient_id text not null,
  age integer,
  gender text default 'male',
  diagnosis text,
  procedure text,
  priority text default 'elective' check (priority in ('elective','urgent','emergency')),
  status text default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  date date not null,
  shift text default 'waiting' check (shift in ('waiting','morning','afternoon')),
  start_time text,
  duration_minutes integer default 60,
  surgeon_id text references surgeons(id),
  room_id text references operating_rooms(id),
  anesthesia text,
  equipment text[] default '{}',
  notes text,
  order_in_shift integer default 999,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Enable Realtime
alter publication supabase_realtime add table surgeries;

-- 5. Row Level Security (cho phép tất cả khi dùng anon key — điều chỉnh theo nhu cầu)
alter table surgeries enable row level security;
alter table surgeons enable row level security;
alter table operating_rooms enable row level security;

create policy "Allow all" on surgeries for all using (true) with check (true);
create policy "Allow all" on surgeons for all using (true) with check (true);
create policy "Allow all" on operating_rooms for all using (true) with check (true);

-- 6. Seed dữ liệu ban đầu
insert into surgeons (id, name, specialty, avatar, max_cases_per_day) values
  ('s1', 'BS. CKII. Nguyễn Minh Tuấn', 'Ngoại tiêu hóa', '👨‍⚕️', 4),
  ('s2', 'BS. CKI. Trần Văn Hùng', 'Ngoại tổng quát', '👨‍⚕️', 3),
  ('s3', 'ThS. BS. Lê Thị Khánh', 'Ngoại chấn thương', '👩‍⚕️', 4),
  ('s4', 'BS. CKI. Phạm Đức Anh', 'Ngoại thần kinh', '👨‍⚕️', 3),
  ('s5', 'BS. CKII. Hoàng Thị Mai', 'Ngoại lồng ngực', '👩‍⚕️', 3)
on conflict (id) do nothing;

insert into operating_rooms (id, name, code, type, capacity_per_shift) values
  ('r1', 'Phòng Mổ 1', 'PM-01', 'Đại phẫu', 3),
  ('r2', 'Phòng Mổ 2', 'PM-02', 'Đại phẫu', 3),
  ('r3', 'Phòng Mổ 3', 'PM-03', 'Tiểu phẫu', 4),
  ('r4', 'Phòng Mổ Cấp cứu', 'PM-CC', 'Cấp cứu', 2)
on conflict (id) do nothing;
