import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { installGlobals } from './setup.mjs'

const storage = installGlobals()
const cart = await import('../src/cart.js')
const db = await import('../src/store.js')
const { FREE_SHIPPING_THRESHOLD, MAX_QTY_PER_ITEM, SHIPPING_FEE } = await import(
  '../src/seed.js'
)

const PHO = db.getDish('MH-001').price
const BANHMI = db.getDish('MH-003').price

const reset = () => {
  db.resetData()
  cart.clear()
}

describe('cart - thêm món', () => {
  beforeEach(reset)

  it('giỏ rỗng ban đầu', () => {
    assert.deepEqual(cart.getItems(), [])
    assert.equal(cart.count(), 0)
    assert.equal(cart.totals().subtotal, 0)
  })

  it('thêm món vào giỏ thành công', () => {
    const result = cart.add('MH-001', 2)

    assert.equal(result.ok, true)
    assert.equal(cart.count(), 2)
    assert.equal(cart.getItems().length, 1)
    assert.equal(cart.getItems()[0].dishId, 'MH-001')
    assert.equal(cart.getItems()[0].qty, 2)
  })

  it('thêm cùng món lần nữa thì cộng dồn số lượng', () => {
    cart.add('MH-001', 2)
    cart.add('MH-001', 3)

    assert.equal(cart.count(), 5)
    assert.equal(cart.getItems().length, 1, 'không được tạo dòng trùng')
    assert.equal(cart.getItems()[0].qty, 5)
  })

  it('thêm nhiều món khác nhau giữ thành từng dòng', () => {
    cart.add('MH-001', 1)
    cart.add('MH-003', 2)

    assert.equal(cart.getItems().length, 2)
    assert.deepEqual(
      cart.getItems().map((item) => item.dishId),
      ['MH-001', 'MH-003'],
    )
  })

  it('mặc định thêm 1 phần khi không truyền số lượng', () => {
    reset()
    cart.add('MH-001')
    assert.equal(cart.getItems()[0].qty, 1)
  })

  it('từ chối thêm món không tồn tại', () => {
    const result = cart.add('MH-999')
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'not-found')
  })

  it('từ chối thêm món đã tạm ngưng', () => {
    const result = cart.add('MH-011')
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'unavailable')
  })

  it('cho phép thêm món sắp hết', () => {
    const result = cart.add('MH-008')
    assert.equal(result.ok, true)
  })

  it('giới hạn số lượng tối đa mỗi món', () => {
    reset()
    cart.add('MH-001', 999)
    assert.equal(
      cart.getItems()[0].qty,
      MAX_QTY_PER_ITEM,
      `phải chặn ở ${MAX_QTY_PER_ITEM}`,
    )
  })

  it('không nhận số lượng âm hoặc rác', () => {
    reset()
    cart.add('MH-001', -5)
    assert.equal(cart.getItems()[0].qty, 1, 'số lượng âm phải về tối thiểu 1')
  })
})

describe('cart - sửa và xoá món', () => {
  beforeEach(reset)

  it('đổi được số lượng sang số lượng khác', () => {
    cart.add('MH-001', 2)
    const result = cart.setQty('MH-001', 7)

    assert.equal(result.ok, true)
    assert.equal(cart.getItems()[0].qty, 7)
  })

  it('đặt số lượng bằng 0 thì xoá món khỏi giỏ', () => {
    cart.setQty('MH-001', 0)
    assert.equal(cart.getItems().length, 0)
  })

  it('xoá được từng món', () => {
    cart.add('MH-001', 1)
    cart.add('MH-003', 2)
    cart.remove('MH-001')

    assert.equal(cart.getItems().length, 1)
    assert.equal(cart.getItems()[0].dishId, 'MH-003')
  })

  it('xoá món không có trong giỏ trả về not-found', () => {
    assert.equal(cart.remove('MH-999').reason, 'not-found')
  })

  it('xoá sạch giỏ', () => {
    cart.clear()
    assert.deepEqual(cart.getItems(), [])
    assert.equal(cart.clear().ok, false, 'xoá giỏ đã rỗng là thao tác vô nghĩa')
  })

  it('món bị admin xoá khỏi thực đơn không còn hiện trong giỏ', () => {
    reset()
    cart.add('MH-001', 2)
    db.removeDish('MH-001')

    assert.equal(cart.detailed().length, 0, 'phải lọc bỏ món không tồn tại')
    assert.equal(cart.totals().subtotal, 0, 'tổng tiền không được tính món ma')
  })
})

