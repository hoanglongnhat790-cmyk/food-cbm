# CBM FOOD

Website đồ ăn gồm cửa hàng và trang quản trị, viết bằng JavaScript thuần (không framework).
Chạy hoàn toàn trên trình duyệt, dữ liệu lưu bằng `localStorage`.

## Chạy ngay

```bash
npm install          # chỉ cần Vite
npm run dev          # http://localhost:5173
```

## Bản demo một lệnh

```bash
npm run demo
```

Lệnh này build rồi mở máy chủ tĩnh tại:

| Trang | Địa chỉ |
| --- | --- |
| Cửa hàng | <http://localhost:4173/> |
| Quản trị | <http://localhost:4173/admin.html> |

Máy chủ tĩnh nằm trong `scripts/demo.mjs` và **không dùng gói nào**, nên có thể
chạy ngay cả khi chưa cài dependencies.

Tùy chọn:

```bash
npm run demo -- --port 5000      # đổi cổng
npm run demo -- --no-build       # chỉ phục vụ dist/ đã có sẵn
```

## Tài khoản

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Quản trị | `admin@cbmfood.vn` | `admin123` |
| Khách | tự đăng ký | tự chọn, từ 6 ký tự |

Đăng nhập bằng tài khoản quản trị sẽ tự chuyển thẳng sang trang quản trị.
Tài khoản quản trị được tạo tự động khi app chạy lần đầu, không cần đăng ký.

## Tính năng

**Cửa hàng**

- Danh mục món và lọc theo danh mục
- Tìm kiếm không dấu, nhiều từ khoá không cần đúng thứ tự (`pho bo` ra *Phở Bò*)
- Giỏ hàng: tăng giảm số lượng, xoá món, thanh tiến trình miễn phí giao từ 150.000đ
- Đặt món kiểu app food: chọn giao tận nơi/tự đến lấy, phương thức thanh toán, voucher và màn xác nhận đơn chi tiết
- Theo dõi đơn với timeline: chờ xác nhận → đã xác nhận → đang giao → hoàn thành
- Đăng ký / đăng nhập / xem tài khoản / đăng xuất

**Quản trị**

- Tổng quan: doanh thu, số đơn, món bán chạy, trạng thái đơn, tồn kho và số lượng nguyên liệu
- Điều phối ship: danh sách đơn đã xác nhận/đang giao và chuyển trạng thái giao hàng
- Chi tiết khách hàng/đơn: thông tin nhận hàng, món, nguyên liệu, thanh toán và lịch sử trạng thái
- Quản lý nguyên liệu theo từng món
- Quản lý món: thêm, sửa, xoá, ẩn/hiện
- Xử lý đơn: đổi trạng thái, xem chi tiết
- Khôi phục dữ liệu mẫu

## Responsive

| Mốc | Dùng cho |
| --- | --- |
| ≤420px | điện thoại nhỏ |
| ≤600px | điện thoại |
| ≤760px | tablet dọc, header xuống nhiều hàng, menu cuộn ngang |
| ≤900px | tablet ngang, lưới 2 cột |
| ≤1024px | máy tính nhỏ |
| `pointer: coarse` | thiết bị cảm ứng, vùng chạm tối thiểu 44px |

## Kiểm thử

```bash
npm test
```

109 test cho món ăn, giỏ hàng, đặt hàng, thanh toán, xác thực và tìm kiếm.
Test chạy bằng `node --test` của Node, không cần framework.

```bash
npm run build      # build ra dist/
npm run preview    # xem bản build
```

## Cấu trúc

```
index.html            trang cửa hàng
admin.html            trang quản trị
vercel.json           cấu hình deploy Vercel
vite.config.js        build multi-page
scripts/demo.mjs      máy chủ tĩnh cho bản demo (không phụ thuộc)
src/
  main.js             giao diện cửa hàng
  admin.js            giao diện quản trị
  store.js            dữ liệu món ăn, đơn hàng
  cart.js             giỏ hàng
  auth.js             đăng nhập, phân quyền
  search.js           logic tìm kiếm
  style.css           CSS cửa hàng
  admin.css           CSS quản trị
  data/foods.json     dữ liệu mẫu ban đầu
tests/                test tự động
```

## Lưu ý bảo mật

- Mật khẩu lưu dạng băm PBKDF2, nhưng **salt cố định** và tài khoản admin nằm trong mã nguồn.
  Đủ dùng cho đồ án, **không dùng thật**.
- Không có máy chủ. Dữ liệu nằm trong `localStorage` của từng trình duyệt:
  không đồng bộ giữa máy, không có ai đó khác thấy, xoá dữ liệu trình duyệt là mất sạch.
- Phân quyền chỉ là kiểm tra phía trình duyệt, ai cũng sửa được trong devtools.
  Muốn an toàn thật thì cần máy chủ kiểm tra lại phía sau.

## Shipper
- Trang đăng nhập: `/shipper.html`
- Tài khoản demo: `shipper@cbmfood.vn`
- Mật khẩu demo: `shipper123`
- Luồng: nhận đơn → bắt đầu giao → chụp ảnh giao hàng → hoàn thành.

## Ảnh món ăn trong Admin
Trong **Quản trị → Món ăn → Thêm món ăn**, chọn file ở mục **Ảnh món ăn**. Không cần nhập URL. Ảnh được nén phía trình duyệt trước khi lưu vào localStorage.
