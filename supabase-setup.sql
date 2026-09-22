-- Cheese.Graduation booking system
-- Chạy TOÀN BỘ file này trong Supabase > SQL Editor.
-- Sau đó thay email admin ở cuối file.

create extension if not exists pgcrypto;

create table if not exists public.photographers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  team text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.photographers (slug, name, team) values
  ('quang-anh','Quang Anh','Founder'),
  ('chi','Chi','Ekip 1'),
  ('minh','Minh','Ekip 1'),
  ('ngoc-hoang','Ngọc Hoàng','Ekip 2'),
  ('minh-anh','Minh Anh','Ekip 2'),
  ('quang-vinh','Quang Vinh','Ekip 3')
on conflict (slug) do update set name = excluded.name, team = excluded.team;



-- ============================================================
-- PHOTOGRAPHER CMS / PROFILE FIELDS
-- ============================================================
alter table public.photographers add column if not exists price_amount bigint not null default 0;
alter table public.photographers add column if not exists price_label text;
alter table public.photographers add column if not exists style text;
alter table public.photographers add column if not exists bio text;
alter table public.photographers add column if not exists tags text[] not null default '{}'::text[];
alter table public.photographers add column if not exists cover_url text;
alter table public.photographers add column if not exists gallery_urls text[] not null default '{}'::text[];
alter table public.photographers add column if not exists sort_order integer not null default 100;
alter table public.photographers add column if not exists rating numeric(3,1);
alter table public.photographers add column if not exists shoots_count integer not null default 0;
alter table public.photographers add column if not exists location_text text not null default 'Hà Nội';
alter table public.photographers add column if not exists drive_url text;
alter table public.photographers add column if not exists yearbook_prices jsonb not null default '{}'::jsonb;
alter table public.photographers add column if not exists graduation_prices jsonb not null default '{}'::jsonb;
alter table public.photographers add column if not exists graduation_extra_per_person bigint not null default 300000;
alter table public.photographers add column if not exists services jsonb not null default '[
  {"name":"Bong bóng / khói màu","value":"Cần xác nhận"},
  {"name":"Đèn flash & đèn liên tục","value":"Cần xác nhận"},
  {"name":"Trang phục & phụ kiện","value":"Cần xác nhận"},
  {"name":"Trợ lý đi cùng","value":"Cần xác nhận"},
  {"name":"Bàn giao file ảnh gốc","value":"Cần xác nhận"}
]'::jsonb;
alter table public.photographers add column if not exists updated_at timestamptz not null default now();

update public.photographers set
  price_amount = case slug
    when 'quang-anh' then 2300000 when 'chi' then 2800000 when 'minh' then 2500000
    when 'ngoc-hoang' then 3100000 else price_amount end,
  price_label = case when slug in ('minh-anh','quang-vinh') then 'Liên hệ' else price_label end,
  style = coalesce(style, case slug
    when 'quang-anh' then 'Film · Kỷ Yếu · Tốt nghiệp'
    when 'chi' then 'Editorial · Đèn'
    when 'minh' then 'Film · Vintage'
    when 'ngoc-hoang' then 'Cinematic · Flash'
    when 'minh-anh' then 'Chân dung'
    when 'quang-vinh' then 'Ảnh nhóm' end),
  tags = case when cardinality(tags)=0 then case slug
    when 'quang-anh' then array['Film','Kỷ Yếu','Tốt Nhiệp']
    when 'chi' then array['Editorial','Đèn']
    when 'minh' then array['Film','Vintage']
    when 'ngoc-hoang' then array['Cinematic','Flash']
    when 'minh-anh' then array['Chân dung']
    when 'quang-vinh' then array['Ảnh nhóm'] else tags end else tags end,
  sort_order = case slug
    when 'quang-anh' then 10 when 'chi' then 20 when 'minh' then 30
    when 'ngoc-hoang' then 40 when 'minh-anh' then 50 when 'quang-vinh' then 60 else sort_order end;


