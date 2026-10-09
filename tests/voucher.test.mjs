import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshModules, freshSeed } from './helpers.mjs'

const DAY = 24 * 60 * 60 * 1000

/* ===================== VOUCHER ===================== */

test('voucher giam phan tram tinh lai', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  cart.add(dish.code, 2)

  const made = store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  assert.ok(made.voucher, 'tao voucher that bai')

  const result = cart.applyVoucher('GIAM10')
  assert.ok(result.ok, 'ap voucher that bai')
  assert.equal(cart.discount(), 20000, 'giam 10% cua 200.000')
  assert.equal(cart.total(), 180000 + cart.shipping(), 'tong truocc phi ship')
})

test('ma voucher khong phan biet hoa thuong va dau cach', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  cart.add(dish.code, 1)
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  assert.ok(cart.applyVoucher('giam10').ok, 'viet thuong van dung')
  assert.equal(cart.voucher().code, 'GIAM10')
})

test('ap ma khong ton tai thi bao loi', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  cart.add(dish.code, 1)
  const result = cart.applyVoucher('KHONG-CO')
  assert.ok(result.error)
  assert.equal(cart.discount(), 0)
})

test('voucher giam tien khong giam qua tong don', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 30000 })
  cart.add(dish.code, 1)
  store.createVoucher({ code: 'GIAM50K', type: 'fixed', value: 50000 })
  cart.applyVoucher('GIAM50K')
  assert.equal(cart.discount(), 30000, 'chi giam bang tien cua mon')
  assert.equal(cart.total(), cart.shipping())
})

test('voucher phai dam ung don toi thieu', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 30000 })
  cart.add(dish.code, 1)
  store.createVoucher({ code: 'LON', type: 'fixed', value: 10000, minOrder: 200000 })
  const result = cart.applyVoucher('LON')
  assert.ok(result.error, 'don 30.000 khong duoc ap ma 200.000')
  assert.equal(cart.discount(), 0)
})

test('voucher phan tram co tran giam toi da', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 500000 })
  cart.add(dish.code, 1)
  store.createVoucher({ code: 'GIAM50', type: 'percent', value: 50, maxDiscount: 100000 })
  cart.applyVoucher('GIAM50')
  assert.equal(cart.discount(), 100000, '50% la 250.000 nhung con 100.000')
})

test('voucher freeship bo phi giao hang', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  cart.add(dish.code, 1)
  const ship = cart.shipping()
  assert.ok(ship > 0, 'mac dinh co phi ship')
  store.createVoucher({ code: 'SHIP', type: 'freeship' })
  cart.applyVoucher('SHIP')
  assert.equal(cart.shipping(), 0, 'ship = 0')
  assert.equal(cart.total(), 50000)
})

test('voucher het han bi tu choi', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  cart.add(dish.code, 1)
  store.createVoucher({
    code: 'CU',
    type: 'fixed',
    value: 10000,
    expiresAt: Date.now() - DAY,
  })
  assert.ok(cart.applyVoucher('CU').error)
  assert.equal(cart.discount(), 0)
})

test('voucher chua toi han bi tu choi', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  cart.add(dish.code, 1)
  store.createVoucher({
    code: 'SAI',
    type: 'fixed',
    value: 10000,
    startsAt: Date.now() + DAY,
  })
  assert.ok(cart.applyVoucher('SAI').error)
  assert.equal(cart.discount(), 0)
})

test('voucher da tat thi khong dung duoc', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  cart.add(dish.code, 1)
  store.createVoucher({ code: 'TAT', type: 'fixed', value: 10000 })
  store.setVoucherActive('TAT', false)
  assert.ok(cart.applyVoucher('TAT').error)
})

test('voucher het luot thi khong dung duoc', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  store.createVoucher({ code: 'MOTS', type: 'fixed', value: 10000, usageLimit: 1 })

  cart.add(dish.code, 1)
  assert.ok(cart.applyVoucher('MOTS').ok, 'luot 1 dung duoc')
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000001', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'MOTS',
  })

  cart.clear()
  cart.add(dish.code, 1)
  assert.ok(cart.applyVoucher('MOTS').error, 'luot 2 bi tu choi')
})

