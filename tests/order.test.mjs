import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshSeed } from './helpers.mjs'

const validCustomer = {
  name: 'Nguyễn Như Quyết',
  phone: '0901234567',
  address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
}

const setup = async (dishes = [{ name: 'Phở Bò', price: 50000, qty: 2 }]) => {
  const ctx = await freshSeed()
  const items = dishes.map((d) => {
    const created = ctx.store.createDish({ name: d.name, price: d.price })
    assert.ok(created && !created.error, `tao mon that bai: ${d.name}`)
    return { key: created.code, qty: d.qty }
  })
  return { ...ctx, items }
}

test('dat hang thanh cong', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: validCustomer, items })
  assert.ok(res.order, `dat hang that bai: ${res.error}`)
  assert.equal(res.order.status, 'pending')
  assert.equal(res.order.items.length, 1)
  assert.equal(res.order.subtotal, 100000)
  assert.equal(res.order.shipping, 15000)
  assert.equal(res.order.total, 115000)
  assert.match(res.order.code, /^DH\d{8}-\d{3}$/, `ma don sai: ${res.order.code}`)
})

test('don hang rong bi tu choi', async () => {
  const { store } = await setup()
  assert.equal(store.createOrder({ customer: validCustomer, items: [] }).error, 'Giỏ hàng đang rỗng')
})

test('thieu ten nguoi nhan bi tu choi', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: { ...validCustomer, name: '  ' }, items })
  assert.ok(res.error, 'phai bao loi')
})

test('so dien thoai sai dinh dang bi tu choi', async () => {
  const { store, items } = await setup()
  for (const phone of ['123', 'abc', '01234567', '0123456789012']) {
    assert.ok(
      store.createOrder({ customer: { ...validCustomer, phone }, items }).error,
      `so ${phone} phai bi tu choi`,
    )
  }
  assert.ok(!store.createOrder({ customer: { ...validCustomer, phone: '0901234567' }, items }).error)
})

test('dia chi qua ngan bi tu choi', async () => {
  const { store, items } = await setup()
  assert.ok(store.createOrder({ customer: { ...validCustomer, address: 'abc' }, items }).error)
})

test('mon khong ton tai trong don bi bo qua', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({
    customer: validCustomer,
    items: [...items, { key: 'KHONG-CO', qty: 3 }],
  })
  assert.equal(res.order.items.length, 1, 'mon rac khong duoc ghi vao don')
})

test('dat hang tang so luot ban cua mon', async () => {
  const { store, items } = await setup([{ name: 'Phở Bò', price: 50000, qty: 3 }])
  const before = store.findDish(items[0].key).sold
  store.createOrder({ customer: validCustomer, items })
  assert.equal(store.findDish(items[0].key).sold, before + 3)
})

test('don lon du 150.000 duoc mien phi ship', async () => {
  const { store, items } = await setup([{ name: 'Set Lẩu', price: 200000, qty: 1 }])
  const res = store.createOrder({ customer: validCustomer, items })
  assert.equal(res.order.shipping, 0)
  assert.equal(res.order.total, 200000)
})

test('ghi nhan user khi dang nhap', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: validCustomer, items, userId: 'u-1' })
  assert.equal(res.order.userId, 'u-1')
})

test('ghi chu duoc luu', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: validCustomer, items, note: 'Ít cay' })
  assert.equal(res.order.note, 'Ít cay')
})

test('ma don khong trung nhau', async () => {
  const { store, items } = await setup()
  const a = store.createOrder({ customer: validCustomer, items }).order
  const b = store.createOrder({ customer: validCustomer, items }).order
  assert.notEqual(a.code, b.code)
})

test('chuyen trang thai don va ghi lich su', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  const next = store.updateOrderStatus(order.code, 'confirmed')
  assert.equal(next.status, 'confirmed')
  assert.equal(next.history.length, 2)
  assert.equal(next.history.at(-1).status, 'confirmed')
})

test('chuyen trang thai sai bi tu choi', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  assert.equal(store.updateOrderStatus(order.code, 'khong-hop-le'), null)
  assert.equal(store.updateOrderStatus('KHONG-CO', 'confirmed'), null)
})

test('doi trang thai giong hien khong ghi them lich su', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  const same = store.updateOrderStatus(order.code, 'pending')
  assert.equal(same.history.length, 1)
})

test('chay day duoc luong pending den completed', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  for (const status of ['confirmed', 'delivering', 'completed']) {
    assert.equal(store.updateOrderStatus(order.code, status).status, status)
  }
  assert.equal(store.listOrdersByStatus('completed').length, 1)
  assert.equal(store.listOrdersByStatus('pending').length, 0)
})

test('doanh thu chi tinh don hoan thanh', async () => {
  const { store, items } = await setup()
  const a = store.createOrder({ customer: validCustomer, items }).order
  store.updateOrderStatus(a.code, 'completed')
  const b = store.createOrder({ customer: validCustomer, items }).order
  const stats = store.stats()
  assert.equal(stats.revenue, a.total, 'doanh thu phai bang tong don da hoan thanh')
  assert.notEqual(stats.revenue, a.total + b.total, 'don chua hoan thanh khong duoc tinh')
  assert.equal(stats.pendingCount, 1)
})

test('thong ke tong hop phan anh du lieu', async () => {
  const { store, items } = await setup()
  const dishCount = store.listDishes().length
  store.createOrder({ customer: validCustomer, items })
  const stats = store.stats()
  assert.equal(stats.dishCount, dishCount)
  assert.equal(stats.orderCount, 1)
  assert.equal(stats.pendingCount, 1)
  assert.equal(stats.top.length, 5)
  assert.ok(stats.sold > 0, 'phai co so luot ban')
})

test('tim don theo ma va theo id', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  assert.equal(store.findOrder(order.code).code, order.code)
  assert.equal(store.findOrder(order.id).code, order.code)
  assert.equal(store.findOrder('KHONG-CO'), null)
})

test('dat nhieu mon vao mot don', async () => {
  const { store } = await setup([
    { name: 'Phở Bò', price: 50000, qty: 1 },
    { name: 'Bánh Mì', price: 20000, qty: 2 },
    { name: 'Cà Phê', price: 25000, qty: 1 },
  ])
  const items = store
    .listDishes()
    .slice(0, 3)
    .map((d) => ({ key: d.code, qty: 1 }))
  const res = store.createOrder({ customer: validCustomer, items })
  assert.equal(res.order.items.length, 3)
  assert.equal(res.order.subtotal, 50000 + 20000 + 25000)
})