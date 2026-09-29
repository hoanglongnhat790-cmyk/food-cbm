import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { installGlobals } from './setup.mjs'

const storage = installGlobals()
const auth = await import('../src/auth.js')

const ADMIN = { email: 'admin@cbmfood.vn', password: 'admin123' }

const validUser = (overrides = {}) => ({
  name: 'Nguyễn Văn A',
  email: 'khach@example.com',
  password: 'matkhau123',
  confirm: 'matkhau123',
  phone: '0901234567',
  ...overrides,
})

async function expectError(fn, field) {
  try {
    await fn()
  } catch (error) {
    assert.equal(error.name, 'AuthError', `phải là AuthError, nhận ${error.name}`)
    if (field) assert.equal(error.field, field, `field phải là "${field}"`)
    return error
  }
  assert.fail('phải ném lỗi nhưng lại trả về bình thường')
}

describe('auth - đăng ký', () => {
  before(async () => {
    await auth.init()
  })

  it('đăng ký thành công tạo tài khoản và đăng nhập luôn', async () => {
    const user = await auth.register(validUser())

    assert.equal(user.name, 'Nguyễn Văn A')
    assert.equal(user.email, 'khach@example.com')
    assert.equal(user.role, 'customer')
    assert.ok(user.id)
    assert.equal(auth.isLoggedIn(), true)
    assert.equal(auth.getUser().email, 'khach@example.com')
  })

  it('không bao giờ lưu mật khẩu dạng chữ thường', async () => {
    const raw = storage.getItem('cbmfood.auth.users.v1')
    assert.ok(raw.includes('matkhau123') === false, 'mật khẩu thô bị lưu vào storage')
    assert.ok(raw.includes('"hash"'))
    assert.ok(raw.includes('"salt"'))
  })

  it('mỗi tài khoản có salt riêng nên hash không trùng nhau', () => {
    const users = JSON.parse(storage.getItem('cbmfood.auth.users.v1'))
    const salts = users.map((user) => user.salt)
    assert.equal(new Set(salts).size, salts.length)
  })

  it('tài khoản người dùng không có quyền admin', () => {
    const customer = JSON.parse(storage.getItem('cbmfood.auth.users.v1')).find(
      (user) => user.email === 'khach@example.com',
    )
    assert.equal(customer.role, 'customer')
    assert.notEqual(customer.role, 'admin')
  })

  it('từ chối họ tên quá ngắn', async () => {
    await expectError(() => auth.register(validUser({ name: 'A' })), 'name')
  })

  it('từ chối email không hợp lệ', async () => {
    await expectError(() => auth.register(validUser({ email: 'khach@@x' })), 'email')
  })

  it('từ chối email đã đăng ký', async () => {
    await expectError(
      () => auth.register(validUser({ email: 'KHACH@example.com' })),
      'email',
    )
  })

  it('từ chối mật khẩu ngắn hơn 6 ký tự', async () => {
    await expectError(
      () =>
        auth.register(
          validUser({
            email: 'shortpass@example.com',
            password: 'a1b2c',
            confirm: 'a1b2c',
          }),
        ),
      'password',
    )
  })

  it('từ chối xác nhận mật khẩu không khớp', async () => {
    await expectError(() => auth.register(validUser({ confirm: 'khac123' })), 'confirm')
  })

  it('từ chối số điện thoại sai định dạng', async () => {
    await expectError(() => auth.register(validUser({ phone: '12345' })), 'phone')
  })

  it('cho phép bỏ trống số điện thoại', async () => {
    const user = await auth.register(
      validUser({ email: 'khach2@example.com', phone: '' }),
    )
    assert.equal(user.phone, '')
  })

  it('email được chuẩn hoá về chữ thường', async () => {
    const user = await auth.register(
      validUser({ email: '  MixedCase@Example.COM ' }),
    )
    assert.equal(user.email, 'mixedcase@example.com')
  })
})

