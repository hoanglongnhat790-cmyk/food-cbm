import {
  CATEGORIES,
  MAX_QTY_PER_ITEM,
  SEED_DISHES,
  SEED_ORDERS,
  accentOf,
} from './seed.js'

const DISHES_KEY = 'cbmfood.admin.dishes.v1'
const ORDERS_KEY = 'cbmfood.admin.orders.v1'
const SEQ_KEY = 'cbmfood.admin.seq.v1'

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))

const listeners = new Set()

function readCollection(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return clone(fallback)

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : clone(fallback)
  } catch {
    return clone(fallback)
  }
}

const numericTail = (id) => {
  const num = Number(String(id).replace(/\D/g, ''))
  return Number.isFinite(num) ? num : 0
}

const highestTail = (collection, fallback = 0) =>
  collection.reduce((max, item) => Math.max(max, numericTail(item.id)), fallback)

function readSeq() {
  const dishes = readCollection(DISHES_KEY, SEED_DISHES)
  const orders = readCollection(ORDERS_KEY, SEED_ORDERS)

  let saved = { dish: 0, order: 1000 }
  try {
    const raw = window.localStorage.getItem(SEQ_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      saved = {
        dish: Number(parsed.dish) || 0,
        order: Number(parsed.order) || 1000,
      }
    }
  } catch {
    /* bộ đếm hỏng thì tính lại từ dữ liệu hiện có */
  }

  return {
    dish: Math.max(saved.dish, highestTail(dishes)),
    order: Math.max(saved.order, highestTail(orders, 1000)),
  }
}

const state = {
  dishes: readCollection(DISHES_KEY, SEED_DISHES),
  orders: readCollection(ORDERS_KEY, SEED_ORDERS),
  seq: readSeq(),
}

function persist() {
  try {
    window.localStorage.setItem(DISHES_KEY, JSON.stringify(state.dishes))
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(state.orders))
    window.localStorage.setItem(SEQ_KEY, JSON.stringify(state.seq))
  } catch {
    /* localStorage bị chặn hoặc đầy dung lượng - vẫn chạy bằng state trong bộ nhớ */
  }
}

function commit() {
  persist()
  listeners.forEach((listener) => listener(state))
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getDishes = () => state.dishes
export const getOrders = () => state.orders
export const getDish = (id) => state.dishes.find((dish) => dish.id === id)
export const getOrder = (id) => state.orders.find((order) => order.id === id)

function nextDishId() {
  state.seq.dish = Math.max(
    state.seq.dish,
    highestTail(state.dishes),
  ) + 1
  return `MH-${String(state.seq.dish).padStart(3, '0')}`
}

function nextOrderId() {
  state.seq.order = Math.max(
    state.seq.order,
    highestTail(state.orders, 1000),
  ) + 1
  return `CB-${state.seq.order}`
}

export const sanitizeDish = (input) => ({
  name: String(input.name ?? '').trim(),
  category: String(input.category ?? '').trim() || CATEGORIES[0],
  price: Math.max(0, Math.round(Number(input.price) || 0)),
  description: String(input.description ?? '').trim(),
  accent: accentOf(String(input.accent ?? 'orange')).id,
  emoji: String(input.emoji ?? '🍽️').trim() || '🍽️',
  status: ['available', 'unavailable', 'runningOut'].includes(input.status)
    ? input.status
    : 'available',
})

export function createDish(input) {
  const dish = {
    id: nextDishId(),
    ...sanitizeDish(input),
    sold: 0,
    createdAt: new Date().toISOString(),
  }
  state.dishes = [dish, ...state.dishes]
  commit()
  return dish
}

export function updateDish(id, input) {
  const index = state.dishes.findIndex((dish) => dish.id === id)
  if (index === -1) return null

  const dish = {
    ...state.dishes[index],
    ...sanitizeDish(input),
  }
  state.dishes = state.dishes.map((item, i) => (i === index ? dish : item))
  commit()
  return dish
}

export function removeDish(id) {
  const dish = getDish(id)
  if (!dish) return false

  state.dishes = state.dishes.filter((item) => item.id !== id)
  commit()
  return true
}

export class OrderError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'OrderError'
    this.field = field
  }
}

