import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { installGlobals } from './setup.mjs'

const storage = installGlobals()
const cart = await import('../src/cart.js')
const db = await import('../src/store.js')
const auth = await import('../src/auth.js')
const { ORDER_STATUS } = await import('../src/seed.js')

const reset = async () => {
  db.resetData()
  cart.clear()
  await auth.init()
}

const validOrder = (overrides = {}) => ({
  customer: 'Nguyễn Thị Mai',
  phone: '0903221145',
  address: '128 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
  items: [{ name: 'Phở bò đặc biệt', price: 65000, qty: 2 }],
  shipping: 15000,
  payment: 'cod',
  note: 'Ít hành nhé',
  ...overrides,
})

const expectError = (fn, field) => {
  try {
    fn()
  } catch (error) {
    assert.equal(error.name, 'OrderError', `phải là OrderError, nhận ${error.name}`)
    if (field) assert.equal(error.field, field, `field phải là "${field}"`)
    return error
  }
  assert.fail('phải ném lỗi nhưng lại trả về bình thường')
}

describe('order - đặt hàng thành công', () => {
  beforeEach(reset)

  it('tạo đơn với đủ thông tin', () => {
    const before = db.getOrders().length
    const order = db.createOrder(validOrder())

    assert.equal(db.getOrders().length, before + 1)
    assert.equal(order.status, 'pending')
    assert.equal(order.customer, 'Nguyễn Thị Mai')
    assert.equal(order.phone, '0903221145')
    assert.equal(order.items[0].name, 'Phở bò đặc biệt')
    assert.equal(order.items[0].qty, 2)
    assert.equal(order.shipping, 15000)
    assert.equal(order.payment, 'cod')
    assert.ok(order.id.startsWith('CB-'))
  })

  it('đơn mới nằm đầu danh sách', () => {
    const order = db.createOrder(validOrder())
    assert.equal(db.getOrders()[0].id, order.id)
  })

  it('mã đơn tăng dần và không trùng', () => {
    const first = db.createOrder(validOrder())
    const second = db.createOrder(validOrder())

    assert.notEqual(first.id, second.id)
    const ids = db.getOrders().map((order) => order.id)
    assert.equal(new Set(ids).size, ids.length, 'không được trùng mã đơn')
  })

  it('ghi lại thời điểm tạo và lịch sử ban đầu', () => {
    const order = db.createOrder(validOrder())

    assert.ok(order.createdAt)
    assert.equal(order.updatedAt, order.createdAt)
    assert.equal(order.history.length, 1)
    assert.equal(order.history[0].status, 'pending')
  })

  it('đặt nhiều món trong một đơn', () => {
    const order = db.createOrder(
      validOrder({
        items: [
          { name: 'Phở bò đặc biệt', price: 65000, qty: 1 },
          { name: 'Bánh mì que CBM', price: 30000, qty: 3 },
        ],
      }),
    )

    assert.equal(order.items.length, 2)
    const total =
      order.items.reduce((sum, item) => sum + item.price * item.qty, 0) +
      order.shipping
    assert.equal(total, 65000 + 90000 + 15000)
  })

  it('ghi nhận người đặt khi đã đăng nhập', async () => {
    const user = await auth.register({
      name: 'Khách Hàng',
      email: 'dat-hang@example.com',
      password: 'khach123',
      confirm: 'khach123',
    })
    const order = db.createOrder(validOrder({ userId: user.id }))

    assert.equal(order.userId, user.id)
  })

  it('cho phép đặt không cần đăng nhập', () => {
    auth.logout()
    const order = db.createOrder(validOrder())
    assert.equal(order.userId, null)
  })
})