-- Giá riêng theo từng photographer cho Kỷ yếu / Tốt nghiệp đại học.
-- Chỉ khởi tạo mặc định khi chưa có dữ liệu để chạy lại file SQL không ghi đè giá admin đã sửa.
update public.photographers
set yearbook_prices = jsonb_build_object(
  '1', price_amount,
  '2', case when price_amount > 0 then price_amount + 300000 else 0 end,
  '3', case when price_amount > 0 then price_amount + 600000 else 0 end,
  '4', case when price_amount > 0 then price_amount + 900000 else 0 end,
  '5', case when price_amount > 0 then price_amount + 1200000 else 0 end
)
where yearbook_prices = '{}'::jsonb;

update public.photographers
set graduation_prices = jsonb_build_object(
  'ceremony', 1700000,
  'pregrad', 2000000,
  'pregrad-plus', 2500000
)

where graduation_prices = '{}'::jsonb;

-- Thông tin hiển thị trong hồ sơ thợ.
update public.photographers
set location_text = coalesce(nullif(trim(location_text),''),'Hà Nội');

update public.photographers
set drive_url = 'https://drive.google.com/drive/folders/1G-XZlKOZDOYzBti6ezr2jWXFBdeBcpMk?usp=sharing'
where drive_url is null
  and slug in ('quang-anh','chi','minh','ngoc-hoang','minh-anh','quang-vinh');

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  customer_name text not null,
  phone text not null,
  customer_email text,
  contact_link text,
  school text,
  class_name text,
  group_size text not null,

  photographer text not null references public.photographers(name) on update cascade,
  package_name text not null,
  shoot_date date not null,
  time_slot text not null check (time_slot in ('Sáng','Chiều','Cả ngày')),
  note text,

  status text not null default 'new'
    check (status in ('new','contacted','deposit_pending','confirmed','completed','cancelled','rejected')),
  deposit_amount bigint not null default 0 check (deposit_amount >= 0),
  deposit_status text not null default 'unpaid'
    check (deposit_status in ('unpaid','partial','paid','refunded')),
  internal_note text
);

create index if not exists bookings_date_idx on public.bookings(shoot_date);
create index if not exists bookings_photographer_date_idx on public.bookings(photographer, shoot_date);
create index if not exists bookings_status_idx on public.bookings(status);

alter table public.bookings add column if not exists customer_email text;


create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_key text not null,
  channel text not null check (channel in ('telegram','email_admin','email_customer','zalo_customer')),
  provider_id text,
  created_at timestamptz not null default now(),
  unique (booking_id, event_key, channel)
);

create index if not exists notification_logs_booking_idx
on public.notification_logs(booking_id, created_at desc);


create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  event_type text not null default 'existing_booking'
    check (event_type in ('personal','existing_booking','other')),
  title text not null,
  photographer text not null references public.photographers(name) on update cascade,
  event_date date not null,
  time_slot text not null check (time_slot in ('Sáng','Chiều','Cả ngày')),
  source text,
  note text,
  blocks_booking boolean not null default true
);

create index if not exists calendar_events_date_idx
on public.calendar_events(event_date);

create index if not exists calendar_events_photographer_date_idx
on public.calendar_events(photographer,event_date);