export function createOrder(input) {
  const customer = String(input.customer ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const address = String(input.address ?? '').trim()
  const note = String(input.note ?? '').trim()
  const payment = input.payment === 'card' ? 'card' : 'cod'
  const shipping = Math.max(0, Math.round(Number(input.shipping) || 0))
  const rawItems = Array.isArray(input.items) ? input.items : []

  if (!customer || customer.length < 2) {
    throw new OrderError('Vui lòng nhập họ tên người nhận.', 'customer')
  }
  if (customer.length > 60) {
    throw new OrderError('Họ tên quá dài (tối đa 60 ký tự).', 'customer')
  }
  if (!/^0\d{9,10}$/.test(phone)) {
    throw new OrderError('Số điện thoại phải gồm 10-11 chữ số, bắt đầu bằng 0.', 'phone')
  }
  if (address.length < 10) {
    throw new OrderError('Vui lòng nhập địa chỉ giao hàng đầy đủ.', 'address')
  }
  if (address.length > 200) {
    throw new OrderError('Địa chỉ quá dài (tối đa 200 ký tự).', 'address')
  }
  if (!rawItems.length) {
    throw new OrderError('Giỏ hàng đang trống.', 'items')
  }

  const items = rawItems.map((item) => {
    const name = String(item.name ?? '').trim()
    const price = Math.round(Number(item.price) || 0)
    const qty = Math.round(Number(item.qty) || 0)

    if (!name) throw new OrderError('Giỏ hàng chứa món không hợp lệ.', 'items')
    if (qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw new OrderError(
        `Số lượng món “${name}” không hợp lệ (1-${MAX_QTY_PER_ITEM}).`,
        'items',
      )
    }
    if (price < 0) {
      throw new OrderError(`Giá món “${name}” không hợp lệ.`, 'items')
    }

    const live = state.dishes.find((dish) => dish.name === name)
    if (live && live.price !== price) {
      throw new OrderError(
        `Giá món “${name}” vừa thay đổi. Vui lòng kiểm tra lại giỏ hàng.`,
        'items',
      )
    }
    if (live && live.status === 'unavailable') {
      throw new OrderError(`Món “${name}” hiện đã tạm ngưng.`, 'items')
    }

    return { name, price, qty }
  })

  const now = new Date().toISOString()
  const order = {
    id: nextOrderId(),
    customer,
    phone,
    address,
    items,
    shipping,
    status: 'pending',
    payment,
    note,
    userId: input.userId ? String(input.userId) : null,
    createdAt: now,
    updatedAt: now,
    history: [{ status: 'pending', at: now }],
  }

  state.orders = [order, ...state.orders]
  state.dishes = state.dishes.map((dish) => {
    const bought = items
      .filter((item) => item.name === dish.name)
      .reduce((sum, item) => sum + item.qty, 0)
    return bought ? { ...dish, sold: dish.sold + bought } : dish
  })

  commit()
  return order
}

export function updateOrderStatus(id, status) {
  const order = getOrder(id)
  if (!order || order.status === status) return null

  const now = new Date().toISOString()
  const updated = {
    ...order,
    status,
    updatedAt: now,
    history: [...(order.history ?? []), { status, at: now }],
  }
  state.orders = state.orders.map((item) =>
    item.id === id ? updated : item,
  )
  commit()
  return updated
}

export function resetData() {
  state.dishes = clone(SEED_DISHES)
  state.orders = clone(SEED_ORDERS)
  state.seq = {
    dish: highestTail(state.dishes),
    order: highestTail(state.orders, 1000),
  }
  commit()
}
