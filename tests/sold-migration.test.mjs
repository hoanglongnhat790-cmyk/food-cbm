import test from 'node:test'
import assert from 'node:assert/strict'

/* store.js dựng số lượt bán khi nạp module, nên file này tự chuẩn bị
   localStorage rồi mới import để kiểm tra đúng thời điểm đó.
   Không dùng helpers.mjs vì helper đó nạp store dùng chung cho mọi file. */

class MemoryStorage {
  constructor() {
    this.map = new Map()
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null
  }

  setItem(key, value) {
    this.map.set(key, String(value))
  }

  removeItem(key) {
    this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
}

globalThis.localStorage = new MemoryStorage()

const DISH_KEY = 'cbmfood.dishes'
const ORDER_KEY = 'cbmfood.orders'

const legacyDish = (index, ratingCount) => ({
  id: `MH00${index}`,
  code: `MH00${index}`,
  name: `Mon ${index}`,
  description: '',
  category: 'main',
  price: 50000,
  originalPrice: null,
  rating: 4.5,
  ratingCount,
  tags: [],
  accent: '#e8542d',
  emoji: '🍜',
  status: 'available',
  image: '',
  sold: ratingCount * 2,
  createdAt: Date.now() - index,
})

const seedLegacyStorage = (orders) => {
  localStorage.setItem(
    DISH_KEY,
    JSON.stringify([legacyDish(1, 10), legacyDish(2, 20), legacyDish(3, 0)]),
  )
  localStorage.setItem(ORDER_KEY, JSON.stringify(orders))
}

const legacyOrder = (items) => ({
  id: 'DH1-0001',
  code: 'DH20260101-001',
  customer: { name: 'Khach', phone: '0900000000', address: 'Dia chi test' },
  items,
  note: '',
  subtotal: 50000,
  shipping: 15000,
  total: 65000,
  status: 'pending',
  userId: null,
  createdAt: Date.now(),
  history: [{ status: 'pending', at: Date.now() }],
})

test('du lieu cu seed reviewCount*2 duoc dung lai thanh so luot ban tu don', async () => {
  seedLegacyStorage([
    legacyOrder([
      { key: 'MH001', code: 'MH001', name: 'Mon 1', price: 50000, qty: 3 },
      { key: 'MH002', code: 'MH002', name: 'Mon 2', price: 50000, qty: 2 },
    ]),
  ])

  const store = await import('../src/store.js?legacy=1')

  assert.equal(store.findDish('MH001').sold, 3)
  assert.equal(store.findDish('MH002').sold, 2)
  assert.equal(store.findDish('MH003').sold, 0)
  assert.equal(store.stats().sold, 5, 'khong con cong reviewCount*2')
})

test('dat mon moi tang so luot ban tren nen da migrate', async () => {
  const store = await import('../src/store.js?legacy=2')
  const result = store.createOrder({
    customer: { name: 'Khach', phone: '0900000000', address: 'Dia chi test' },
    items: [{ key: 'MH001', qty: 4 }],
  })

  assert.equal(result.error, undefined)
  assert.equal(store.findDish('MH001').sold, 7, '3 phan truoc + 4 phan moi')
  assert.equal(store.stats().sold, 9)
})

test('thuc don moi seed sold bang 0, khong con so lieu ao', async () => {
  localStorage.clear()
  const store = await import('../src/store.js?fresh=1')

  assert.equal(store.listDishes().length > 0, true)
  assert.equal(
    store.stats().sold,
    0,
    'thuc don moi phai bat dau tu 0 don',
  )
  assert.equal(
    store.listDishes().every((d) => d.sold === 0),
    true,
  )
})
