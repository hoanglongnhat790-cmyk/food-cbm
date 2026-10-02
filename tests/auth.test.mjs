import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { STORAGE } from './helpers.mjs'

/* auth.js không import module nội bộ nên cache-bust được an toàn. */
let round = 0
const freshAuth = async () => {
  STORAGE.clear()
  round += 1
  const auth = await import(`../src/auth.js?r=${round}`)
  await auth.init()
  return auth
}

beforeEach(() => {
  STORAGE.clear()
})

/* Trình duyệt có thể còn dữ liệu admin hỏng từ bản cũ
   (salt và hash không khớp). Khi đó phải tự tạo lại, nếu không
   thì không bao giờ đăng nhập được admin. */
const BROKEN_ADMIN = {
  id: 'U-admin',
  name: 'Quản trị viên',
  email: 'admin@cbmfood.vn',
  phone: '0900000001',
  role: 'admin',
  salt: 'salt-cu-ban-loi',
  hash: 'hash-cu-ban-loi-khong-khop',
}

/* Phai nap san du lieu vao storage TRUOC khi import module,
   vi freshAuth() se xoa sach storage. */
const authSeededWith = async (users) => {
  STORAGE.clear()
  STORAGE.setItem('cbmfood.users', JSON.stringify(users))
  round += 1
  const auth = await import(`../src/auth.js?r=${round}`)
  await auth.init()
  return auth
}

test('tu tao lai admin bi hong de dang nhap duoc', async () => {
  const auth = await authSeededWith([BROKEN_ADMIN])
  const res = await auth.login({ email: 'admin@cbmfood.vn', password: 'admin123' })
  assert.ok(!res.error, `admin hong van khong vao duoc: ${res.error}`)
  assert.equal(res.user.role, 'admin')
})

test('tu tao lai admin ma khong lam mat tai khoan khach', async () => {
  const khach = {
    id: 'U-kh',
    name: 'Khach Hang',
    email: 'kh@example.com',
    phone: '0900000002',
    role: 'customer',
    salt: 's-khach',
    hash: 'h-khach',
  }
  const auth = await authSeededWith([BROKEN_ADMIN, khach])
  const emails = auth.listUsers().map((u) => u.email)
  assert.ok(emails.includes('kh@example.com'), 'tai khoan khach phai con nguyen')
  assert.equal(auth.listUsers().filter((u) => u.role === 'admin').length, 1, 'chi co mot admin')
})

test('admin hop le thi giu nguyen, khong tao lai', async () => {
  /* Tao admin hop le truoc, lay salt/hash that tu storage. */
  const first = await freshAuth()
  const good = JSON.parse(STORAGE.getItem('cbmfood.users')).find((u) => u.role === 'admin')

  const auth = await authSeededWith([good])
  const after = JSON.parse(STORAGE.getItem('cbmfood.users')).find((u) => u.role === 'admin')
  assert.equal(after.salt, good.salt, 'salt phai giu nguyen')
  assert.equal(after.hash, good.hash, 'hash phai giu nguyen')
  const res = await auth.login({ email: 'admin@cbmfood.vn', password: 'admin123' })
  assert.ok(!res.error, 'van phai dang nhap duoc')
  assert.ok(first)
})

test('tai khoan khach dang nhap duoc sau khi tao lai admin', async () => {
  const khach = {
    id: 'U-kh',
    name: 'Khach Hang',
    email: 'kh@example.com',
    phone: '0900000002',
    role: 'customer',
    salt: 's-khach',
    hash: 'h-khach',
  }
  const auth = await authSeededWith([BROKEN_ADMIN, khach])
  const res = await auth.login({ email: 'kh@example.com', password: 'batky' })
  assert.equal(res.error, 'Mật khẩu không đúng', 'hash cu tai khoan khach bi ghi de')
})

test('khoi tao se tao san tai khoan admin', async () => {
  const auth = await freshAuth()
  const admins = auth.listUsers().filter((u) => u.role === 'admin')
  assert.equal(admins.length, 1)
  assert.equal(admins[0].email, 'admin@cbmfood.vn')
})

