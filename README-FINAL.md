# Cheese.Graduation — COMPLETE FINAL

Bộ file hoàn chỉnh, đã gộp các thay đổi mới nhất.

## Trang chính
- `index.html`

## Đặt lịch
- `lien-he.html`
- `contact-booking.js`
- `booking-prices.js`
- Kỷ yếu và Tốt nghiệp đại học là hai mục riêng.
- Phần Tốt nghiệp đại học dùng giao diện gói riêng.
- 4 bước đặt lịch đã căn lại dạng timeline.
- Tỉnh di chuyển giới hạn miền Bắc + miền Trung.

## Admin
- `admin.html`
- `cheese-admin.js`
- Quản lý lịch chụp và photographer.

## Supabase
- `supabase-setup.sql`
- thư mục `supabase/functions/`

## Media
- `assets/audio/cheese-background.m4a`
- `assets/photographers/`

## Cấu hình
- `config.js` — Supabase URL + anon/publishable key
- `studio-contact.js` — Instagram/Zalo/Messenger
- `drive-links.js` — link Drive tham khảo

Chạy lại `supabase-setup.sql` nếu project Supabase của bạn chưa có các thay đổi mới nhất.


## Music Fix v3

- Khôi phục vị trí nhạc trước khi bắt đầu phát ở trang mới.
- Không còn timeupdate ghi đè vị trí cũ thành 0:00 lúc load.
- Giữ thời gian bằng localStorage và window.name dự phòng khi test local.
- Mỗi tab mới mặc định bật nhạc.
- Nếu browser chặn autoplay có tiếng, audio chạy warm-up ở chế độ mute và bật tiếng ngay ở tương tác đầu tiên.


## Quản lý giá và dịch vụ theo từng thợ

Admin Photographer giờ là nguồn dữ liệu cho giá Kỷ yếu, giá Tốt nghiệp đại học và Dịch vụ đi kèm. Sau khi sửa và lưu, trang đặt lịch / hồ sơ thợ sẽ đọc dữ liệu mới từ Supabase.


## Cập nhật hồ sơ photographer dạng ảnh mẫu

- Đầu trang hồ sơ hiển thị breadcrumb `Chọn thợ / Tên thợ`.
- Chỉ hiển thị tối đa 5 ảnh ở slider đầu trang.
- Dưới slider có dòng hướng dẫn vuốt để xem các ảnh còn lại.
- Ngay dưới ảnh có nút xanh mở album Google Drive của photographer.
- Thông tin thợ được rút gọn: tên + ekip, Hà Nội + rating + số buổi chụp, mô tả và tag.
- Link Drive hiện tại dùng link album chung đã cấu hình trong `drive-links.js`.


## Photographer CMS mới
Trong Admin, mục Photographer giờ điều khiển trực tiếp toàn bộ thông tin khách nhìn thấy trên hồ sơ thợ, gồm đúng 5 ảnh đầu, thông tin cá nhân, giá, dịch vụ và Google Drive.


# Quản lý 5 ảnh từng photographer

Admin → Photographer giờ có 5 ô ảnh riêng cho từng thợ.

- Ảnh 1: ảnh chính và ảnh card ở trang chủ.
- Ảnh 2–5: ảnh vuốt trong hồ sơ thợ.
- Mỗi ô có thể chọn ảnh từ máy hoặc dán URL.
- Có thể xóa ảnh và dùng mũi tên trái/phải để đổi thứ tự.
- Ảnh chọn từ máy chỉ upload khi bấm **Lưu thay đổi**.
- Dữ liệu vẫn lưu trong `cover_url` + `gallery_urls`, nên không cần đổi cấu trúc database.


## Cấu trúc deploy gọn cho Netlify

Bản này đã tách file lớn thành cấu trúc static rõ ràng:

```text
index.html
admin.html
lien-he.html
config.js                    # chỉ chứa Project URL + Publishable Key
assets/
  css/                       # CSS từng trang
  js/
    shared/                  # script dùng chung
    index/                   # script trang chính / hồ sơ thợ
    admin/                   # script Admin
    booking/                 # script đặt lịch
  images/home/               # ảnh trước đây nhúng base64 trong index.html
  photographers/             # ảnh mặc định các thợ
  audio/                     # nhạc nền
supabase/                    # Edge Functions/config
supabase-setup.sql
```