describe('cart - tính tiền', () => {
  beforeEach(reset)

  it('tính đúng tổng tiền hàng', () => {
    cart.add('MH-001', 2)
    cart.add('MH-003', 3)

    const expected = PHO * 2 + BANHMI * 3
    assert.equal(cart.totals().subtotal, expected)
  })

  it('thu phí giao khi đơn dưới ngưỡng miễn phí', () => {
    cart.add('MH-003', 1)
    const totals = cart.totals()

    assert.equal(totals.subtotal, BANHMI)
    assert.equal(totals.shipping, SHIPPING_FEE)
    assert.equal(totals.grand, BANHMI + SHIPPING_FEE)
  })

  it('miễn phí giao khi đạt ngưỡng', () => {
    reset()
    cart.add('MH-010', 1)
    const totals = cart.totals()

    assert.ok(totals.subtotal >= FREE_SHIPPING_THRESHOLD)
    assert.equal(totals.shipping, 0)
    assert.equal(totals.grand, totals.subtotal)
  })

  it('giỏ r��ng thì không thu phí giao', () => {
    reset()
    const totals = cart.totals()

    assert.equal(totals.subtotal, 0)
    assert.equal(totals.shipping, 0)
    assert.equal(totals.grand, 0)
  })

  it('cho biết còn thiếu bao nhiêu để được miễn phí giao', () => {
    cart.add('MH-003', 1)
    assert.equal(cart.totals().missingShipping, FREE_SHIPPING_THRESHOLD - BANHMI)
  })

  it('giảm số tiền cần thêm khi giỏ đã gần ngưỡng', () => {
    reset()
    cart.add('MH-010', 1)
    assert.equal(cart.totals().missingShipping, 0)
  })

  it('giá trong giỏ luôn lấy từ thực đơn, không tin giá gửi lên', () => {
    reset()
    cart.add('MH-001', 1)
    db.updateDish('MH-001', {
      ...db.getDish('MH-001'),
      price: 99000,
    })

    assert.equal(cart.totals().subtotal, 99000, 'đổi giá phải phản ánh ngay')
  })
})

describe('cart - chống dữ liệu rác', () => {
  it('loại bỏ dòng hỏng khi tải từ localStorage', async () => {
    storage.setItem(
      'cbmfood.cart.v1',
      JSON.stringify([
        { dishId: 'MH-001', qty: 2 },
        { dishId: 'MH-003', qty: 0 },
        { dishId: '', qty: 5 },
        { qty: 3 },
        null,
        { dishId: 'MH-004', qty: -3 },
        { dishId: 'MH-005', qty: 'abc' },
      ]),
    )

    const module = await import('../src/cart.js?reload=garbage')
    const items = module.getItems()

    assert.deepEqual(
      items,
      [{ dishId: 'MH-001', qty: 2 }],
      'chỉ giữ dòng có mã món hợp lệ và số lượng dương',
    )
  })

  it('không sập khi localStorage chứa JSON hỏng', async () => {
    storage.setItem('cbmfood.cart.v1', '{khong phai json')
    const module = await import('../src/cart.js?reload=broken')

    assert.deepEqual(module.getItems(), [])
  })

  it('giỏ được lưu lại đúng cấu trúc', () => {
    reset()
    cart.add('MH-001', 2)
    cart.add('MH-003', 1)

    const raw = JSON.parse(storage.getItem('cbmfood.cart.v1'))
    assert.equal(raw.length, 2)
    assert.ok(raw.every((item) => item.dishId && item.qty > 0))
  })
})
