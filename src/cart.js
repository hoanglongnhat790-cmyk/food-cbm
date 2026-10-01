import { findDish, listDishes, SHIP_FEE, FREE_SHIP_FROM } from './store.js'

const STORAGE_KEY = 'cbm.cart.v1'

/** Mỗi món tối đa 20 phần để khách không bấm tăng vô tội vạ. */
export const MAX_QTY = 20

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) => ({
        key: String(item?.key ?? ''),
        qty: Math.min(MAX_QTY, Math.max(0, Math.floor(Number(item?.qty) || 0))),
      }))
      .filter((item) => item.key && item.qty > 0)
  } catch {
    return []
  }
}

let items = read()

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* Safari private mode chặn ghi: giỏ vẫn chạy trong bộ nhớ. */
  }
}

/**
 * Tính lại từng dòng từ dữ liệu món hiện tại, nên giỏ tự loại món đã bị
 * admin xoá hoặc ngừng bán. Không dùng tên/giá lưu sẵn trong localStorage.
 */
const hydrate = () =>
  items
    .map(({ key, qty }) => {
      const dish = findDish(key)
      if (!dish || dish.status === 'unavailable') return null
      return {
        key: dish.code,
        qty: Math.min(qty, MAX_QTY),
        name: dish.name,
        price: dish.price,
        image: dish.image,
        emoji: dish.emoji,
      }
    })
    .filter(Boolean)

export const list = () => hydrate()

export const count = () => items.reduce((sum, item) => sum + item.qty, 0)

export const qtyOf = (key) => items.find((item) => item.key === key)?.qty ?? 0

export const add = (key, qty = 1) => {
  const dish = findDish(key)
  if (!dish) return { error: 'Không tìm thấy món này' }
  if (dish.status === 'unavailable') return { error: `${dish.name} đang tạm ngưng` }

  const step = Math.max(1, Math.floor(Number(qty) || 1))
  const current = qtyOf(dish.code)
  const next = Math.min(MAX_QTY, current + step)
  if (next === current) return { atMax: true, qty: current }

  items = [...items.filter((item) => item.key !== dish.code), { key: dish.code, qty: next }]
  save()
  return { qty: next }
}

/** changeQty(key, +1/-1). Giảm về 0 = bỏ món khỏi giỏ. */
export const changeQty = (key, delta) => {
  const dish = findDish(key)
  if (!dish) return { error: 'Không tìm thấy món này' }

  const next = qtyOf(dish.code) + delta
  if (next > MAX_QTY) return { atMax: true, qty: MAX_QTY }

  if (next < 1) {
    items = items.filter((item) => item.key !== dish.code)
    save()
    return { removed: true, qty: 0, name: dish.name }
  }

  items = items.map((item) =>
    item.key === dish.code ? { ...item, qty: Math.min(next, MAX_QTY) } : item,
  )
  save()
  return { qty: qtyOf(dish.code) }
}

export const remove = (key) => {
  items = items.filter((item) => item.key !== key)
  save()
}

export const clear = () => {
  items = []
  save()
}

/** Bỏ món không còn trong thực đơn (admin vừa xoá hoặc ngừng bán). */
export const syncWithMenu = () => {
  const alive = new Set(listDishes().map((d) => d.code))
  const next = items.filter((item) => alive.has(item.key))
  if (next.length === items.length) return false
  items = next
  save()
  return true
}

export const subtotal = () =>
  hydrate().reduce((sum, line) => sum + line.price * line.qty, 0)

export const shipping = (sub = subtotal()) => (sub > 0 && sub < FREE_SHIP_FROM ? SHIP_FEE : 0)

export const total = (sub = subtotal()) => sub + shipping(sub)
