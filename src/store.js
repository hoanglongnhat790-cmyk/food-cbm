import rawFoods from './data/foods.json' with { type: 'json' }

const DISH_KEY = 'cbmfood.dishes'
const ORDER_KEY = 'cbmfood.orders'
const SALE_KEY = 'cbmfood.dishSeq'
const ORDER_SEQ_KEY = 'cbmfood.orderSeq'

export const DISH_STATUS = {
  available: { label: 'Đang bán', tone: 'ok' },
  runningOut: { label: 'Sắp hết', tone: 'warn' },
  unavailable: { label: 'Tạm ngưng', tone: 'off' },
}

export const ORDER_STATUS = {
  pending: { label: 'Chờ xác nhận', tone: 'warn', step: 1 },
  confirmed: { label: 'Đang chuẩn bị', tone: 'info', step: 2 },
  delivering: { label: 'Đang giao', tone: 'info', step: 3 },
  completed: { label: 'Hoàn thành', tone: 'ok', step: 4 },
  cancelled: { label: 'Đã huỷ', tone: 'off', step: 0 },
}

export const ORDER_FLOW = ['pending', 'confirmed', 'delivering', 'completed']

export const CATEGORIES = rawFoods.categories.map((c) => ({ id: c.id, name: c.name }))

const TAG_TONE = {
  bestseller: { label: 'Bán chạy nhất', cls: 'tag-hot' },
  specialty: { label: 'Đặc sản', cls: 'tag-special' },
  sale: { label: 'Giảm giá', cls: 'tag-sale' },
  new: { label: 'Mới', cls: 'tag-new' },
  popular: { label: 'Ăn vặt hot', cls: 'tag-hot' },
}

const CODE_PREFIX = 'MH'
const MAX_QTY = 20
export const EMOJIS = ['🍜', '🍲', '🥗', '🍚', '🥖', '🍰', '🥤', '🍱']
export const FREE_SHIP_FROM = 150000
export const SHIP_FEE = 15000

const accentOf = (index) => ['#e8542d', '#c4401f', '#2f9e63', '#d98324', '#8a5cf6', '#0ea5e9'][index % 6]

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

const str = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback)

export const normalizeImage = (value) => {
  const url = str(value)
  if (!url || url.length > 500) return ''
  if (url.startsWith('//')) return ''
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') ? url : ''
}

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const seedDish = (item, index) => ({
  id: item.id,
  code: `${CODE_PREFIX}${String(item.id).padStart(3, '0')}`,
  name: str(item.name, 'Món ăn'),
  description: str(item.description),
  category: str(item.category, CATEGORIES[0].id),
  price: num(item.price),
  originalPrice: num(item.originalPrice) > num(item.price) ? num(item.originalPrice) : null,
  rating: Number(item.rating) || 0,
  ratingCount: num(item.reviewCount),
  tags: [TAG_TONE[item.tagType]?.label, str(item.tag)].filter(Boolean).slice(0, 2),
  accent: accentOf(index),
  emoji: EMOJIS[index % EMOJIS.length],
  status: item.isAvailable === false ? 'unavailable' : 'available',
  image: normalizeImage(item.image),
  sold: 0,
  createdAt: Date.now() - (rawFoods.dishes.length - index) * 60000,
})

const isFreshSeed = (value) =>
  Array.isArray(value) &&
  value.length === rawFoods.dishes.length &&
  rawFoods.dishes.every((item, i) => str(value[i]?.code) === `${CODE_PREFIX}${String(item.id).padStart(3, '0')}`)

const loadDishes = () => {
  const stored = read(DISH_KEY, null)
  if (!Array.isArray(stored)) {
    const seeded = rawFoods.dishes.map(seedDish)
    write(DISH_KEY, seeded)
    return seeded
  }
  return stored.map((d, i) => normalizeDish(d, i)).filter(Boolean)
}

export const normalizeDish = (input, index = 0) => {
  if (!input || typeof input !== 'object') return null
  const name = str(input.name)
  if (!name) return null
  const price = num(input.price)
  const originalPrice = num(input.originalPrice)
  const status = Object.keys(DISH_STATUS).includes(input.status) ? input.status : 'available'
  return {
    id: str(input.id) || `${CODE_PREFIX}${num(input.seq, index + 1)}`,
    code: str(input.code) || `${CODE_PREFIX}${String(num(input.seq, index + 1)).padStart(3, '0')}`,
    name,
    description: str(input.description),
    category: str(input.category, CATEGORIES[0].id),
    price,
    originalPrice: originalPrice > price ? originalPrice : null,
    rating: Number(input.rating) || 0,
    ratingCount: num(input.ratingCount),
    tags: Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === 'string') : [],
    accent: str(input.accent) || accentOf(index),
    emoji: EMOJIS.includes(str(input.emoji)) ? str(input.emoji) : EMOJIS[index % EMOJIS.length],
    status,
    image: normalizeImage(input.image),
    sold: num(input.sold),
    createdAt: num(input.createdAt, Date.now()),
  }
}