test('gioi han luot moi khach', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  store.createVoucher({ code: 'MOT', type: 'fixed', value: 10000, perUserLimit: 1 })
  const userId = 'khach-1'

  cart.add(dish.code, 1)
  assert.ok(cart.applyVoucher('MOT', { userId }).ok, 'luot cua chinh khach')
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000002', address: '123 Nguyen Hue' },
    userId,
    voucherCode: 'MOT',
  })

  cart.clear()
  cart.add(dish.code, 1)
  assert.ok(cart.applyVoucher('MOT', { userId }).error, 'khac cung khach thi het luot')
  cart.clear()
  cart.add(dish.code, 1)
  assert.ok(
    cart.applyVoucher('MOT', { userId: 'khach-2' }).ok,
    'khach khac van dung duoc',
  )
})

test('khach vang lai duoc dung ma rieng', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  store.createVoucher({ code: 'GACH10', type: 'fixed', value: 10000, perUserLimit: 1 })
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000003', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'GACH10',
  })

  cart.add(dish.code, 1)
  assert.ok(cart.applyVoucher('GACH10', { phone: '0900000004' }).ok, 'so khac la duoc dung')
})

test('ma ghi vao don va giam dung so tien', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 200000 })
  store.createVoucher({ code: 'GIAM50K', type: 'fixed', value: 50000 })
  cart.add(dish.code, 1)
  cart.applyVoucher('GIAM50K')

  const result = store.createOrder({
    items: cart.list().map((line) => ({ key: line.key, qty: line.qty })),
    customer: { name: 'A', phone: '0900000005', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: cart.voucher().code,
  })
  assert.ok(result.order, 'dat mon that bai')
  assert.equal(result.order.discount, 50000)
  assert.equal(result.order.voucher.code, 'GIAM50K', 'luu ma tren don')
  assert.equal(result.order.total, result.order.subtotal - 50000 + result.order.shipping)
})

test('huy don hoan lai luot dung voucher', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10, usageLimit: 1 })
  cart.add(dish.code, 1)
  cart.applyVoucher('GIAM10')

  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000006', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'GIAM10',
  })
  assert.equal(store.findVoucher('GIAM10').usedCount, 1)

  store.cancelOrder(order.code, order.userId)
  assert.equal(store.findVoucher('GIAM10').usedCount, 0, 'hoan luot')

  cart.clear()
  cart.add(dish.code, 1)
  assert.ok(cart.applyVoucher('GIAM10').ok, 'dung lai duoc sau khi huy')
})

test('huy don khong hoan lai luot hai lan', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10, usageLimit: 2 })
  cart.add(dish.code, 1)
  cart.applyVoucher('GIAM10')

  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000007', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'GIAM10',
  })
  store.cancelOrder(order.code, order.userId)
  assert.equal(store.findVoucher('GIAM10').usedCount, 0)
  store.cancelOrder(order.code, order.userId)
  assert.equal(store.findVoucher('GIAM10').usedCount, 0, 'khong hoan lan hai')
})

test('voucher khong hop le bi chan khi dat', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10, usageLimit: 1 })

  cart.add(dish.code, 1)
  const first = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000008', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'GIAM10',
  })
  assert.ok(first.order)

  /* Khách giỏ còn mã cũ, tab khác vừa dùng hết lượt. */
  const second = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'B', phone: '0900000009', address: '456 Le Loi, Quan 5' },
    voucherCode: 'GIAM10',
  })
  assert.ok(second.error, 'phai chan lai o buoc dat')
  assert.equal(store.listOrders().length, 1, 'khong tao don khong hop le')
})

test('tao voucher trung ma bi tu choi', async () => {
  const { store } = await freshSeed()
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  const again = store.createVoucher({ code: 'giam10', type: 'percent', value: 20 })
  assert.ok(again.error, 'trung ma bat ke hoa thuong')
})

test('voucher khong ton tai bi chan khi dat', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  cart.add(dish.code, 1)
  const result = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000010', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'AO',
  })
  assert.ok(result.error)
})

test('ma giu lai qua reload', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  cart.add(dish.code, 1)
  cart.applyVoucher('GIAM10')

  store.reloadFromStorage()
  assert.equal(cart.voucher()?.code ?? null, 'GIAM10')
})

test('xoa ma voucher da dung giu nguyen don cu', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 100000 })
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  cart.add(dish.code, 1)
  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000011', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'GIAM10',
  })

  store.deleteVoucher('GIAM10')
  assert.equal(store.findVoucher('GIAM10'), null, 'ma bi xoa')
  assert.equal(store.findOrder(order.code).discount, 10000, 'don cu van giu so tien da giam')
})

