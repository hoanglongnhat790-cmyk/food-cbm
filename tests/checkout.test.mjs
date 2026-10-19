import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshModules } from './helpers.mjs'

const customer = {
  name: 'Nguyễn Như Quyết',
  phone: '0901234567',
  address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
}

test('luong mua hang day du: chon mon -> gio -> dat hang', async () => {
  const { store, cart } = await freshModules()

  const pho = store.createDish({ name: 'Phở Bò Tái', price: 55000 })
  const ca = store.createDish({ name: 'Cà Phê Sữa Đá', price: 25000 })

  /* bước 1: khách bấm "Đặt ngay" */
  assert.ok(cart.add(pho.code, 2).ok, 'them pho vao gio that bai')
  assert.ok(cart.add(ca.code, 1).ok, 'them ca phe vao gio that bai')

  /* bước 2: giỏ hiển thị đúng */
  assert.equal(cart.count(), 3)
  assert.equal(cart.subtotal(), 135000)
  assert.equal(cart.shipping(), 15000)
  assert.equal(cart.total(), 150000)

  /* bước 3: checkout tạo đơn từ đúng các dòng trong giỏ */
  const res = store.createOrder({ customer, items: cart.list() })
  assert.ok(res.order, `dat hang that bai: ${res.error}`)
  assert.equal(res.order.items.length, 2)
  assert.equal(res.order.total, cart.total(), 'tong don phai bang tong gio')
  assert.equal(res.order.status, 'pending')

  /* bước 4: sau khi đặt, giờ được dọn sạch */
  cart.clear()
  assert.equal(cart.count(), 0)
  assert.equal(cart.total(), 0)
})

test('don hien thi tren trang quan tri ngay sau khi dat', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Bún Chả', price: 45000 })
  cart.add(dish.code, 3)
  const { order } = store.createOrder({ customer, items: cart.list() })

  const seen = store.listOrders().find((o) => o.code === order.code)
  assert.ok(seen, 'admin khong thay don vua dat')
  assert.equal(seen.items.length, 1)
  assert.equal(seen.items[0].qty, 3)
  assert.equal(store.stats().pendingCount, 1)
})

test('admin sua ten mon thi don da dat giu gia tien luc dat', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Cơm Tấm', price: 40000 })
  cart.add(dish.code, 1)
  const { order } = store.createOrder({ customer, items: cart.list() })

  store.updateDish(dish.code, { name: 'Cơm Tấm Đặc Biệt', price: 99000 })

  const stored = store.findOrder(order.code)
  assert.equal(stored.items[0].name, 'Cơm Tấm', 'don da dat khong doi')
  assert.equal(stored.total, 55000, 'tong don da chot khong doi')
})

test('don moi khong duoc ghi de don cu', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Mì Xào', price: 50000 })
  cart.add(dish.code, 1)
  const first = store.createOrder({ customer, items: cart.list() }).order
  cart.clear()
  cart.add(dish.code, 2)
  const second = store.createOrder({ customer, items: cart.list() }).order

  assert.notEqual(first.code, second.code)
  assert.equal(store.listOrders().length, 2)
  assert.notEqual(first.id, second.id)
})

test('gio hang giữa cac phien van con', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Gio Session', price: 30000 })
  cart.add(dish.code, 2)

  /* nạp lại module cart như khi người dùng F5 trang */
  cart.add(dish.code, 0)
  const reloaded = await import('../src/cart.js?reload=1')
  assert.equal(reloaded.count(), 2, 'gio mat sau khi tai lai trang')
  assert.equal(reloaded.subtotal(), 60000)
})