test('admin duoc dang nhap bang mat khau mac dinh', async () => {
  const auth = await freshAuth()
  const res = await auth.login({ email: 'admin@cbmfood.vn', password: 'admin123' })
  assert.ok(!res.error, `dang nhap that bai: ${res.error}`)
  assert.equal(res.user.role, 'admin')
  assert.equal(auth.canAccessAdmin(), true)
})

test('mat khau sai bi tu choi', async () => {
  const auth = await freshAuth()
  const res = await auth.login({ email: 'admin@cbmfood.vn', password: 'sai-mat-khau' })
  assert.ok(res.error, 'phai bao loi')
  assert.equal(auth.canAccessAdmin(), false)
})

test('email chua dang ky bi tu choi', async () => {
  const auth = await freshAuth()
  assert.ok((await auth.login({ email: 'khong@co.vn', password: 'abc123' })).error)
})

test('dang ky tai khoan moi thanh cong', async () => {
  const auth = await freshAuth()
  const res = await auth.register({
    name: 'Nguyễn Văn A',
    email: 'a@example.com',
    password: 'matkhau123',
    phone: '0901234567',
  })
  assert.ok(!res.error, `dang ky that bai: ${res.error}`)
  assert.equal(res.user.role, 'customer')
  assert.equal(res.user.email, 'a@example.com')
})

test('dang ky khong duoc tu lenhinh quyen admin', async () => {
  const auth = await freshAuth()
  const res = await auth.register({
    name: 'Kẻ Tự Phong',
    email: 'hacker@example.com',
    password: 'matkhau123',
    role: 'admin',
  })
  assert.equal(res.user.role, 'customer', 'khong duoc cap role admin tu phia goi')
  await auth.login({ email: 'hacker@example.com', password: 'matkhau123' })
  assert.equal(auth.canAccessAdmin(), false, 'khong duoc truy cap trang quan tri')
})

test('email trung bi tu choi', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Nguoi Mot', email: 'trung@example.com', password: 'matkhau123' })
  const res = await auth.register({ name: 'Nguoi Hai', email: 'trung@example.com', password: 'matkhau123' })
  assert.ok(res.error, 'phai bao loi email trung')
})

test('email khong hop le bi tu choi', async () => {
  const auth = await freshAuth()
  for (const email of ['khong-co-@', 'a@b', '@no.local', 'hai dau@@x.com']) {
    assert.ok(
      (await auth.register({ name: 'Ten Hop Le', email, password: 'matkhau123' })).error,
      `email ${email} phai bi tu choi`,
    )
  }
})

test('mat khau qua ngan bi tu choi', async () => {
  const auth = await freshAuth()
  assert.ok((await auth.register({ name: 'Ten Hop Le', email: 'x@y.com', password: '123' })).error)
})

test('ho ten qua ngan bi tu choi', async () => {
  const auth = await freshAuth()
  assert.ok((await auth.register({ name: 'A', email: 'x@y.com', password: 'matkhau123' })).error)
})

test('so dien thoai sai dinh dang bi tu choi', async () => {
  const auth = await freshAuth()
  assert.ok(
    (await auth.register({ name: 'Ten Hop Le', email: 'x@y.com', password: 'matkhau123', phone: '123' }))
      .error,
  )
})

test('dang ky xong thi dang nhap duoc ngay', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Nguyen Test', email: 'test@example.com', password: 'matkhau123' })
  const res = await auth.login({ email: 'test@example.com', password: 'matkhau123' })
  assert.ok(!res.error)
  assert.equal(res.user.name, 'Nguyen Test')
})

test('email khong phan biet hoa thuong', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Hoat Tu', email: 'Case@Example.com', password: 'matkhau123' })
  const res = await auth.login({ email: 'case@example.com', password: 'matkhau123' })
  assert.ok(!res.error, 'phai dang nhap duoc khong phan biet hoa thuong')
})

test('session duoc luu va xoa khi dang xuat', async () => {
  const auth = await freshAuth()
  assert.equal(auth.getUser(), null, 'chua dang nhap phai la null')
  await auth.login({ email: 'admin@cbmfood.vn', password: 'admin123' })
  assert.ok(auth.getUser(), 'phai co user sau khi dang nhap')
  auth.logout()
  assert.equal(auth.getUser(), null, 'phai null sau khi dang xuat')
})