let dishes = loadDishes()
let orders = read(ORDER_KEY, []).filter((o) => o && typeof o === 'object')
let seq = num(read(SALE_KEY, rawFoods.dishes.length))
/* Date.now() trùng nhau khi khách đặt nhiều đơn trong cùng 1 mili-giây,
   nên id đơn cần thêm số thứ tự để luôn khác nhau. */
let orderSeq = num(read(ORDER_SEQ_KEY, 0))

/* Bản cũ seed `sold` bằng `reviewCount * 2`, làm thống kê ra con số 77.342
   phần dù chưa có đơn nào. Nay `sold` chỉ tính từ đơn thật, nên dữ liệu đã
   lưu từ trước cần được dựng lại một lần. */
const migrateSoldFromOrders = (list) => {
  const legacy = list.length > 0 && list.every((d) => d.sold === num(d.ratingCount) * 2)
  if (!legacy) return false
  const totals = new Map()
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (item?.key) totals.set(item.key, (totals.get(item.key) ?? 0) + num(item.qty))
    }
  }
  dishes = list.map((d) => ({ ...d, sold: totals.get(d.code) ?? 0 }))
  return true
}

if (migrateSoldFromOrders(dishes)) write(DISH_KEY, dishes)

const persistDishes = () => write(DISH_KEY, dishes)
const persistOrders = () => write(ORDER_KEY, orders)
const persistSeq = () => write(SALE_KEY, seq)

export const listDishes = () => dishes.map((d) => ({ ...d }))

export const listOrders = () => orders.map((o) => ({ ...o }))

export const listActiveDishes = () =>
  dishes.filter((d) => d.status !== 'unavailable').map((d) => ({ ...d }))

export const findDish = (key) => {
  const found = dishes.find((d) => d.id === key || d.code === key)
  return found ? { ...found } : null
}

/**
 * Validate nghiêm ngặt khi thêm/sửa từ form.
 * normalizeDish chỉ "siêu lỏng" khi đọc dữ liệu đã lưu nên dữ liệu cũ
 * không bị mất; ở đây dữ liệu rác phải bị từ chối thay vì tự sửa thành 0.
 */
const validateDishInput = (input) => {
  if (!input || typeof input !== 'object') return 'Dữ liệu món không hợp lệ'
  if (!str(input.name)) return 'Vui lòng nhập tên món'
  const price = input.price
  if (price !== undefined && price !== null && price !== '') {
    const n = Number(price)
    if (!Number.isFinite(n)) return 'Giá món không hợp lệ'
    if (n < 0) return 'Giá món không được âm'
    if (n > 1e9) return 'Giá món quá lớn'
  }
  if (input.category && !CATEGORIES.some((c) => c.id === input.category)) {
    return 'Danh mục không hợp lệ'
  }
  if (input.status && !Object.keys(DISH_STATUS).includes(input.status)) {
    return 'Trạng thái không hợp lệ'
  }
  return null
}

export const createDish = (input) => {
  const invalid = validateDishInput(input)
  if (invalid) return { error: invalid }

  seq += 1
  const dish = normalizeDish({ ...input, seq, createdAt: Date.now() }, dishes.length)
  if (!dish) {
    seq -= 1
    return { error: 'Dữ liệu món không hợp lệ' }
  }
  dishes = [dish, ...dishes]
  persistDishes()
  persistSeq()
  return { ...dish }
}

export const updateDish = (key, input) => {
  const index = dishes.findIndex((d) => d.id === key || d.code === key)
  if (index === -1) return { error: 'Không tìm thấy món' }

  const previous = dishes[index]

  /* setDishStatus chỉ gửi { status }, nên phải merge rồi mới validate,
     nếu validate input thô thì mọi cập nhật một phần đều bị từ chối. */
  const merged = {
    ...previous,
    ...input,
    code: previous.code,
    sold: previous.sold,
    createdAt: previous.createdAt,
    originalPrice: input.originalPrice === undefined ? previous.originalPrice : input.originalPrice,
  }

  const invalid = validateDishInput(merged)
  if (invalid) return { error: invalid }

  const next = normalizeDish(merged, index)
  if (!next) return { error: 'Dữ liệu món không hợp lệ' }
  dishes = dishes.map((d, i) => (i === index ? next : d))
  persistDishes()
  return { ...next }
}

