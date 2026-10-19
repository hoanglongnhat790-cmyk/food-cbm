import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshModules } from './helpers.mjs'

test('them mon vao gio', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Pho Bo', price: 50000 })
  const res = cart.add(dish.code, 2)
  assert.ok(res.ok, 'them that bai')
  assert.equal(cart.count(), 2)
  assert.equal(cart.subtotal(), 100000)
  assert.equal(cart.list().length, 1)
})

test('them mon khong ton tai bi tu choi', async () => {
  const { cart } = await freshModules()
  assert.equal(cart.add('KHONG-CO', 1).error, 'not-found')
})

test('them mon dang ngung ban bi tu choi', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Mon Het', price: 30000 })
  store.setDishStatus(dish.code, 'unavailable')
  assert.equal(cart.add(dish.code, 1).error, 'unavailable')
  assert.equal(cart.count(), 0)
})

test('them mon da co trong gio thi cong don', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Bun Bo', price: 45000 })
  cart.add(dish.code, 1)
  cart.add(dish.code, 2)
  assert.equal(cart.list().length, 1, 'phai gop thanh 1 dong')
  assert.equal(cart.count(), 3)
  assert.equal(cart.subtotal(), 135000)
})

test('so luong bi gioi han toi da', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Mon Gioi Han', price: 10000 })
  cart.add(dish.code, 999)
  assert.equal(cart.count(), 20, 'phai gioi han 20')
})

test('cap nhat so luong', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Canh Chua', price: 35000 })
  cart.add(dish.code, 1)
  cart.setQty(dish.code, 4)
  assert.equal(cart.count(), 4)
  assert.equal(cart.subtotal(), 140000)
})

test('dat so luong 0 thi xoa dong khoi gio', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Xoa Khi Zero', price: 25000 })
  cart.add(dish.code, 2)
  cart.setQty(dish.code, 0)
  assert.equal(cart.count(), 0)
  assert.equal(cart.list().length, 0)
})

test('xoa mot mon trong gio', async () => {
  const { store, cart } = await freshModules()
  const a = store.createDish({ name: 'Mon A', price: 10000 })
  const b = store.createDish({ name: 'Mon B', price: 20000 })
  cart.add(a.code, 1)
  cart.add(b.code, 1)
  cart.remove(a.code)
  assert.equal(cart.list().length, 1)
  assert.equal(cart.list()[0].name, 'Mon B')
})

test('xoa mon khong co trong gio tra loi', async () => {
  const { cart } = await freshModules()
  assert.equal(cart.remove('KHONG-CO').error, 'not-found')
})

test('xoa sach gio', async () => {
  const { store, cart } = await freshModules()
  cart.add(store.createDish({ name: 'Mon X', price: 10000 }).code, 3)
  cart.clear()
  assert.equal(cart.count(), 0)
  assert.equal(cart.subtotal(), 0)
})

test('phi ship thuong 15.000', async () => {
  const { store, cart } = await freshModules()
  cart.add(store.createDish({ name: 'Mon Nho', price: 50000 }).code, 1)
  assert.equal(cart.subtotal(), 50000)
  assert.equal(cart.shipping(), 15000)
  assert.equal(cart.total(), 65000)
})

test('don hang lon du 150.000 thi mien phi ship', async () => {
  const { store, cart } = await freshModules()
  cart.add(store.createDish({ name: 'Mon Lon', price: 160000 }).code, 1)
  assert.equal(cart.shipping(), 0)
  assert.equal(cart.total(), 160000)
  assert.equal(cart.missingForFreeShip(), 0)
})

test('thieu tien thi bao them duoc bao nhieu de mien ship', async () => {
  const { store, cart } = await freshModules()
  cart.add(store.createDish({ name: 'Mon Vua', price: 120000 }).code, 1)
  assert.equal(cart.shipping(), 15000)
  assert.equal(cart.missingForFreeShip(), 30000)
})

test('gio rong thi khong thu phi ship', async () => {
  const { cart } = await freshModules()
  assert.equal(cart.subtotal(), 0)
  assert.equal(cart.shipping(), 0)
  assert.equal(cart.total(), 0)
})

test('mon bi admin xoa thi dong do bien mat khoi gio', async () => {
  const { store, cart } = await freshModules()
  const keep = store.createDish({ name: 'Mon Con', price: 20000 })
  const drop = store.createDish({ name: 'Mon Bi Xoa', price: 30000 })
  cart.add(keep.code, 1)
  cart.add(drop.code, 1)
  store.deleteDish(drop.code)
  const rows = cart.list()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Mon Con')
})

test('mon ngung ban thi khong con trong gio', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Mon Ngung', price: 30000 })
  cart.add(dish.code, 1)
  store.setDishStatus(dish.code, 'unavailable')
  assert.equal(cart.list().length, 0)
})

test('syncWithMenu loai bo dong khong con trong thuc don', async () => {
  const { store, cart } = await freshModules()
  const keep = store.createDish({ name: 'Mon Giu', price: 20000 })
  const drop = store.createDish({ name: 'Mon Bo', price: 30000 })
  cart.add(keep.code, 1)
  cart.add(drop.code, 1)
  store.deleteDish(drop.code)
  cart.syncWithMenu()
  assert.equal(cart.list().length, 1)
  assert.equal(cart.list()[0].name, 'Mon Giu')
})