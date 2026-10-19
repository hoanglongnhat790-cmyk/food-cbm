import * as db from './store.js'

const CART_KEY = 'cbmfood.cart'
const VOUCHER_KEY = 'cbmfood.cartVoucher'
const MAX_QTY = 20

const normalizeToppings = (toppings = []) => [...new Set(
  (Array.isArray(toppings) ? toppings : [])
    .map((id) => String(id || '').trim())
    .filter((id) => db.findTopping(id)),
)].sort()

const makeLineId = (key, toppings = []) => `${key}::${normalizeToppings(toppings).join(',')}`

const read = () => {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

let lines = read().filter((l) => l && typeof l.key === 'string')
/** Mã đang áp, giữ trong kho để khách không phải nhập lại sau khi tải trang. */
let voucherCode = (() => {
  try {
    return localStorage.getItem(VOUCHER_KEY) ?? ''
  } catch {
    return ''
  }
})()

const persist = () => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(lines))
    if (voucherCode) localStorage.setItem(VOUCHER_KEY, voucherCode)
    else localStorage.removeItem(VOUCHER_KEY)
  } catch {
    /* storage đầy hoặc bị chặn, giỏ vẫn dùng được trong phiên này */
  }
}

const rebuild = () =>
  lines
    .map((line) => {
      const dish = db.findDish(line.key)
      if (!dish || !db.isPurchasable(dish)) return null
      /* Kẹp theo tồn kho: món có 3 phần mà giỏ còn 5 thì giảm về 3, và
         `maxLine` để nút "+" không cho vượt. */
      const ceiling = dish.stock === null ? MAX_QTY : Math.min(MAX_QTY, dish.stock)
      const qty = Math.min(ceiling, Math.max(1, Math.floor(Number(line.qty) || 1)))
      const toppings = normalizeToppings(line.toppings)
      const toppingTotal = db.toppingTotal(toppings)
      const lineId = String(line.lineId || makeLineId(dish.code, toppings))
      return {
        key: dish.code,
        lineId,
        name: dish.name,
        basePrice: dish.price,
        price: dish.price + toppingTotal,
        qty,
        toppings: toppings.map((id) => db.findTopping(id)).filter(Boolean),
        toppingTotal,
        image: dish.image,
        emoji: dish.emoji,
        stock: dish.stock,
        maxQty: ceiling,
      }
    })
    .filter(Boolean)

/** Số phần tối đa được đặt cho một món, 0 nghĩa là đã hết. */
const maxFor = (key) => {
  const dish = db.findDish(key)
  if (!dish || !db.isPurchasable(dish)) return 0
  return dish.stock === null ? MAX_QTY : Math.min(MAX_QTY, dish.stock)
}

export const list = () => rebuild()

export const count = () => rebuild().reduce((sum, l) => sum + l.qty, 0)

export const subtotal = () => rebuild().reduce((sum, l) => sum + l.price * l.qty, 0)

export const shipping = () => {
  const sub = subtotal()
  if (sub === 0) return 0
  /* Mã miễn phí giao hàng đã tính sẵn phí ship trong kết quả kiểm tra. */
  const info = voucherDiscount()
  if (info) return info.shipping
  return sub >= db.FREE_SHIP_FROM ? 0 : db.SHIP_FEE
}

/**
 * Kết quả kiểm tra mã đang áp, hoặc null nếu giỏ trống / mã sai / mã hết hạn.
 * Giao diện dùng chung hàm này nên chỉ cần gọi một chỗ cho cả giỏ và thanh toán.
 */
export const voucherCheck = (customer = {}) =>
  voucherCode && subtotal() > 0
    ? db.checkVoucher(voucherCode, { subtotal: subtotal(), ...customer })
    : null

export const voucherDiscount = () => {
  const checked = voucherCheck()
  return checked && !checked.error ? checked : null
}

export const discount = () => voucherDiscount()?.discount ?? 0

export const total = () => Math.max(0, subtotal() - discount()) + shipping()

/** Thông tin voucher đang áp để hiển thị (null nếu không dùng). */
export const voucher = () => {
  const info = voucherDiscount()
  return info ? { code: info.voucher.code, label: db.voucherLabel(info.voucher), type: info.voucher.type } : null
}

export const voucherError = () => {
  if (!voucherCode || subtotal() === 0) return null
  return voucherCheck()?.error ?? null
}

export const applyVoucher = (code, customer = {}) => {
  const cleaned = String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!cleaned) return { error: 'Vui lòng nhập mã giảm giá' }
  const checked = db.checkVoucher(cleaned, { subtotal: subtotal(), ...customer })
  if (checked.error) return { error: checked.error }
  voucherCode = cleaned
  persist()
  return { ok: true, voucher: voucher(), discount: checked.discount }
}

export const removeVoucher = () => {
  voucherCode = ''
  persist()
  return { ok: true, discount: 0 }
}

export const missingForFreeShip = () => Math.max(0, db.FREE_SHIP_FROM - subtotal())

export const add = (key, qty = 1, toppings = []) => {
  const dish = db.findDish(key)
  if (!dish) return { error: 'not-found' }
  if (dish.status === 'unavailable') return { error: 'unavailable' }
  if (db.isSoldOut(dish)) return { error: 'sold-out' }

  const rawQty = Number(qty)
  if (!Number.isFinite(rawQty)) return { error: 'invalid-qty' }
  const amount = Math.floor(rawQty)
  if (amount < 1) return { error: 'invalid-qty' }

  const normalizedToppings = normalizeToppings(toppings)
  const lineId = makeLineId(dish.code, normalizedToppings)
  const existing = lines.find((l) => String(l.lineId || makeLineId(l.key, l.toppings)) === lineId)
  const wanted = (existing?.qty ?? 0) + amount
  const stockBinds = dish.stock !== null && dish.stock <= MAX_QTY
  const ceiling = dish.stock === null ? MAX_QTY : Math.min(MAX_QTY, dish.stock)
  if (stockBinds && wanted > ceiling) {
    return { error: 'over-stock', room: ceiling - (existing?.qty ?? 0), ceiling }
  }
  const nextQty = Math.min(ceiling, wanted)

  if (existing) {
    existing.qty = nextQty
    existing.lineId = lineId
    existing.toppings = normalizedToppings
  } else {
    lines = [...lines, { key: dish.code, lineId, toppings: normalizedToppings, qty: nextQty }]
  }
  persist()
  return { ok: true, lines: list(), count: count() }
}

export const setQty = (key, qty) => {
  const rawQty = Number(qty)
  if (!Number.isFinite(rawQty)) return { error: 'invalid-qty' }
  const amount = Math.floor(rawQty)
  if (amount < 1) return remove(key)
  const line = lines.find((l) => l.lineId === key || l.key === key)
  if (!line) return { error: 'not-found' }
  const ceiling = maxFor(line.key)
  if (ceiling < 1) return { error: 'sold-out' }
  if (amount > ceiling) return { error: 'over-stock', ceiling, room: ceiling - line.qty }
  line.qty = amount
  persist()
  return { ok: true, lines: list(), count: count() }
}

export const remove = (key) => {
  const before = lines.length
  lines = lines.filter((l) => l.lineId !== key && l.key !== key)
  if (lines.length === before) return { error: 'not-found' }
  persist()
  return { ok: true, lines: list(), count: count() }
}

export const clear = () => {
  lines = []
  voucherCode = ''
  persist()
  return { ok: true, lines: [], count: 0 }
}

export const syncWithMenu = () => {
  const valid = new Set(db.listActiveDishes().map((d) => d.code))
  lines = lines.filter((l) => valid.has(l.key))
  persist()
} 