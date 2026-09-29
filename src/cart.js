import * as db from './store.js'
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_QTY_PER_ITEM,
  SHIPPING_FEE,
} from './seed.js'

const CART_KEY = 'cbmfood.cart.v1'

const listeners = new Set()

const normalize = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      dishId: String(item?.dishId ?? ''),
      qty: Math.min(
        MAX_QTY_PER_ITEM,
        Math.max(0, Math.round(Number(item?.qty) || 0)),
      ),
    }))
    .filter((item) => item.dishId && item.qty > 0)
}

let state = {
  items: normalize(read()),
}

function read() {
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function commit() {  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(state.items))
  } catch {
    /* localStorage bị chặn - giỏ chỉ tồn tại trong bộ nhớ */
  }
  listeners.forEach((listener) => listener(getItems()))
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getItems = () => state.items.map((item) => ({ ...item }))

export const count = () => state.items.reduce((sum, item) => sum + item.qty, 0)

export function add(dishId, qty = 1) {
  const dish = db.getDish(dishId)
  if (!dish) return { ok: false, reason: 'not-found' }
  if (dish.status === 'unavailable') return { ok: false, reason: 'unavailable' }

  const amount = Math.max(1, Math.round(Number(qty) || 1))
  const existing = state.items.find((item) => item.dishId === dishId)

  state.items = existing
    ? state.items.map((item) =>
        item.dishId === dishId
          ? {
              ...item,
              qty: Math.min(MAX_QTY_PER_ITEM, item.qty + amount),
            }
          : item,
      )
    : [...state.items, { dishId, qty: Math.min(MAX_QTY_PER_ITEM, amount) }]

  commit()
  return { ok: true, qty: existing?.qty ?? amount }
}

export function setQty(dishId, qty) {
  const amount = Math.round(Number(qty) || 0)

  if (amount <= 0) return remove(dishId)

  const dish = db.getDish(dishId)
  if (!dish) return { ok: false, reason: 'not-found' }
  if (dish.status === 'unavailable') return { ok: false, reason: 'unavailable' }

  state.items = state.items.map((item) =>
    item.dishId === dishId
      ? { ...item, qty: Math.min(MAX_QTY_PER_ITEM, amount) }
      : item,
  )

  commit()
  return { ok: true }
}

export function remove(dishId) {
  const before = state.items.length
  state.items = state.items.filter((item) => item.dishId !== dishId)
  if (state.items.length === before) return { ok: false, reason: 'not-found' }

  commit()
  return { ok: true }
}

export function clear() {
  if (!state.items.length) return { ok: false, reason: 'empty' }
  state.items = []
  commit()
  return { ok: true }
}

export function detailed() {
  return state.items
    .map((item) => {
      const dish = db.getDish(item.dishId)
      if (!dish) return null
      return {
        dish,
        qty: item.qty,
        lineTotal: dish.price * item.qty,
        available: dish.status !== 'unavailable',
      }
    })
    .filter(Boolean)
}

export function totals() {
  const lines = detailed()
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const blocking = lines.filter((line) => !line.available)

  return {
    count: lines.reduce((sum, line) => sum + line.qty, 0),
    subtotal,
    shipping,
    grand: subtotal + shipping,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    missingForCheckout: blocking.length,
    missingShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
  }
}

export function checkoutPayload() {
  const lines = detailed()
  if (!lines.length) return null

  return {
    items: lines.map((line) => ({
      name: line.dish.name,
      price: line.dish.price,
      qty: line.qty,
    })),
    shipping: totals().shipping,
  }
}