create table if not exists public.photographer_blocks (
  id uuid primary key default gen_random_uuid(),
  photographer text not null references public.photographers(name) on update cascade,
  block_date date not null,
  time_slot text not null default 'Cả ngày'
    check (time_slot in ('Sáng','Chiều','Cả ngày')),
  note text,
  created_at timestamptz not null default now(),
  unique (photographer, block_date, time_slot)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;



drop trigger if exists photographers_touch_updated_at on public.photographers;
create trigger photographers_touch_updated_at
before update on public.photographers
for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

drop trigger if exists calendar_events_touch_updated_at on public.calendar_events;
create trigger calendar_events_touch_updated_at
before update on public.calendar_events
for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Public availability: returns no customer information.
create or replace function public.get_available_slots(
  p_photographer text,
  p_shoot_date date
)
returns table(time_slot text, available boolean)
language sql
stable
security definer
set search_path = public
as $$
  with slots(slot_name) as (
    values ('Sáng'::text), ('Chiều'::text), ('Cả ngày'::text)
  ),
  active_bookings as (
    select b.time_slot
    from public.bookings b
    where b.photographer = p_photographer
      and b.shoot_date = p_shoot_date
      and b.status not in ('cancelled','rejected')
  ),
  blocks as (
    select pb.time_slot
    from public.photographer_blocks pb
    where pb.photographer = p_photographer
      and pb.block_date = p_shoot_date
  ),
  manual_events as (
    select ce.time_slot
    from public.calendar_events ce
    where ce.photographer = p_photographer
      and ce.event_date = p_shoot_date
      and ce.blocks_booking = true
  )
  select
    s.slot_name,
    not exists (
      select 1 from active_bookings ab
      where
        ab.time_slot = 'Cả ngày'
        or s.slot_name = 'Cả ngày'
        or ab.time_slot = s.slot_name
    )
    and not exists (
      select 1 from blocks bl
      where
        bl.time_slot = 'Cả ngày'
        or s.slot_name = 'Cả ngày'
        or bl.time_slot = s.slot_name
    )
    and not exists (
      select 1 from manual_events me
      where
        me.time_slot = 'Cả ngày'
        or s.slot_name = 'Cả ngày'
        or me.time_slot = s.slot_name
    ) as available
  from slots s;
$$;

revoke all on function public.get_available_slots(text,date) from public;
grant execute on function public.get_available_slots(text,date) to anon, authenticated;

-- Public booking function: validates slot and inserts without exposing bookings.
-- Drop old overload from the previous version, if it exists.
drop function if exists public.submit_booking(text,text,text,text,text,text,text,text,date,text,text);

create or replace function public.submit_booking(
  p_customer_name text,
  p_phone text,
  p_customer_email text,
  p_contact_link text,
  p_school text,
  p_class_name text,
  p_group_size text,
  p_photographer text,
  p_package_name text,
  p_shoot_date date,
  p_time_slot text,
  p_note text
)
returns table(booking_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_conflict boolean;
begin
  if coalesce(trim(p_customer_name),'') = '' then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if coalesce(trim(p_phone),'') = '' then raise exception 'PHONE_REQUIRED'; end if;
  if p_customer_email is not null and trim(p_customer_email) <> '' and
     trim(p_customer_email) !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  then raise exception 'INVALID_EMAIL'; end if;
  if p_shoot_date < current_date then raise exception 'INVALID_DATE'; end if;
  if p_time_slot not in ('Sáng','Chiều','Cả ngày') then raise exception 'INVALID_TIME_SLOT'; end if;
  if not exists (select 1 from public.photographers p where p.name=p_photographer and p.active=true)
  then raise exception 'INVALID_PHOTOGRAPHER'; end if;

  perform pg_advisory_xact_lock(hashtext(lower(p_photographer) || '|' || p_shoot_date::text));

  select exists (
    select 1 from public.bookings b
    where b.photographer=p_photographer
      and b.shoot_date=p_shoot_date
      and b.status not in ('cancelled','rejected')
      and (b.time_slot='Cả ngày' or p_time_slot='Cả ngày' or b.time_slot=p_time_slot)
  ) or exists (
    select 1 from public.photographer_blocks pb
    where pb.photographer=p_photographer
      and pb.block_date=p_shoot_date
      and (pb.time_slot='Cả ngày' or p_time_slot='Cả ngày' or pb.time_slot=p_time_slot)
  ) or exists (
    select 1 from public.calendar_events ce
    where ce.photographer=p_photographer
      and ce.event_date=p_shoot_date
      and ce.blocks_booking=true
      and (
        ce.time_slot='Cả ngày'
        or p_time_slot='Cả ngày'
        or ce.time_slot=p_time_slot
      )
  ) into v_conflict;

  if v_conflict then raise exception 'SLOT_UNAVAILABLE'; end if;

  v_code := 'CG-' || to_char(current_date,'YYMMDD') || '-' ||
            upper(substr(encode(gen_random_bytes(4),'hex'),1,6));

  insert into public.bookings (
    booking_code, customer_name, phone, customer_email, contact_link, school, class_name,
    group_size, photographer, package_name, shoot_date, time_slot, note
  ) values (
    v_code, trim(p_customer_name), trim(p_phone), nullif(trim(p_customer_email),''),
    nullif(trim(p_contact_link),''), nullif(trim(p_school),''), nullif(trim(p_class_name),''),
    p_group_size, p_photographer, p_package_name, p_shoot_date, p_time_slot, nullif(trim(p_note),'')
  );

  return query select v_code;
end;
$$;

revoke all on function public.submit_booking(text,text,text,text,text,text,text,text,text,date,text,text) from public;
grant execute on function public.submit_booking(text,text,text,text,text,text,text,text,text,date,text,text) to anon, authenticated;

alter table public.photographers enable row level security;
alter table public.admin_users enable row level security;
alter table public.bookings enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notification_logs enable row level security;
alter table public.photographer_blocks enable row level security;

drop policy if exists "public_read_active_photographers" on public.photographers;
create policy "public_read_active_photographers"
on public.photographers for select
to anon, authenticated
using (active = true or public.is_admin());

drop policy if exists "admin_manage_photographers" on public.photographers;
create policy "admin_manage_photographers"
on public.photographers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_read_bookings" on public.bookings;
create policy "admin_read_bookings"
on public.bookings for select
to authenticated
using (public.is_admin());

drop policy if exists "admin_update_bookings" on public.bookings;
create policy "admin_update_bookings"
on public.bookings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_delete_bookings" on public.bookings;
create policy "admin_delete_bookings"
on public.bookings for delete
to authenticated
using (public.is_admin());


drop policy if exists "admin_read_notification_logs" on public.notification_logs;
create policy "admin_read_notification_logs"
on public.notification_logs for select
to authenticated
using (public.is_admin());


drop policy if exists "admin_manage_calendar_events" on public.calendar_events;
create policy "admin_manage_calendar_events"
on public.calendar_events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_blocks" on public.photographer_blocks;
create policy "admin_manage_blocks"
on public.photographer_blocks for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_read_self" on public.admin_users;
create policy "admin_read_self"
on public.admin_users for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));