describe('auth - đăng nhập', () => {
  before(async () => {
    await auth.init()
  })

  it('tài khoản admin mặc định đã được tạo sẵn', () => {
    const users = auth.listUsers()
    const admin = users.find((user) => user.role === 'admin')
    assert.ok(admin, 'phải có tài khoản admin')
    assert.equal(admin.email, 'admin@cbmfood.vn')
  })

  it('đăng nhập đúng mật khẩu thành công', async () => {
    const user = await auth.login({ ...ADMIN })
    assert.equal(user.email, ADMIN.email)
    assert.equal(user.role, 'admin')
    assert.equal(auth.isLoggedIn(), true)
  })

  it('đăng nhập sai mật khẩu bị từ chối và không lộ thông tin', async () => {
    await auth.login({ ...ADMIN })

    const wrongPass = await expectError(() =>
      auth.login({ email: ADMIN.email, password: 'sairoi' }),
    )
    const unknownUser = await expectError(() =>
      auth.login({ email: 'khongco@real.com', password: 'batky123' }),
    )

    assert.equal(wrongPass.message, unknownUser.message, 'hai lỗi phải chung thông báo')
    assert.equal(auth.isLoggedIn(), true, 'đăng nhập sai KHÔNG được đăng xuất người đang dùng')
  })

  it('đăng nhập email không tồn tại bị từ chối', async () => {
    await expectError(
      () => auth.login({ email: 'khongco@real.com', password: 'batky123' }),
    )
  })

  it('đăng nhập tài khoản khách hàng không lấy được quyền admin', async () => {
    await auth.register(
      validUser({ email: 'khach3@example.com', password: 'khach123', confirm: 'khach123' }),
    )
    const user = await auth.login({
      email: 'khach3@example.com',
      password: 'khach123',
    })
    assert.equal(user.role, 'customer')
    assert.equal(auth.isAdmin(), false)
    assert.equal(auth.canAccessAdmin(), false)
  })

  it('đăng nhập lại tài khoản admin khôi phục quyền', async () => {
    const user = await auth.login({ ...ADMIN })
    assert.equal(auth.isAdmin(), true)
    assert.equal(auth.canAccessAdmin(), true)
    assert.equal(user.role, 'admin')
  })
})

describe('auth - phiên và đăng xuất', () => {
  before(async () => {
    await auth.init()
  })

  it('đăng xuất xoá phiên', async () => {
    await auth.login({ ...ADMIN })
    assert.equal(auth.isLoggedIn(), true)

    auth.logout()
    assert.equal(auth.isLoggedIn(), false)
    assert.equal(auth.getUser(), null)
    assert.equal(auth.isAdmin(), false)
  })

  it('phiên hợp lệ vẫn giữ nguyên sau khi tải lại trang', async () => {
    await auth.login({ ...ADMIN })
    assert.ok(storage.getItem('cbmfood.auth.session.v1'))

    const reloaded = await import('../src/auth.js?reload=1')
    assert.equal(reloaded.isLoggedIn(), true, 'tải lại trang vẫn giữ phiên')
    assert.equal(reloaded.isAdmin(), true)
    assert.equal(reloaded.getUser().email, ADMIN.email)
  })

  it('phiên hết hạn bị coi như chưa đăng nhập khi tải lại trang', async () => {
    await auth.login({ ...ADMIN })

    const session = JSON.parse(storage.getItem('cbmfood.auth.session.v1'))
    session.expiresAt = Date.now() - 1000
    storage.setItem('cbmfood.auth.session.v1', JSON.stringify(session))

    const reloaded = await import('../src/auth.js?reload=expired')
    assert.equal(reloaded.getUser(), null, 'phiên quá hạn phải trả về null')
    assert.equal(reloaded.isAdmin(), false, 'không được cấp quyền admin từ phiên hỏng')
    assert.equal(
      storage.getItem('cbmfood.auth.session.v1'),
      null,
      'phải dọn phiên hỏng khỏi storage',
    )
  })

  it('đăng xuất thì phiên bị xoá và không khôi phục được sau khi tải lại', async () => {
    await auth.login({ ...ADMIN })
    auth.logout()

    const reloaded = await import('../src/auth.js?reload=afterlogout')
    assert.equal(reloaded.isLoggedIn(), false)
    assert.equal(reloaded.canAccessAdmin(), false)
  })
})

describe('auth - cập nhật hồ sơ', () => {
  it('cập nhật được tên và số điện thoại', async () => {
    await auth.register(
      validUser({ email: 'sua@example.com', password: 'khach123', confirm: 'khach123' }),
    )
    const updated = auth.updateProfile({ name: 'Tên Mới', phone: '0912345678' })

    assert.equal(updated.name, 'Tên Mới')
    assert.equal(updated.phone, '0912345678')
  })

  it('từ chối cập nhật khi chưa đăng nhập', () => {
    auth.logout()
    assert.throws(() => auth.updateProfile({ name: 'Ai Đó', phone: '' }), {
      name: 'AuthError',
    })
  })

  it('từ chối số điện thoại sai khi cập nhật', async () => {
    await auth.login({ email: 'sua@example.com', password: 'khach123' })
    assert.throws(() => auth.updateProfile({ name: 'Tên Mới', phone: 'abc' }), {
      name: 'AuthError',
    })
  })
})
