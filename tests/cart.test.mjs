import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshModules } from './helpers.mjs'

test('them mon vao gio rong', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  const res = cart.add(dish.code, 1)
  assert.ok(!res.error)
  assert.equal(cart.count(), 1)
  assert.equal(cart.qtyOf(dish.code), 1)
})

test('them cung mon thi cong don', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, 1)
  cart.add(dish.code, 2)
  assert.equal(cart.qtyOf(dish.code), 3)
  assert.equal(cart.count(), 3)
  assert.equal(cart.list().length, 1, 'chi gom mot dong')
})

test('khong vuot qua MAX_QTY', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, cart.MAX_QTY)
  const res = cart.add(dish.code, 5)
  assert.ok(res.atMax, 'phai bao atMax')
  assert.equal(cart.qtyOf(dish.code), cart.MAX_QTY)
})

test('them mon khong ton tai bi loi', async () => {
  const { cart, store: db } = await freshModules()
  assert.ok(cart.add('KHONG-CO', 1).error)
})

test('them mon dang tam ngung bi tu choi', async () => {
  const { cart, store } = await freshModules()
  const dish = store.createDish({ name: 'Mon Het', price: 10000 })
  store.setDishStatus(dish.code, 'unavailable')
  const res = cart.add(dish.code, 1)
  assert.ok(res.error, 'phai bao loi')
  assert.equal(cart.count(), 0)
})

test('tang giam so luong', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, 2)
  assert.equal(cart.changeQty(dish.code, 1).qty, 3)
  assert.equal(cart.changeQty(dish.code, -1).qty, 2)
  assert.equal(cart.count(), 2)
})

test('giam ve 0 thi bo dong khoi gio', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, 1)
  const res = cart.changeQty(dish.code, -1)
  assert.ok(res.removed)
  assert.equal(cart.count(), 0)
  assert.equal(cart.list().length, 0)
})

test('tang vuot MAX_QTY thi bao atMax', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, cart.MAX_QTY)
  assert.ok(cart.changeQty(dish.code, 1).atMax)
})

test('don gia va tam tien dung gia hien tai', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, 2)
  const line = cart.list()[0]
  assert.equal(line.price, dish.price, 'gia phai lay tu store')
  assert.equal(line.name, dish.name)
  assert.equal(cart.subtotal(), dish.price * 2)
})

test('cong don giu nguyen ma mon', async () => {
  const { cart, store } = await freshModules()
  const dish = store.createDish({ name: 'Mon Rename', price: 10000 })
  cart.add(dish.code, 1)
  store.updateDish(dish.code, { name: 'Da doi ten', price: 20000 })
  const line = cart.list()[0]
  assert.equal(line.name, 'Da doi ten')
  assert.equal(line.price, 20000)
  assert.equal(cart.subtotal(), 20000)
})

test('phi ship va tong tien', async () => {
  const { cart, store: db } = await freshModules()
  const dish = db.listDishes()[0]
  cart.add(dish.code, 1)
  const sub = cart.subtotal()
  assert.ok(sub < 150000)
  assert.equal(cart.shipping(sub), 15000)
  assert.equal(cart.total(sub), sub + 15000)
})

test('don duong free ship thi khong tinh phi ship', async () => {
  const { cart, store: db } = await freshModules()
  assert.equal(cart.shipping(150000), 0)
  assert.equal(cart.shipping(200000), 0)
})

test('gio trong thi khong co phi ship', async () => {
  const { cart, store: db } = await freshModules()
  assert.equal(cart.count(), 0)
  assert.equal(cart.subtotal(), 0)
  assert.equal(cart.shipping(0), 0)
  assert.equal(cart.total(), 0)
})

test('mon da bi admin xoa thi bien khoi gio', async () => {
  const { cart, store } = await freshModules()
  const dish = store.createDish({ name: 'Mon Se Xoa', price: 10000 })
  cart.add(dish.code, 2)
  assert.equal(cart.count(), 2)
  store.deleteDish(dish.code)
  assert.equal(cart.list().length, 0, 'mon khong con trong menu')
})

test('syncWithMenu loai bo mon khong con', async () => {
  const { cart, store } = await freshModules()
  const keep = store.createDish({ name: 'Mon Giữ', price: 10000 })
  const gone = store.createDish({ name: 'Mon Mất', price: 10000 })
  cart.add(keep.code, 1)
  cart.add(gone.code, 1)
  store.deleteDish(gone.code)
  assert.equal(cart.syncWithMenu(), true)
  assert.equal(cart.list().length, 1)
  assert.equal(cart.syncWithMenu(), false, 'lan sau khong doi gi')
})

test('xoá dong khong anh huong dong khac', async () => {
  const { cart, store: db } = await freshModules()
  const [a, b] = db.listDishes()
  cart.add(a.code, 1)
  cart.add(b.code, 2)
  cart.remove(a.code)
  assert.equal(cart.qtyOf(a.code), 0)
  assert.equal(cart.qtyOf(b.code), 2)
})

test('xoa het gio', async () => {
  const { cart, store: db } = await freshModules()
  cart.add(db.listDishes()[0].code, 1)
  cart.clear()
  assert.equal(cart.count(), 0)
  assert.equal(cart.list().length, 0)
})

test('gio duoc luu vao localStorage', async () => {
  const { cart, store } = await freshModules()
  const dish = store.createDish({ name: 'Mon Lưu', price: 10000 })
  cart.add(dish.code, 3)
  /* Nạp lại module như khi người dùng bấm F5 */
  const reloaded = await import('../src/cart.js?reload=1')
  assert.equal(reloaded.qtyOf(dish.code), 3)
})

test('du lieu gio hong khong lam vo trang', async () => {
  const { cart, store: db } = await freshModules()
  localStorage.setItem('cbm.cart.v1', '{khong phai json')
  const reloaded = await import('../src/cart.js?broken=1')
  assert.equal(reloaded.count(), 0)
})
