# Chính sách quyền riêng tư — Aladinn OASIS

**Cập nhật lần cuối:** 21/06/2026

Aladinn OASIS là tiện ích nội bộ hỗ trợ nhân viên y tế chuyển thông tin cần thiết từ VNPT HIS sang bảng dự kiến mổ. Chính sách này mô tả dữ liệu tiện ích xử lý, mục đích sử dụng và cách người dùng kiểm soát dữ liệu.

## Dữ liệu được xử lý

Khi người dùng chủ động chọn **“Lên dự kiến mổ”**, tiện ích có thể đọc các trường đang hiển thị trên hồ sơ bệnh nhân trong VNPT HIS, gồm:

- Họ tên và mã bệnh án.
- Giới tính, năm sinh, ngày nhập viện và buồng/phòng.
- Chẩn đoán, bệnh kèm theo và thông tin kiểm tra mức độ sẵn sàng trước mổ.
- Thông tin lịch dự kiến mổ do người dùng bổ sung, như ngày, ca, phương pháp, gây mê, thiết bị và ghi chú.

Tiện ích cũng xử lý mã bảo mật do người dùng nhập và token phiên mở khóa ngắn hạn. Tiện ích không thu thập lịch sử duyệt web ngoài miền VNPT HIS đã khai báo, không sử dụng quảng cáo và không có hệ thống phân tích hành vi.

## Mục đích sử dụng

Dữ liệu chỉ được sử dụng để:

- Điền trước biểu mẫu tạo dự kiến mổ theo thao tác của người dùng.
- Hiển thị, sắp xếp và cập nhật bảng dự kiến mổ nội bộ.
- Đánh giá danh mục hồ sơ tiền phẫu từ dữ liệu đang có trong HIS.
- Bảo vệ quyền xem và chỉnh sửa bằng phiên mở khóa có thời hạn.

## Lưu trữ và truyền dữ liệu

- Dữ liệu được truyền tới dịch vụ Supabase của dự án bằng HTTPS/WSS sau hành động rõ ràng của người dùng.
- Các trường PHI được mã hóa tại backend trước khi lưu trong cơ sở dữ liệu.
- `chrome.storage.local` chỉ giữ tạm payload đang chờ chuyển từ VNPT HIS sang side panel và xóa sau khi side panel nhận dữ liệu.
- Token mở khóa được giữ trong `sessionStorage`, hết hạn sau tối đa 8 giờ và bị xóa khi người dùng khóa lại hoặc kết thúc phiên trình duyệt.
- Dữ liệu lịch mổ được giữ cho tới khi người dùng có quyền xóa trong ứng dụng hoặc đơn vị vận hành áp dụng chính sách lưu trữ riêng.

## Chia sẻ dữ liệu

Aladinn OASIS không bán dữ liệu, không dùng dữ liệu cho quảng cáo, chấm điểm tín dụng hoặc mục đích ngoài chức năng lập dự kiến mổ. Supabase chỉ đóng vai trò hạ tầng lưu trữ và truyền dữ liệu cho chức năng cốt lõi.

## Kiểm soát và xóa dữ liệu

Người dùng có quyền phù hợp có thể sửa hoặc xóa ca dự kiến mổ trong ứng dụng. Gỡ tiện ích khỏi Chrome sẽ xóa dữ liệu lưu cục bộ của tiện ích. Yêu cầu liên quan đến dữ liệu backend có thể gửi qua trang hỗ trợ của dự án.

## Bảo mật

Tiện ích giới hạn quyền truy cập vào miền VNPT HIS và Supabase đã khai báo. Dữ liệu nhạy cảm được truyền qua kết nối mã hóa; thao tác đọc/ghi backend yêu cầu phiên mở khóa hợp lệ hoặc tài khoản đã xác thực.

## Thay đổi chính sách

Chính sách sẽ được cập nhật khi phạm vi dữ liệu hoặc cách sử dụng thay đổi. Ngày cập nhật mới nhất luôn được ghi ở đầu tài liệu.

## Liên hệ

Hỗ trợ và yêu cầu về quyền riêng tư: <https://github.com/fantasy-1608/Project-OASIS/issues>
