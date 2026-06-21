# Changelog

## [1.2.5] - 2026-06-21

### Security
- Yêu cầu phiên mở khóa hợp lệ trước khi Edge Function trả dữ liệu dự kiến mổ đã giải mã.
- Giữ nguyên luồng mã bảo mật CTCH, nhưng bảo vệ cả quyền xem lẫn quyền chỉnh sửa dữ liệu bệnh nhân.
- Thu hẹp Content Security Policy của extension và loại bỏ tải font từ xa.

### Chrome Web Store
- Chuẩn hóa icon extension, privacy policy, tài sản listing và quy trình đóng gói/kiểm tra gói phát hành.
- Đồng bộ metadata phiên bản và mô tả tiếng Việt cho bản phát hành.

## [1.2.2] - 2026-05-22

### Added
- **Lịch mổ tuần nâng cao**: Tích hợp màn hình thống kê (stats dashboard) và hiển thị các ca mổ dưới dạng thẻ thu nhỏ (micro-cards) tối ưu không gian hiển thị.
- **Tối ưu hóa In ấn (TableView Print)**:
  - Tự động gom nhóm các ca mổ trùng ngày hoặc trùng kíp mổ (shift) đẹp mắt.
  - Chuyển cột Ngày lên vị trí đầu tiên giúp dễ theo dõi.
  - Tối ưu hóa chiều rộng bảng in, hiển thị tên bệnh nhân gọn gàng trên 1 dòng.
  - Ẩn triệt để thanh tiêu đề và chân trang của trình duyệt khi in.
  - Loại bỏ tiền tố phòng mổ dư thừa và tối ưu hóa phối màu tiết kiệm mực in.
- **CTCH Auth Bypass**: Tích hợp tùy chọn bỏ qua xác thực Supabase để tự động bypass password-less phù hợp với phòng mổ CTCH.

## [1.2.1] - 2026-05-20

### Added
- **Nâng cấp bảo mật phân quyền (RBAC)**: Tách biệt vai trò bác sĩ và điều dưỡng rõ ràng.
- **Mã hóa PHI nâng cao**: Tăng cường bảo mật khóa giải mã thông tin định danh bệnh nhân.

### Fixed
- Sửa lỗi linter (biến chưa sử dụng) trong file `content.js`.

## [1.2.0] - 2026-05-18

### Added
- **Tích hợp thông tin phòng mổ**: Thêm trường Phòng mổ (`room`) trong hộp thoại thêm/sửa ca mổ và tự động hiển thị trên thẻ ca mổ.
- **Đồng bộ 2 chiều nâng cao**: Tự động giả lập thao tác gõ phím khi lọc bảng dữ liệu trên giao diện VNPT HIS để tăng độ tin cậy.
- **Release Automation Script**: Thêm tập lệnh đóng gói zip tự động thông qua `pnpm run release`.

## [1.1.6] - 2026-05-09

### Added
- **Tự động trích xuất năm sinh**: Nhận diện và trích xuất năm sinh của bệnh nhân từ HIS để hiển thị rõ ràng trên thẻ mổ, giảm thiểu tối đa rủi ro nhầm lẫn giữa các bệnh nhân trùng tên.
- **Khung giao diện v2**: Chuẩn bị hạ tầng cho các mô hình nâng cấp tiếp theo.

## [1.1.5] - 2026-05-09
### Added
- Tích hợp GitNexus cho code intelligence và phân tích ảnh hưởng (impact analysis).
- Cơ chế bảo vệ cơ bản (`isUnlocked`) yêu cầu nhập mã xác nhận trước khi có thể thêm hoặc thay đổi bảng dự kiến.

### Changed
- Chuẩn hóa chiều cao thẻ `SurgeryCard` với Flexbox Grid Stretch, đảm bảo hiển thị đồng đều trên cùng một ca (row).
- Tinh chỉnh giao diện các trường dữ liệu bệnh nhân (giới tính, năm sinh, ID) để dễ nhìn hơn.
- Gỡ bỏ gợi ý mật khẩu trong hộp thoại cảnh báo mở khoá (UI unlock prompt).

### Fixed
- Sửa lỗi linter (cảnh báo biến chưa sử dụng) trong `SurgeryCard.jsx`.
