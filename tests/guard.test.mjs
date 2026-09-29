import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { installGlobals } from './setup.mjs'

const storage = installGlobals()
const db = await import('../src/store.js')
const cart = await import('../src/cart.js')

const ADMIN = { email: 'admin@cbmfood.vn', password: 'admin123' }

let instance = 0

const freshAuth = async () => {
  storage.removeItem('cbmfood.auth.users.v1')
  storage.removeItem('cbmfood.auth.session.v1')
  instance += 1
  const module = await import(`../src/auth.js?fresh=${instance}`)
  await module.init()
  return module
}

const reset = async () => {
  db.resetData()
  cart.clear()
  return freshAuth()
}

const registerCustomer = (auth, email) =>
  auth.register({
    name: 'Khách Hàng',
    email,
    password: 'khach123',
    confirm: 'khach123',
  })

describe('guard - truy cập trang admin', () => {
  let auth

  beforeEach(async () => {
    auth = await reset()
  })

  it('khách chưa đăng nhập không được vào admin', () => {
    assert.equal(auth.isLoggedIn(), false)
    assert.equal(auth.canAccessAdmin(), false, 'phải chặn khách vãng lai')
  })

  it('khách đã đăng ký vẫn không được vào admin', async () => {
    const user = await registerCustomer(auth, 'khach@example.com')
    assert.equal(user.role, 'customer')
    assert.equal(auth.isLoggedIn(), true, 'đã đăng nhập')
    assert.equal(auth.canAccessAdmin(), false, 'nhưng không có quyền admin')
  })

  it('tài khoản admin được vào', async () => {
    await auth.login({ ...ADMIN })
    assert.equal(auth.canAccessAdmin(), true)
  })

  it('đăng xuất lập tức mất quyền admin', async () => {
    await auth.login({ ...ADMIN })
    assert.equal(auth.canAccessAdmin(), true)

    auth.logout()
    assert.equal(auth.canAccessAdmin(), false)
  })

  it('người dùng không thể tự tạo role admin qua đăng ký', async () => {
    const user = await auth.register({
      name: 'Hacker',
      email: 'hacker@example.com',
      password: 'khach123',
      confirm: 'khach123',
      role: 'admin',
    })
    assert.equal(user.role, 'customer', 'role trong input phải bị bỏ qua')
  })

  it('không có tài khoản nào ngoài role hợp lệ', async () => {
    await registerCustomer(auth, 'role-hop-le@example.com')
    auth.listUsers().forEach((user) => {
      assert.ok(['admin', 'customer'].includes(user.role), `role lạ: ${user.role}`)
    })
  })

  it('sửa storage để tự lên admin là hạn chế của bản client-side', async () => {
    await registerCustomer(auth, 'tu-than@example.com')
    const users = JSON.parse(storage.getItem('cbmfood.auth.users.v1'))
    users.forEach((user) => {
      if (user.email === 'tu-than@example.com') user.role = 'admin'
    })
    storage.setItem('cbmfood.auth.users.v1', JSON.stringify(users))

    instance += 1
    const reloaded = await import(`../src/auth.js?fresh=${instance}`)
    await reloaded.init()
    const user = reloaded
      .listUsers()
      .find((item) => item.email === 'tu-than@example.com')

    assert.equal(
      user.role,
      'admin',
      'KHÔNG có bảo mật thật khi toàn bộ dữ liệu nằm ở trình duyệt: ' +
        'sửa localStorage là lên quyền admin. Cần backend mới chặn được.',
    )
  })
})

describe('guard - dữ liệu phiên bị làm giả', () => {
  it('phiên trỏ tới user không tồn tại bị từ chối', async () => {
    const auth = await reset()
    await auth.login({ ...ADMIN })
    storage.setItem(
      'cbmfood.auth.session.v1',
      JSON.stringify({
        userId: 'khong-ton-tai',
        expiresAt: Date.now() + 60_000,
      }),
    )

    instance += 1
    const reloaded = await import(`../src/auth.js?fresh=${instance}`)
    assert.equal(reloaded.getUser(), null)
    assert.equal(reloaded.canAccessAdmin(), false)
  })

  it('phiên không có expiresAt bị từ chối', async () => {
    await reset()
    storage.setItem('cbmfood.auth.session.v1', JSON.stringify({ userId: 'bat-ky' }))

    instance += 1
    const reloaded = await import(`../src/auth.js?fresh=${instance}`)
    assert.equal(reloaded.getUser(), null)
  })

  it('storage hỏng không làm sập trang', async () => {
    storage.setItem('cbmfood.auth.users.v1', 'khong-phai-json')
    storage.setItem('cbmfood.auth.session.v1', 'khong-phai-json')

    instance += 1
    const reloaded = await import(`../src/auth.js?fresh=${instance}`)
    await reloaded.init()
    assert.doesNotThrow(() => reloaded.getUser())
    assert.equal(reloaded.isLoggedIn(), false)
  })
})

describe('guard - tác vụ admin theo vai trò', () => {
  let auth

  beforeEach(async () => {
    auth = await reset()
  })

  it('khách đã đăng nhập vẫn bị khoá quyền quản trị', async () => {
    const customer = await registerCustomer(auth, 'khoa-quyen@example.com')
    assert.equal(customer.role, 'customer')
    assert.equal(auth.isLoggedIn(), true)
    assert.equal(
      auth.canAccessAdmin(),
      false,
      'UI phải khoá nút sửa/xoá và chuyển trạng thái cho khách',
    )
  })

  it('mọi thao tác quản lý đều có hàm kiểm tra quyền đi kèm', () => {
    const adminOps = ['createDish', 'updateDish', 'removeDish', 'updateOrderStatus']
    adminOps.forEach((name) => {
      assert.equal(typeof db[name], 'function', `${name} phải tồn tại`)
    })
    assert.equal(typeof auth.canAccessAdmin, 'function', 'phải có hàm kiểm tra quyền')
    assert.equal(typeof auth.isAdmin, 'function')
  })
})

describe('guard - đặt hàng của khách đã đăng nhập', () => {
  let auth

  beforeEach(async () => {
    auth = await reset()
  })

  it('ghi đúng userId của người đặt', async () => {
    const user = await registerCustomer(auth, 'mua-hang@example.com')
    const order = db.createOrder({
      customer: user.name,
      phone: user.phone || '0901234567',
      address: '45 Lý Thường Kiệt, Quận 1, TP.HCM',
      items: [{ name: 'Bánh mì que CBM', price: 30000, qty: 1 }],
      shipping: 15000,
      userId: user.id,
    })

    assert.equal(order.userId, user.id)
  })

  it('khách đặt món không sinh quyền admin', async () => {
    const user = await registerCustomer(auth, 'mua-hang-2@example.com')
    db.createOrder({
      customer: user.name,
      phone: '0901234567',
      address: '45 Lý Thường Kiệt, Quận 1, TP.HCM',
      items: [{ name: 'Bánh mì que CBM', price: 30000, qty: 1 }],
      shipping: 15000,
      userId: user.id,
    })

    assert.equal(auth.isAdmin(), false)
    assert.equal(auth.canAccessAdmin(), false)
  })
})
