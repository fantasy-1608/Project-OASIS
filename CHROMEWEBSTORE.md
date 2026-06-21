# Chrome Web Store Listing — Aladinn OASIS

> Last Updated: 2026-06-21

## Store Listing

**Extension Name**

Aladinn OASIS

**Short Description**

Chuyển thông tin từ VNPT HIS sang bảng dự kiến mổ nội bộ và quản lý lịch mổ theo ngày, ca.

**Detailed Description**

Aladinn OASIS giúp nhân viên y tế chuyển thông tin cần thiết từ VNPT HIS sang bảng dự kiến mổ nội bộ.

TÍNH NĂNG
• Thêm nút “Lên dự kiến mổ” trên VNPT HIS.
• Điền trước mã bệnh án, tên bệnh nhân, chẩn đoán và thông tin tiền phẫu.
• Quản lý danh sách chờ, ca sáng và ca chiều trong side panel.
• Hỗ trợ kéo thả, lịch tuần, bảng in và trạng thái hoàn thành/hoãn/hủy.
• Bảo vệ dữ liệu xem và chỉnh sửa bằng phiên mở khóa có thời hạn.

CÁCH SỬ DỤNG
1. Mở hồ sơ bệnh nhân trên VNPT HIS.
2. Chọn “Lên dự kiến mổ”.
3. Nhập mã bảo mật để mở dữ liệu OASIS.
4. Kiểm tra biểu mẫu, chọn ngày/ca và lưu.

QUYỀN RIÊNG TƯ
Tiện ích chỉ hoạt động trên miền VNPT HIS đã khai báo. Dữ liệu bệnh nhân được truyền qua HTTPS/WSS tới Supabase cho chức năng bảng dự kiến mổ và được mã hóa tại backend trước khi lưu. Tiện ích không bán dữ liệu, không quảng cáo và không phân tích hành vi.

QUYỀN TRUY CẬP
• sidePanel: hiển thị bảng dự kiến mổ cạnh VNPT HIS.
• storage: giữ tạm biểu mẫu đang chuyển sang side panel.
• vncare.vn: đọc thông tin hồ sơ đang hiển thị sau thao tác của người dùng.
• supabase.co: tải và cập nhật bảng dự kiến mổ qua backend bảo mật.

HỖ TRỢ
https://github.com/fantasy-1608/Project-OASIS/issues

Phiên bản 1.2.5 — tăng bảo vệ dữ liệu, chuẩn hóa gói Chrome Web Store và tài sản phát hành.

**Category**

Productivity

**Single Purpose**

Chuyển thông tin bệnh nhân cần thiết từ VNPT HIS sang bảng dự kiến mổ nội bộ và quản lý bảng đó.

**Primary Language**

Tiếng Việt

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `public/icon128.png` |
| Screenshot 1 | 1280×800 PNG | ✅ Ready | `store-assets/screenshot-1-board.png` |
| Screenshot 2 | 1280×800 PNG | ✅ Ready | `store-assets/screenshot-2-privacy.png` |
| Small Promo Tile | 440×280 PNG | ✅ Ready | `store-assets/small-promo-tile.png` |

### Screenshot Notes

- Screenshot 1: màn hình OASIS ở trạng thái khóa dữ liệu, thể hiện rõ cơ chế bảo vệ trước khi xem PHI.
- Screenshot 2: trang privacy policy công khai, mô tả dữ liệu và cách sử dụng.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | permissions | Hiển thị bảng dự kiến mổ cạnh VNPT HIS để người dùng kiểm tra và xếp lịch mà không rời hồ sơ đang mở. |
| `storage` | permissions | Giữ tạm payload ca mổ sau khi người dùng chọn “Lên dự kiến mổ”; payload được xóa sau khi side panel nhận dữ liệu. |
| `https://*.supabase.co/*` | host_permissions | Gọi Edge Function, nhận realtime update và lưu bảng dự kiến mổ trên backend Supabase của dự án qua HTTPS/WSS. |
| `*://*.vncare.vn/*` | content script site access | Chỉ trên VNPT HIS, thêm nút người dùng chủ động bấm và đọc các trường hồ sơ cần để điền biểu mẫu dự kiến mổ. |
| `injected.js` trên `vncare.vn` | web accessible resource | Kết nối với API nội bộ đã có trong trang HIS để lấy chẩn đoán và trạng thái hồ sơ tiền phẫu theo thao tác của người dùng. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | Yes | Yes | Tạo và quản lý dự kiến mổ | Supabase, chỉ để cung cấp hạ tầng |
| Health info | Yes | Yes | Chẩn đoán, tiền phẫu và lịch mổ | Supabase, chỉ để cung cấp hạ tầng |
| Authentication info | Yes | Yes | Xác minh mã mở khóa và phiên truy cập | Supabase Edge Function |
| Website content | Yes | Yes | Điền biểu mẫu từ hồ sơ HIS sau thao tác người dùng | Supabase khi người dùng lưu |
| Financial info | No | No | Không áp dụng | No |
| Personal communications | No | No | Không áp dụng | No |
| Location | No | No | Không áp dụng | No |
| Web history | No | No | Không áp dụng | No |
| User activity | No | No | Không phân tích hành vi | No |

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**

https://lichmo-ctch.vercel.app/privacy.html

## Distribution

**Visibility**: Unlisted
**Regions**: Việt Nam
**Pricing**: Free

## Developer Info

**Publisher Name**

Huỳnh Trung Anh

**Contact Email**

Sử dụng email đã xác minh của tài khoản Chrome Web Store Developer trong Dashboard.

**Support URL**

https://github.com/fantasy-1608/Project-OASIS/issues

**Homepage URL**

https://lichmo-ctch.vercel.app

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.2.5 | 2026-06-21 | Bảo vệ quyền đọc PHI, chuẩn hóa CSP, assets, privacy và gói phát hành | Draft |

## Review Notes

### Known Issues / Limitations

- Tiện ích chỉ dành cho người dùng có quyền truy cập VNPT HIS và mã mở khóa OASIS.
- Tích hợp HIS phụ thuộc cấu trúc giao diện VNPT HIS tại miền `vncare.vn`.
- Tính năng auth/RBAC nâng cao vẫn tắt; bản này sử dụng phiên mở khóa dùng chung có thời hạn.