describe('order - kiểm tra dữ liệu đầu vào', () => {
  beforeEach(reset)

  it('từ chối giỏ hàng rỗng', () => {
    expectError(() => db.createOrder(validOrder({ items: [] })), 'items')
  })

  it('từ chối thiếu tên người nhận', () => {
    expectError(() => db.createOrder(validOrder({ customer: '' })), 'customer')
    expectError(() => db.createOrder(validOrder({ customer: 'A' })), 'customer')
  })

  it('từ chối số điện thoại sai', () => {
    expectError(() => db.createOrder(validOrder({ phone: '123' })), 'phone')
    expectError(() => db.createOrder(validOrder({ phone: '19001234' })), 'phone')
  })

  it('từ chối địa chỉ quá ngắn hoặc quá dài', () => {
    expectError(() => db.createOrder(validOrder({ address: 'Q1' })), 'address')
    expectError(
      () => db.createOrder(validOrder({ address: 'a'.repeat(201) })),
      'address',
    )
  })

  it('từ chối số lượng không hợp lệ', () => {
    expectError(
      () => db.createOrder(validOrder({ items: [{ name: 'Phở bò đặc biệt', price: 65000, qty: 0 }] })),
      'items',
    )
    expectError(
      () => db.createOrder(validOrder({ items: [{ name: 'Phở bò đặc biệt', price: 65000, qty: 999 }] })),
      'items',
    )
  })

  it('từ chối món không có tên', () => {
    expectError(
      () => db.createOrder(validOrder({ items: [{ name: '  ', price: 1000, qty: 1 }] })),
      'items',
    )
  })

  it('từ chối giá âm', () => {
    expectError(
      () => db.createOrder(validOrder({ items: [{ name: 'X', price: -5, qty: 1 }] })),
      'items',
    )
  })

  it('không tạo đơn khi dữ liệu sai', () => {
    const before = db.getOrders().length
    try {
      db.createOrder(validOrder({ phone: 'sai' }))
    } catch {
      /* cố tình lỗi */
    }
    assert.equal(db.getOrders().length, before, 'lỗi không được tạo đơn rác')
  })
})

describe('order - chống gian lận giá và món không hợp lệ', () => {
  beforeEach(reset)

  it('từ chối giá khác giá trong thực đơn', () => {
    const error = expectError(
      () =>
        db.createOrder(
          validOrder({
            items: [{ name: 'Phở bò đặc biệt', price: 1, qty: 1 }],
          }),
        ),
      'items',
    )
    assert.match(error.message, /vừa thay đổi/)
  })

  it('phát hiện giá bị sửa sau khi thêm vào giỏ', () => {
    cart.add('MH-001', 2)
    const payload = cart.checkoutPayload()
    db.updateDish('MH-001', { ...db.getDish('MH-001'), price: 1 })

    expectError(() => db.createOrder(validOrder({ items: payload.items })), 'items')
  })

  it('từ chối đặt món đang tạm ngưng', () => {
    cart.add('MH-001', 1)
    const payload = cart.checkoutPayload()
    db.updateDish('MH-001', { ...db.getDish('MH-001'), status: 'unavailable' })

    const error = expectError(
      () => db.createOrder(validOrder({ items: payload.items })),
      'items',
    )
    assert.match(error.message, /tạm ngưng/)
  })

  it('cho phép đặt món bị xoá khỏi thực đơn (đơn cũ vẫn hợp lệ)', () => {
    db.removeDish('MH-001')
    const order = db.createOrder(
      validOrder({ items: [{ name: 'Phở bò đặc biệt', price: 65000, qty: 1 }] }),
    )
    assert.equal(order.items[0].name, 'Phở bò đặc biệt')
  })
})

describe('order - tăng lượt bán', () => {
  beforeEach(reset)

  it('lượt bán tăng theo số lượng đặt', () => {
    const soldBefore = db.getDish('MH-001').sold
    db.createOrder(validOrder())

    assert.equal(db.getDish('MH-001').sold, soldBefore + 2)
  })

  it('cộng dồn qua nhiều đơn', () => {
    const soldBefore = db.getDish('MH-001').sold
    db.createOrder(validOrder())
    db.createOrder(validOrder())

    assert.equal(db.getDish('MH-001').sold, soldBefore + 4)
  })

  it('không bị trùng lượt bán khi cùng món nhiều lần', () => {
    const soldBefore = db.getDish('MH-001').sold
    db.createOrder(
      validOrder({
        items: [
          { name: 'Phở bò đặc biệt', price: 65000, qty: 2 },
          { name: 'Phở bò đặc biệt', price: 65000, qty: 3 },
        ],
      }),
    )
    assert.equal(db.getDish('MH-001').sold, soldBefore + 5)
  })

  it('không cộng nhầm cho món khác cùng tên trùng', () => {
    const other = db.getDish('MH-003').sold
    db.createOrder(validOrder())
    assert.equal(db.getDish('MH-003').sold, other)
  })
})