test('sua ma voucher khong lam mat so tien da giam', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 200000 })
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  cart.add(dish.code, 1)
  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000012', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'GIAM10',
  })

  const updated = store.updateVoucher('GIAM10', { value: 50, type: 'percent' })
  assert.ok(updated.voucher)
  assert.equal(store.findOrder(order.code).discount, 20000, 'luu snapshot cu')
})

test('khoi phuc du lieu mau thi xoa ca voucher', async () => {
  const { store } = await freshSeed()
  store.createVoucher({ code: 'GIAM10', type: 'percent', value: 10 })
  store.resetDishes()
  assert.equal(store.findVoucher('GIAM10'), null, 'reset la lam moi toan bo')
  assert.equal(store.listVouchers().length, 0)
})

/* ===================== TON KHO ===================== */

test('mon khong ton van bi chan o gioi han mot luot dat', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  assert.equal(store.findDish(dish.code).stock, null, 'khong giam ton kho')
  cart.add(dish.code, 99)
  assert.equal(cart.count(), 20, 'gioi han mot luot van la 20 phan')
  assert.equal(store.findDish(dish.code).stock, null)
})

test('them mon vuot ton kho bi tu choi', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 3 })
  cart.add(dish.code, 2)
  const result = cart.add(dish.code, 2)
  assert.equal(result.error, 'over-stock')
  assert.equal(cart.count(), 2, 'khong cong them')
})

test('mon het hang khong add duoc', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 0 })
  assert.equal(cart.add(dish.code, 1).error, 'sold-out')
  assert.equal(cart.count(), 0)
})

test('dat mon tru ton kho', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 5 })
  cart.add(dish.code, 2)
  store.createOrder({
    items: [{ key: dish.code, qty: 2 }],
    customer: { name: 'A', phone: '0900000013', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.findDish(dish.code).stock, 3)
})

test('dat mon vuot ton kho bi chan o store', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 2 })
  cart.add(dish.code, 2)
  const result = store.createOrder({
    items: [{ key: dish.code, qty: 5 }],
    customer: { name: 'A', phone: '0900000014', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.ok(result.error)
  assert.equal(store.findDish(dish.code).stock, 2, 'khong tru ton kho khi don loi')
})

test('tat ca dong cung mot mon moi tru mot lan', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 5 })
  const result = store.createOrder({
    items: [
      { key: dish.code, qty: 3 },
      { key: dish.code, qty: 3 },
    ],
    customer: { name: 'A', phone: '0900000015', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.ok(result.error, '3 + 3 vuot ton 5')
  assert.equal(store.findDish(dish.code).stock, 5)
})

test('mon het ton khong xuat hien o cua hang', async () => {
  const { store } = await freshSeed()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 1 })
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000016', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.findDish(dish.code).stock, 0)
  const codes = store.listActiveDishes().map((d) => d.code)
  assert.ok(!codes.includes(dish.code), 'khong nen hien o cua hang')
})

test('admin them lai ton kho cho mon het hang', async () => {
  const { store } = await freshSeed()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 1 })
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000017', address: '123 Nguyen Hue, Quan 1' },
  })
  store.updateDish(dish.code, { stock: 4 })
  assert.ok(store.listActiveDishes().map((d) => d.code).includes(dish.code))
})

test('huy don hoan lai ton kho', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 5 })
  cart.add(dish.code, 2)
  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 2 }],
    customer: { name: 'A', phone: '0900000018', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.findDish(dish.code).stock, 3)

  store.cancelOrder(order.code, order.userId)
  assert.equal(store.findDish(dish.code).stock, 5, 'hoan ton kho')
})

test('chuyen trang thai sang huy cung hoan ton kho', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 5 })
  cart.add(dish.code, 2)
  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 2 }],
    customer: { name: 'A', phone: '0900000019', address: '123 Nguyen Hue, Quan 1' },
  })
  store.updateOrderStatus(order.code, 'cancelled')
  assert.equal(store.findDish(dish.code).stock, 5)
})

test('huy don khong hoan ton kho hai lan', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 5 })
  cart.add(dish.code, 2)
  const { order } = store.createOrder({
    items: [{ key: dish.code, qty: 2 }],
    customer: { name: 'A', phone: '0900000020', address: '123 Nguyen Hue, Quan 1' },
  })
  store.cancelOrder(order.code, order.userId)
  store.cancelOrder(order.code, order.userId)
  assert.equal(store.findDish(dish.code).stock, 5, 'khong hoan vuot thuc te')
})

test('gio khong dat thi khong trong don', async () => {
  const { store } = await freshSeed()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 5 })
  store.createOrder({
    items: [{ key: dish.code, qty: 2 }],
    customer: { name: 'A', phone: '0900000021', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.findDish(dish.code).sold, 2)
})