grant select on public.photographers to anon, authenticated;
grant select, insert, update, delete on public.photographers to authenticated;
grant select, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select on public.notification_logs to authenticated;
grant select, insert, update, delete on public.photographer_blocks to authenticated;
grant select on public.admin_users to authenticated;



-- ============================================================
-- SUPABASE STORAGE: photographer images
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photographers', 'photographers', true, 15728640,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_upload_photographer_images" on storage.objects;
create policy "admin_upload_photographer_images"
on storage.objects for insert to authenticated
with check (bucket_id='photographers' and public.is_admin());

drop policy if exists "admin_update_photographer_images" on storage.objects;
create policy "admin_update_photographer_images"
on storage.objects for update to authenticated
using (bucket_id='photographers' and public.is_admin())
with check (bucket_id='photographers' and public.is_admin());

drop policy if exists "admin_delete_photographer_images" on storage.objects;
create policy "admin_delete_photographer_images"
on storage.objects for delete to authenticated
using (bucket_id='photographers' and public.is_admin());

drop policy if exists "admin_read_photographer_images" on storage.objects;
create policy "admin_read_photographer_images"
on storage.objects for select to authenticated
using (bucket_id='photographers' and public.is_admin());


-- ============================================================
-- QUAN TRỌNG:
-- 1) Supabase > Authentication > Users > Add user.
-- 2) Dùng CÙNG email đó thay cho dòng dưới.
-- ============================================================
insert into public.admin_users(email)
values ('cheesegraduation.com')
on conflict (email) do nothing;


-- Realtime: để admin.html nhận booking mới ngay khi khách vừa gửi.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end
$$;