describe('order - luồng trạng thái', () => {
  beforeEach(reset)

  it('đi trọn luồng từ chờ xác nhận đến hoàn thành', () => {
    const order = db.createOrder(validOrder())
    const flow = ['confirmed', 'preparing', 'delivering', 'completed']

    flow.forEach((status) => {
      db.updateOrderStatus(order.id, status)
    })

    assert.equal(db.getOrder(order.id).status, 'completed')
    assert.equal(db.getOrder(order.id).history.length, 5, 'ghi lại đủ 5 mốc')
  })

  it('ghi đúng mốc thời gian cho từng bước', () => {
    const order = db.createOrder(validOrder())
    db.updateOrderStatus(order.id, 'confirmed')
    const updated = db.getOrder(order.id)

    assert.equal(updated.history[0].status, 'pending')
    assert.equal(updated.history[1].status, 'confirmed')
    assert.ok(updated.history[1].at, 'mốc thời gian phải có')
    assert.ok(
      new Date(updated.updatedAt) >= new Date(order.updatedAt),
      'updatedAt phải không sớm hơn lúc tạo đơn',
    )
  })

  it('cho phép chuyển thẳng sang hoàn thành', () => {
    const order = db.createOrder(validOrder())
    db.updateOrderStatus(order.id, 'completed')
    assert.equal(db.getOrder(order.id).status, 'completed')
  })

  it('cho phép huỷ đơn đang xử lý', () => {
    const order = db.createOrder(validOrder())
    db.updateOrderStatus(order.id, 'preparing')
    db.updateOrderStatus(order.id, 'cancelled')

    assert.equal(db.getOrder(order.id).status, 'cancelled')
  })

  it('cho phép mở lại đơn đã huỷ', () => {
    const order = db.createOrder(validOrder())
    db.updateOrderStatus(order.id, 'cancelled')
    db.updateOrderStatus(order.id, 'confirmed')

    assert.equal(db.getOrder(order.id).status, 'confirmed')
  })

  it('không ghi thêm mốc khi đặt lại trạng thái cũ', () => {
    const order = db.createOrder(validOrder())
    const before = db.getOrder(order.id).history.length

    assert.equal(db.updateOrderStatus(order.id, 'pending'), null)
    assert.equal(db.getOrder(order.id).history.length, before)
  })

  it('từ chối đổi trạng thái của đơn không tồn tại', () => {
    assert.equal(db.updateOrderStatus('CB-KHONG-CO', 'confirmed'), null)
  })

  it('mọi trạng thái đều có nhãn tiếng Việt', () => {
    Object.values(ORDER_STATUS).forEach((meta) => {
      assert.ok(meta.label, 'thiếu nhãn')
      assert.ok(meta.tone, 'thiếu màu')
    })
  })
})

describe('order - lưu trữ', () => {
  it('đơn mới được lưu xuống localStorage', () => {
    reset()
    const order = db.createOrder(validOrder())
    const raw = JSON.parse(storage.getItem('cbmfood.admin.orders.v1'))

    assert.ok(raw.some((item) => item.id === order.id))
  })

  it('giỏ hàng vẫn còn sau khi đặt món (chưa tự xoá)', () => {
    reset()
    cart.add('MH-001', 1)
    const payload = cart.checkoutPayload()
    db.createOrder(validOrder({ items: payload.items }))

    assert.equal(cart.count(), 1, 'việc xoá giỏ thuộc về tầng giao diện')
  })

  it('khôi phục dữ liệu mẫu xoá đơn do người dùng tạo', () => {
    reset()
    db.createOrder(validOrder())
    const before = db.getOrders().length

    db.resetData()
    assert.equal(db.getOrders().length, 10, 'phải về lại 10 đơn mẫu')
    assert.notEqual(db.getOrders().length, before)
  })
})