test('mat khau khong bao gio duoc luu ban ro', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Ban Ro', email: 'ro@example.com', password: 'matkhau123' })
  const raw = STORAGE.getItem('cbmfood.users')
  assert.ok(!raw.includes('matkhau123'), 'mat khau bi luu ban ro')
  assert.ok(raw.includes('"hash"'), 'phai luu hash')
  assert.ok(raw.includes('"salt"'), 'phai luu salt')
  assert.ok(!raw.includes('"password"'), 'khong duoc luu truong password')
})

test('user cong khai khong lo thong tin nhay cam', async () => {
  const auth = await freshAuth()
  const res = await auth.register({ name: 'An Toan', email: 'an@example.com', password: 'matkhau123' })
  assert.equal(res.user.password, undefined, 'khong duoc lo mat khau')
  assert.equal(res.user.hash, undefined, 'khong duoc lo hash')
  assert.equal(res.user.salt, undefined, 'khong duoc lo salt')
})

test('cap nhat ho ten va so dien thoai', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Ten Cu', email: 'sua@example.com', password: 'matkhau123' })
  await auth.login({ email: 'sua@example.com', password: 'matkhau123' })
  const res = await auth.updateProfile({ name: 'Ten Moi', phone: '0987654321' })
  assert.ok(!res.error, `cap nhat that bai: ${res.error}`)
  assert.equal(res.user.name, 'Ten Moi')
  assert.equal(res.user.phone, '0987654321')
})

test('cap nhat khi chua dang nhap bi tu choi', async () => {
  const auth = await freshAuth()
  assert.ok((await auth.updateProfile({ name: 'Khong Hop Le' })).error)
})

test('cap nhat so dien thoai sai bi tu choi', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Sdt Sai', email: 'sdt@example.com', password: 'matkhau123' })
  await auth.login({ email: 'sdt@example.com', password: 'matkhau123' })
  assert.ok((await auth.updateProfile({ phone: 'abc' })).error)
})

test('resetUsers tao lai tai khoan admin', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Se Bi Xoa', email: 'xoa@example.com', password: 'matkhau123' })
  await auth.resetUsers()
  const emails = auth.listUsers().map((u) => u.email)
  assert.ok(!emails.includes('xoa@example.com'), 'tai khoan cu phai bi xoa')
  assert.ok(emails.includes('admin@cbmfood.vn'), 'phai co lai admin')
})

test('dang nhap admin thi landing ve trang admin', async () => {
  const auth = await freshAuth()
  const { user } = await auth.login({ email: 'admin@cbmfood.vn', password: 'admin123' })
  assert.equal(auth.landingFor(user), auth.ADMIN_URL)
  assert.equal(auth.ADMIN_URL, '/admin.html')
})

test('dang nhap khach thi o lai trang ban hang', async () => {
  const auth = await freshAuth()
  await auth.register({ name: 'Khach Hang', email: 'kh@example.com', password: 'matkhau123' })
  const { user } = await auth.login({ email: 'kh@example.com', password: 'matkhau123' })
  assert.equal(auth.landingFor(user), null, 'khach khong duoc chuyen sang trang admin')
})

test('landingFor xu ly ca truong hop rong', async () => {
  const auth = await freshAuth()
  assert.equal(auth.landingFor(null), null)
  assert.equal(auth.landingFor(undefined), null)
  assert.equal(auth.landingFor({ role: 'customer' }), null)
  assert.equal(auth.landingFor({ role: 'admin' }), auth.ADMIN_URL)
  assert.equal(auth.landingFor({}), null)
})

test('landingFor chi la quy tac don gian, quyen do gate kiem tra rieng', async () => {
  const auth = await freshAuth()
  assert.equal(auth.landingFor({ role: 'admin', email: 'x@x.com' }), '/admin.html')
  assert.equal(
    auth.canAccessAdmin(),
    false,
    'khong dang nhap thi canAccessAdmin van phai false du object co role admin',
  )
})

test('admin chua dang nhap van bi chan o cong trang admin', async () => {
  const auth = await freshAuth()
  await auth.login({ email: 'admin@cbmfood.vn', password: 'admin123' })
  auth.logout()
  assert.equal(auth.canAccessAdmin(), false, 'dang xuat roi thi khong con quyen')
})