export const setDishStatus = (key, status) => {
  if (!Object.keys(DISH_STATUS).includes(status)) return null
  return updateDish(key, { status })
}

export const deleteDish = (key) => {
  const before = dishes.length
  dishes = dishes.filter((d) => d.id !== key && d.code !== key)
  if (dishes.length === before) return false
  persistDishes()
  return true
}

export const resetDishes = () => {
  seq = rawFoods.dishes.length
  dishes = rawFoods.dishes.map(seedDish)
  orders = []
  orderSeq = 0
  persistDishes()
  persistOrders()
  persistSeq()
  write(ORDER_SEQ_KEY, orderSeq)
  return listDishes()
}

export const dishNameOf = (key) => {
  const found = dishes.find((d) => d.id === key || d.code === key)
  return found ? found.name : 'Món đã xoá'
}

const nextOrderCode = () => {
  const today = new Date()
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate(),
  ).padStart(2, '0')}`
  const count = orders.filter((o) => str(o.code).startsWith(`DH${stamp}`)).length + 1
  return `DH${stamp}-${String(count).padStart(3, '0')}`
}

export const createOrder = ({ customer = {}, items = [], note = '', userId = null } = {}) => {
  const name = str(customer.name)
  const phone = str(customer.phone)
  const address = str(customer.address)
  const lines = (Array.isArray(items) ? items : [])
    .map((item) => {
      const dish = findDish(item.key ?? item.id ?? item.code)
      const qty = Math.min(MAX_QTY, Math.max(0, Math.floor(Number(item.qty) || 0)))
      if (!dish || qty < 1) return null
      return { key: dish.code, name: dish.name, price: dish.price, qty }
    })
    .filter(Boolean)

  if (!lines.length) return { error: 'Giỏ hàng đang rỗng' }
  if (!name) return { error: 'Vui lòng nhập tên người nhận' }
  if (!/^\d{9,11}$/.test(phone)) return { error: 'Số điện thoại không hợp lệ' }
  if (address.length < 5 || address.length > 200) return { error: 'Địa chỉ phải dài 5-200 ký tự' }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  orderSeq += 1
  const order = {
    id: `DH${Date.now()}-${String(orderSeq).padStart(4, '0')}`,
    code: nextOrderCode(),
    customer: { name, phone, address },
    items: lines,
    note: str(note),
    subtotal,
    shipping: subtotal >= FREE_SHIP_FROM ? 0 : SHIP_FEE,
    total: subtotal + (subtotal >= FREE_SHIP_FROM ? 0 : SHIP_FEE),
    status: 'pending',
    userId,
    createdAt: Date.now(),
    history: [{ status: 'pending', at: Date.now() }],
  }
  orders = [order, ...orders]
  dishes = dishes.map((d) => {
    const line = lines.find((l) => l.key === d.code)
    return line ? { ...d, sold: d.sold + line.qty } : d
  })
  persistOrders()
  persistDishes()
  write(ORDER_SEQ_KEY, orderSeq)
  return { order: { ...order } }
}

export const findOrder = (key) => {
  const found = orders.find((o) => o.id === key || o.code === key)
  return found ? { ...found } : null
}

export const updateOrderStatus = (key, status) => {
  if (!Object.keys(ORDER_STATUS).includes(status)) return null
  const index = orders.findIndex((o) => o.id === key || o.code === key)
  if (index === -1) return null
  const previous = orders[index]
  if (previous.status === status) return { ...previous }
  const order = {
    ...previous,
    status,
    history: [...previous.history, { status, at: Date.now() }],
  }
  orders = orders.map((o, i) => (i === index ? order : o))
  persistOrders()
  return { ...order }
}

export const listOrdersByStatus = (status) =>
  orders.filter((o) => o.status === status).map((o) => ({ ...o }))

export const stats = () => {
  const revenue = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.total, 0)
  const sold = dishes.reduce((sum, d) => sum + d.sold, 0)
  const top = [...dishes]
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5)
    .map((d) => ({ code: d.code, name: d.name, sold: d.sold, price: d.price }))
  return {
    dishCount: dishes.length,
    orderCount: orders.length,
    pendingCount: orders.filter((o) => o.status === 'pending').length,
    revenue,
    sold,
    top,
  }
}

export const promotions = () => rawFoods.promotions ?? []