-- ============================================================
-- BẢNG GIÁ CHUNG — chỉnh từ Admin, public website chỉ được đọc
-- ============================================================
create table if not exists public.site_pricing (
  id text primary key default 'main',
  reference_price_from bigint not null default 1500000,
  team_prices jsonb not null default '[]'::jsonb,
  province_groups jsonb not null default '[]'::jsonb,
  province_details jsonb not null default '{}'::jsonb,
  takecare_full_day_rate bigint not null default 400000,
  takecare_half_day_rate bigint not null default 250000,
  updated_at timestamptz not null default now()
);

alter table public.site_pricing add column if not exists takecare_full_day_rate bigint not null default 400000;
alter table public.site_pricing add column if not exists takecare_half_day_rate bigint not null default 250000;

insert into public.site_pricing (id, reference_price_from, team_prices, province_groups, province_details)
values (
  'main',
  1500000,
  $json$[{"id": "founder", "label": "Founder", "priceFrom": 2800000, "description": "Founder & Photographer của Cheese.Graduation. Phù hợp những booking cần concept kỹ, định hướng hình ảnh rõ và trải nghiệm cá nhân hoá.", "teams": ["Founder"]}, {"id": "ekip1", "label": "Ekip 1", "priceFrom": 2500000, "description": "Nhóm photographer chủ lực của Cheese.Graduation, giàu kinh nghiệm, xử lý linh hoạt và có phong cách cá nhân rõ nét.", "teams": ["Ekip 1"]}, {"id": "ekip23", "label": "Ekip 2,3", "priceFrom": 2200000, "description": "Những photographer trẻ của Cheese.Graduation, đa dạng phong cách, bắt trend nhanh và làm việc theo cùng tiêu chuẩn của ekip.", "teams": ["Ekip 2", "Ekip 3"]}, {"id": "takecare", "label": "Take Care", "priceFrom": 1500000, "description": "Nhân sự đồng hành xuyên suốt buổi chụp: hỗ trợ trang phục, tóc, phụ kiện, chỉnh dáng, giữ đồ và những nhu cầu phát sinh.", "teams": []}]$json$::jsonb,
  $json$[{"label": "Miền Bắc", "items": [["Hà Nội (2 địa điểm nội thành Hà Nội)", "100.000đ"], ["Hà Nội (ngoại thành)", "200.000đ"], ["Vĩnh Phúc", "300.000đ"], ["Bắc Ninh", "300.000đ"], ["Hải Dương", "400.000đ"], ["Thái Nguyên", "500.000đ"], ["Bắc Giang", "500.000đ"], ["Hà Nam", "500.000đ"], ["Ninh Bình", "500.000đ - 600.000đ"], ["Hải Phòng", "600.000đ"], ["Quảng Ninh", "600.000đ"], ["Phú Thọ", "600.000đ"], ["Hạ Long", "700.000đ"], ["Lạng Sơn", "800.000đ"], ["Sơn La", "800.000đ"], ["Tuyên Quang", "800.000đ"], ["Bắc Kạn", "800.000đ"], ["Lai Châu", "800.000đ - 1.200.000đ"], ["Lào Cai", "900.000đ"]]}, {"label": "Bắc Trung Bộ", "items": [["Thanh Hoá", "800.000đ"], ["Nghệ An", "900.000đ - 1.000.000đ"], ["Hà Tĩnh", "900.000đ - 1.200.000đ"]]}]$json$::jsonb,
  $json${"Hà Nội (2 địa điểm nội thành Hà Nội)": "Áp dụng khi 2 điểm chụp cách nhau trên 5km.", "Hà Nội (ngoại thành)": "Chỉ chụp tại trường.", "Vĩnh Phúc": "Tính theo 1 thợ.", "Bắc Ninh": "Tính theo 1 thợ.", "Lạng Sơn": "Tính theo 1 thợ.", "Hải Dương": "Tính theo 1 thợ.", "Thái Nguyên": "Tính theo 1 thợ.", "Hải Phòng": "Các huyện xa trung tâm có thể chênh thêm một chút.", "Hạ Long": "Tính theo 1 thợ.", "Quảng Ninh": "Tính theo 1 thợ.", "Phú Thọ": "Tính theo 1 thợ.", "Sơn La": "Tính theo 1 thợ.", "Lào Cai": "Tính theo 1 thợ.", "Tuyên Quang": "Tính theo 1 thợ.", "Bắc Kạn": "Tính theo 1 thợ.", "Thanh Hoá": "Tính theo 1 thợ.", "Ninh Bình": "Xa trung tâm thành phố: 600.000đ.", "Nghệ An": "Huyện xa trung tâm thành phố: 1.000.000đ - 1.200.000đ tuỳ địa điểm, do thợ cần lưu trú qua đêm để chụp đúng giờ.", "Hà Tĩnh": "Huyện xa trung tâm thành phố: 1.000.000đ - 1.200.000đ tuỳ địa điểm, do thợ cần lưu trú qua đêm để chụp đúng giờ.", "Lai Châu": "Huyện xa trung tâm thành phố: 1.000.000đ - 1.200.000đ tuỳ địa điểm, do thợ cần lưu trú qua đêm để chụp đúng giờ.", "Bắc Giang": "Tính theo 1 thợ.", "Hà Nam": "Tính theo 1 thợ."}$json$::jsonb
)
on conflict (id) do nothing;

