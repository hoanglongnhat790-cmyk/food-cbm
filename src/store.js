import {
  CATEGORIES,
  SEED_DISHES,
  SEED_ORDERS,
  accentOf,
} from './seed.js'

const DISHES_KEY = 'cbmfood.admin.dishes.v1'
const ORDERS_KEY = 'cbmfood.admin.orders.v1'

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

const state = {
  dishes: readCollection(DISHES_KEY, SEED_DISHES),
  orders: readCollection(ORDERS_KEY, SEED_ORDERS),
}

function persist() {
  try {
    window.localStorage.setItem(DISHES_KEY, JSON.stringify(state.dishes))
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(state.orders))
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
  const max = state.dishes.reduce((acc, dish) => {
    const num = Number(String(dish.id).replace(/\D/g, ''))
    return Number.isFinite(num) && num > acc ? num : acc
  }, 0)
  return `MH-${String(max + 1).padStart(3, '0')}`
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
  commit()
}