`config.js` cố ý để ở thư mục gốc để bạn dễ dán Supabase Project URL và Publishable Key. Không đưa `service_role`/Secret key vào file này.

Khi deploy Netlify, kéo **nguyên thư mục** này lên. Không kéo riêng `index.html`.


## Fix upload ảnh Photographer
Admin tự tối ưu ảnh lớn trước khi upload lên Supabase Storage. Ảnh lớn được resize tối đa khoảng 2800 px cạnh dài và chuyển sang WEBP chất lượng cao. Điều này tránh lỗi `The object exceeded the maximum allowed size` với bucket `photographers` đang giới hạn 15 MB/ảnh.

Nếu Supabase vẫn báo giới hạn dung lượng, vào Storage → bucket `photographers` → Edit bucket và kiểm tra File size limit. Bản code này chủ động giữ ảnh upload ở mức thấp hơn nhiều so với giới hạn 15 MB.


## Khung ảnh hồ sơ 4:6
5 ảnh đầu trong hồ sơ photographer được hiển thị theo khung dọc 4:6 (CSS `aspect-ratio: 2 / 3`) trên cả desktop và mobile. Ảnh dùng `object-fit: cover` để phủ kín khung.


## Trang bảng giá
- Trang mới: `bang-gia.html`
- Nút “Xem ảnh thật” ở trang chính đã đổi thành `Bảng giá & phụ phí tỉnh`.
- Danh sách phụ phí tỉnh đã cập nhật theo bảng mới (22 địa điểm).


## Admin đồng bộ Bảng giá & Phụ phí
Admin có thêm mục `Bảng giá & phụ phí`. Tại đây có thể sửa:
- Giá tham khảo đầu trang (mặc định 1.500.000đ)
- Tên hạng ekip, giá từ, mô tả, ekip liên kết
- Tất cả tên tỉnh/khu vực, nhóm vùng, phụ phí / 1 thợ và ghi chú

Dữ liệu được lưu ở bảng Supabase `site_pricing` và được dùng chung bởi `bang-gia.html` + `lien-he.html`.
Cần chạy lại `supabase-setup.sql` một lần để tạo bảng `site_pricing` và RLS.


## Admin Take Care
Admin có thêm mục `Take Care` để quản lý nhân sự và chấm lịch làm.

Chi phí nội bộ mặc định:
- Cả ngày: 400.000đ / người / ngày
- Nửa ngày sáng hoặc chiều: 250.000đ / người / nửa ngày

Mỗi Take Care chỉ có một loại ca cho một ngày. Nếu làm cả sáng và chiều, chọn `Cả ngày` để hệ thống tính 400.000đ thay vì hai nửa ngày.

Admin hiển thị tổng số ca, số ngày cả ngày, số ca nửa ngày, tổng chi phí theo tháng, tổng từng người và danh sách ngày đã làm.

Cần chạy lại `supabase-setup.sql` một lần để tạo hai bảng `takecare_staff` và `takecare_shifts` cùng RLS.


## FIX site_pricing + giá công Take Care chỉnh được
Nếu Admin báo `Could not find the table 'public.site_pricing' in the schema cache`, chạy file `SUPABASE-PATCH-PRICING-TAKECARE.sql` một lần trong Supabase SQL Editor.

Admin → Take Care giờ cho chỉnh:
- Công cả ngày (mặc định 400.000đ)
- Công nửa ngày (mặc định 250.000đ)

Lịch Take Care mới dùng mức giá đang lưu. Lịch cũ giữ nguyên `cost_amount`, nên thay đổi giá về sau không làm thay đổi chi phí lịch sử.


## Ảnh chạy đầu trang — Admin CMS
- Bộ ảnh người dùng gửi đã được thêm vào `assets/images/hero/` và chạy cùng các ảnh đầu trang cũ.
- Admin có mục `Ảnh đầu trang`: upload nhiều ảnh, thêm URL, mô tả, ẩn/hiện, đổi thứ tự và xóa.
- Ảnh upload được tự tối ưu WEBP trước khi đưa lên Supabase Storage bucket `site-media`.
- Chạy `SUPABASE-PATCH-HERO-IMAGES.sql` một lần trên project Supabase hiện tại để tạo bảng `site_hero_images`, bucket và seed các ảnh mặc định.