alter table public.site_pricing enable row level security;

drop policy if exists "public_read_site_pricing" on public.site_pricing;
create policy "public_read_site_pricing"
on public.site_pricing for select
to anon, authenticated
using (true);

drop policy if exists "admin_manage_site_pricing" on public.site_pricing;
create policy "admin_manage_site_pricing"
on public.site_pricing for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_pricing to anon, authenticated;
grant insert, update, delete on public.site_pricing to authenticated;


-- ============================================================
-- TAKE CARE — danh sách nhân sự, lịch làm và chi phí nội bộ
-- Cả ngày: 400.000đ | Nửa ngày: 250.000đ
-- ============================================================
create table if not exists public.takecare_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.takecare_shifts (
  id uuid primary key default gen_random_uuid(),
  takecare_id uuid not null references public.takecare_staff(id) on delete restrict,
  work_date date not null,
  shift_type text not null check (shift_type in ('full_day','half_morning','half_afternoon')),
  cost_amount bigint not null check (cost_amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique (takecare_id, work_date)
);

alter table public.takecare_shifts drop constraint if exists takecare_shifts_cost_amount_check;
alter table public.takecare_shifts add constraint takecare_shifts_cost_amount_check check (cost_amount >= 0);

create index if not exists takecare_shifts_date_idx
on public.takecare_shifts(work_date);

create index if not exists takecare_shifts_staff_date_idx
on public.takecare_shifts(takecare_id, work_date);

drop trigger if exists takecare_staff_touch_updated_at on public.takecare_staff;
create trigger takecare_staff_touch_updated_at
before update on public.takecare_staff
for each row execute function public.touch_updated_at();

alter table public.takecare_staff enable row level security;
alter table public.takecare_shifts enable row level security;

drop policy if exists "admin_manage_takecare_staff" on public.takecare_staff;
create policy "admin_manage_takecare_staff"
on public.takecare_staff for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_manage_takecare_shifts" on public.takecare_shifts;
create policy "admin_manage_takecare_shifts"
on public.takecare_shifts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.takecare_staff to authenticated;
grant select, insert, update, delete on public.takecare_shifts to authenticated;


-- Yêu cầu PostgREST/Supabase cập nhật schema cache ngay sau migration.
notify pgrst, 'reload schema';


-- ============================================================
-- ẢNH CHẠY ĐẦU TRANG — quản lý từ Admin
-- ============================================================
create table if not exists public.site_hero_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  alt_text text not null default 'Ảnh tốt nghiệp Cheese.Graduation',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_hero_images_sort_idx on public.site_hero_images(sort_order, created_at);

drop trigger if exists site_hero_images_touch_updated_at on public.site_hero_images;
create trigger site_hero_images_touch_updated_at
before update on public.site_hero_images
for each row execute function public.touch_updated_at();

alter table public.site_hero_images enable row level security;

drop policy if exists "public_read_site_hero_images" on public.site_hero_images;
create policy "public_read_site_hero_images"
on public.site_hero_images for select
to anon, authenticated
using (active = true or public.is_admin());

drop policy if exists "admin_manage_site_hero_images" on public.site_hero_images;
create policy "admin_manage_site_hero_images"
on public.site_hero_images for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_hero_images to anon, authenticated;
grant insert, update, delete on public.site_hero_images to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media','site-media',true,15728640,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public_read_site_media" on storage.objects;
create policy "public_read_site_media"
on storage.objects for select
to public
using (bucket_id='site-media');

drop policy if exists "admin_insert_site_media" on storage.objects;
create policy "admin_insert_site_media"
on storage.objects for insert
to authenticated
with check (bucket_id='site-media' and public.is_admin());

drop policy if exists "admin_update_site_media" on storage.objects;
create policy "admin_update_site_media"
on storage.objects for update
to authenticated
using (bucket_id='site-media' and public.is_admin())
with check (bucket_id='site-media' and public.is_admin());

drop policy if exists "admin_delete_site_media" on storage.objects;
create policy "admin_delete_site_media"
on storage.objects for delete
to authenticated
using (bucket_id='site-media' and public.is_admin());

insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-01.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 1', 10, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-01.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-02.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 2', 20, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-02.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-03.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 3', 30, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-03.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-04.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 4', 40, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-04.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-05.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 5', 50, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-05.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-06.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 6', 60, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-06.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-07.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 7', 70, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-07.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-08.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 8', 80, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-08.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-09.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 9', 90, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-09.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-10.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 10', 100, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-10.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-11.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 11', 110, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-11.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-12.png', 'Ảnh tốt nghiệp Cheese.Graduation 12', 120, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-12.png');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-13.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 13', 130, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-13.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/home/photo-14.jpg', 'Ảnh tốt nghiệp Cheese.Graduation 14', 140, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/home/photo-14.jpg');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-01.webp', 'Ảnh tốt nghiệp Cheese.Graduation 15', 150, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-01.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-02.webp', 'Ảnh tốt nghiệp Cheese.Graduation 16', 160, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-02.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-03.webp', 'Ảnh tốt nghiệp Cheese.Graduation 17', 170, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-03.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-04.webp', 'Ảnh tốt nghiệp Cheese.Graduation 18', 180, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-04.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-05.webp', 'Ảnh tốt nghiệp Cheese.Graduation 19', 190, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-05.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-06.webp', 'Ảnh tốt nghiệp Cheese.Graduation 20', 200, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-06.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-07.webp', 'Ảnh tốt nghiệp Cheese.Graduation 21', 210, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-07.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-08.webp', 'Ảnh tốt nghiệp Cheese.Graduation 22', 220, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-08.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-09.webp', 'Ảnh tốt nghiệp Cheese.Graduation 23', 230, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-09.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-10.webp', 'Ảnh tốt nghiệp Cheese.Graduation 24', 240, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-10.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-11.webp', 'Ảnh tốt nghiệp Cheese.Graduation 25', 250, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-11.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-12.webp', 'Ảnh tốt nghiệp Cheese.Graduation 26', 260, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-12.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-13.webp', 'Ảnh tốt nghiệp Cheese.Graduation 27', 270, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-13.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-14.webp', 'Ảnh tốt nghiệp Cheese.Graduation 28', 280, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-14.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-15.webp', 'Ảnh tốt nghiệp Cheese.Graduation 29', 290, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-15.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-16.webp', 'Ảnh tốt nghiệp Cheese.Graduation 30', 300, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-16.webp');
insert into public.site_hero_images (image_url, alt_text, sort_order, active) select 'assets/images/hero/hero-17.webp', 'Ảnh tốt nghiệp Cheese.Graduation 31', 310, true where not exists (select 1 from public.site_hero_images where image_url='assets/images/hero/hero-17.webp');

notify pgrst, 'reload schema';
