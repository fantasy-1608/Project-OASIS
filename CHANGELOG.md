# Changelog

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