test('mon khong doi so luong ton', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000 })
  cart.add(dish.code, 3)
  store.createOrder({
    items: [{ key: dish.code, qty: 3 }],
    customer: { name: 'A', phone: '0900000022', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.findDish(dish.code).stock, null, 'khong sinh ton kho gia')
})

test('so luong ton la so nguyen khong am', async () => {
  const { store } = await freshSeed()
  assert.ok(store.createDish({ name: 'A', price: 10000, stock: -1 }).error)
  assert.ok(store.createDish({ name: 'B', price: 10000, stock: 1.5 }).error)
  assert.ok(store.createDish({ name: 'C', price: 10000, stock: 'x' }).error)
  assert.ok(store.createDish({ name: 'D', price: 10000, stock: 0 }))
  assert.ok(store.createDish({ name: 'E', price: 10000, stock: 7 }))
})

test('update mon khong doi ton kho khi bo trong', async () => {
  const { store } = await freshSeed()
  const dish = store.createDish({ name: 'A', price: 10000, stock: 5 })
  store.updateDish(dish.code, { name: 'A moi' })
  assert.equal(store.findDish(dish.code).stock, 5, 'khong mat ton kho khi sua ten')
})

test('update mon co the bo gioi han ton kho', async () => {
  const { store } = await freshSeed()
  const dish = store.createDish({ name: 'A', price: 10000, stock: 5 })
  store.updateDish(dish.code, { stock: null })
  assert.equal(store.findDish(dish.code).stock, null, 'trong o form = khong gioi han')
})

test('ton kho cao hon gia han khong bao het hang', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 30 })
  const res = cart.add(dish.code, 25)
  assert.ok(res.ok, 'khong bao het hang khi ton van 30 phan')
  assert.equal(cart.count(), 20, 'van cat ve gia han 20 phan/lan')
})

test('cart clamp so luong khi ton kho giam giua chung', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 10 })
  cart.add(dish.code, 5)
  store.updateDish(dish.code, { stock: 2 })
  assert.equal(cart.list()[0].qty, 2, 'tu clamp theo ton moi')
})

test('mon het ton bi loai khoi gio', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 3 })
  cart.add(dish.code, 2)
  store.updateDish(dish.code, { stock: 0 })
  assert.equal(cart.list().length, 0)
  assert.equal(cart.subtotal(), 0)
})

test('don moi khong ghi ton kho vao san luong', async () => {
  const { store } = await freshSeed()
  const dish = store.createDish({ name: 'Pho', price: 50000, stock: 4 })
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000023', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.stats().soldOutCount, 0)
  assert.equal(store.stats().lowStock.length, 1, 'con 3 phan duoi 5')
  assert.equal(store.stats().lowStock[0].stock, 3)
})

test('thong ke dem mon het hang', async () => {
  const { store } = await freshSeed()
  store.createDish({ name: 'Het', price: 50000, stock: 1 })
  const dish = store.createDish({ name: 'Het nua', price: 50000, stock: 1 })
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0900000024', address: '123 Nguyen Hue, Quan 1' },
  })
  assert.equal(store.stats().soldOutCount, 1)
})
test('thong ke dem voucher dang dung duoc, khong dem nguoc lai', async () => {
  const { store } = await freshSeed()
  store.createVoucher({
    code: 'LIVE1',
    type: 'percent',
    value: 10,
    startAt: '2026-01-01T00:00',
    endAt: '2026-12-31T23:59',
  })
  store.createVoucher({
    code: 'TAT1',
    type: 'fixed',
    value: 10000,
    startAt: '2026-01-01T00:00',
    endAt: '2026-12-31T23:59',
    active: false,
  })
  store.createVoucher({
    code: 'HET1',
    type: 'freeship',
    value: 0,
    startAt: '2026-01-01T00:00',
    endAt: '2026-12-31T23:59',
    maxUses: 1,
  })
  const dish = store.createDish({ name: 'Pha giam', price: 60000 })
  store.createOrder({
    items: [{ key: dish.code, qty: 1 }],
    customer: { name: 'A', phone: '0905550025', address: '123 Nguyen Hue, Quan 1' },
    voucherCode: 'HET1',
  })

  const stats = store.stats()
  assert.equal(stats.voucherCount, 3, 'co ca 3 ma da tao')
  assert.equal(stats.voucherLiveCount, 1, 'chi ma con bat va con luot moi dung duoc')
})
