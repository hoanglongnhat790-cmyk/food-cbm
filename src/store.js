import rawFoods from './data/foods.json' with { type: 'json' }

const DISH_KEY = 'cbmfood.dishes'
const ORDER_KEY = 'cbmfood.orders'
const REVIEW_KEY = 'cbmfood.reviews'
const VOUCHER_KEY = 'cbmfood.vouchers'
const SALE_KEY = 'cbmfood.dishSeq'
const ORDER_SEQ_KEY = 'cbmfood.orderSeq'
const ADDRESS_KEY = 'cbmfood.addresses'


export const listAddresses = () => {
  const value = read(ADDRESS_KEY, [])
  return Array.isArray(value) ? value.filter((a) => a && typeof a === 'object') : []
}

export const saveAddress = (input = {}) => {
  const address = {
    id: str(input.id) || `ADDR-${Date.now()}`,
    label: str(input.label, 'Địa chỉ nhà'),
    receiver: str(input.receiver),
    phone: str(input.phone),
    province: str(input.province),
    district: str(input.district),
    ward: str(input.ward),
    detail: str(input.detail),
    isDefault: input.isDefault === true,
  }
  if (!address.receiver || !/^\d{9,11}$/.test(address.phone) || address.detail.length < 3) {
    return { error: 'Vui lòng nhập đầy đủ thông tin địa chỉ' }
  }
  let addresses = listAddresses()
  if (address.isDefault) addresses = addresses.map((a) => ({ ...a, isDefault: false }))
  addresses = [address, ...addresses.filter((a) => a.id !== address.id)].slice(0, 10)
  write(ADDRESS_KEY, addresses)
  return { address, addresses }
}

export const deleteAddress = (id) => {
  const addresses = listAddresses().filter((a) => a.id !== id)
  write(ADDRESS_KEY, addresses)
  return addresses
}

export const defaultAddress = () => listAddresses().find((a) => a.isDefault) || listAddresses()[0] || null

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

/**
 * Các trạng thái đi tiếp hợp lệ từ `status`.
 * Trước đây admin render đúng 5 nút cho mọi đơn, nên đơn đã hoàn thành hoặc
 * đã huỷ vẫn hiện nút "Chờ xác nhận" và bị kéo ngược về đầu quy trình.
 */
const ORDER_NEXT = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['delivering', 'cancelled'],
  delivering: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export const nextOrderStatuses = (status) => [...(ORDER_NEXT[status] ?? [])]


export const CATEGORIES = rawFoods.categories.map((c) => ({ id: c.id, name: c.name }))

// Các đơn vị/cửa hàng bán món. Mỗi món có một đơn vị riêng thay vì mặc định tất cả là CBM FOOD.
export const VENDORS = [
  { id: 'cbm-food', name: 'CBM FOOD', rating: 4.9, reviewCount: 12000, deliveryTime: 30 },
  { id: 'pho-viet-24h', name: 'Phở Việt 24h', rating: 4.8, reviewCount: 3250, deliveryTime: 25 },
  { id: 'com-nha-an', name: 'Cơm Nhà An', rating: 4.9, reviewCount: 2890, deliveryTime: 30 },
  { id: 'banh-mi-pho', name: 'Bánh Mì Phố', rating: 4.7, reviewCount: 1940, deliveryTime: 20 },
  { id: 'tra-chill', name: 'Trà & Chill', rating: 4.8, reviewCount: 1560, deliveryTime: 20 },
  { id: 'an-vat-365', name: 'Ăn Vặt 365', rating: 4.6, reviewCount: 1180, deliveryTime: 25 },
]

const vendorById = (id) => VENDORS.find((v) => v.id === id) || VENDORS[0]
const defaultVendorForCategory = (category) => ({
  'pho-bun': 'pho-viet-24h',
  com: 'com-nha-an',
  'banh-mi': 'banh-mi-pho',
  'do-uong': 'tra-chill',
  'an-vat': 'an-vat-365',
  combo: 'cbm-food',
}[category] || 'cbm-food')
export const vendorOf = (vendorId) => ({ ...vendorById(vendorId) })
export const listVendors = () => VENDORS.map((v) => ({ ...v }))

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

// Topping dùng chung cho toàn bộ cửa hàng. Có thể mở rộng thêm trong admin sau này.
export const TOPPINGS = [
  { id: 'trung-op-la', name: 'Trứng ốp la', price: 10000, emoji: '🍳' },
  { id: 'bo-them', name: 'Thêm thịt bò', price: 25000, emoji: '🥩' },
  { id: 'cha', name: 'Chả lụa', price: 15000, emoji: '🍖' },
  { id: 'pho-mai', name: 'Phô mai', price: 12000, emoji: '🧀' },
  { id: 'rau-them', name: 'Rau thêm', price: 5000, emoji: '🥬' },
  { id: 'trung-luong', name: 'Trứng lòng đào', price: 12000, emoji: '🥚' },
  { id: 'nuoc-ngot', name: 'Nước ngọt', price: 12000, emoji: '🥤' },
  { id: 'khoai-tay', name: 'Khoai tây chiên', price: 18000, emoji: '🍟' },
]

export const findTopping = (id) => TOPPINGS.find((t) => t.id === id) || null
export const toppingTotal = (toppings = []) =>
  (Array.isArray(toppings) ? toppings : []).reduce((sum, id) => sum + (findTopping(id)?.price || 0), 0)

export const PAYMENT_INFO = {
  bank: {
    bankName: 'Vietcombank',
    accountName: 'CBM FOOD',
    accountNumber: '0123456789',
    note: 'Nội dung: CBM + MÃ ĐƠN',
    qrImage: '/payment-bank.svg',
  },
  momo: {
    phone: '0900000000',
    accountName: 'CBM FOOD',
    note: 'Nội dung: CBM + MÃ ĐƠN',
    qrImage: '/payment-momo.svg',
  },
}

const accentOf = (index) => ['#e8542d', '#c4401f', '#2f9e63', '#d98324', '#8a5cf6', '#0ea5e9'][index % 6]

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

const str = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback)

/** Kho cần hiện số tiền trong thông báo lỗi nên có formatter riêng, không phụ
 *  thuộc giao diện (cart/main/admin đều có bản `money` của riêng mình). */
const money = (value) => `${num(value).toLocaleString('vi-VN')}đ`

export const RATING_MIN = 1
export const RATING_MAX = 5
const COMMENT_MAX = 300

const normalizeRating = (value) => {
  /* Chỉ nhận số hoặc chuỗi số. Bỏ qua boolean/null/object vì `Number(true)`
     là 1 — không có bản đánh giá nào chấm `true` sao mà lọt thành 1 sao. */
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  /* Sao là số nguyên: `Math.floor` ở đây sẽ biến 3.5 thành 3, tức khách chấm
     3.5 rồi lưu lại 3 mà không hề báo. */
  if (!Number.isInteger(n)) return null
  return n >= RATING_MIN && n <= RATING_MAX ? n : null
}

export const VOUCHER_TYPES = {
  percent: { label: 'Giảm %', suffix: '%', hint: 'Ví dụ 10 = giảm 10% tạm tính' },
  fixed: { label: 'Giảm tiền', suffix: 'đ', hint: 'Ví dụ 50000 = giảm thẳng 50.000đ' },
  freeship: { label: 'Miễn phí giao hàng', suffix: '', hint: 'Bỏ phí giao hàng cho đơn này' },
}

const VOUCHER_CODE_MAX = 20
/** Số tiền làm tròn xuống bội 1.000đ cho khớp cách bố trí giá của cửa hàng. */
const DISCOUNT_ROUND = 1000

const normalizeCode = (value) =>
  str(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, VOUCHER_CODE_MAX)

const normalizeVoucher = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  const code = normalizeCode(raw.code)
  if (!code) return null
  const type = Object.keys(VOUCHER_TYPES).includes(raw.type) ? raw.type : 'percent'
  const startsAt = num(raw.startsAt)
  const expiresAt = num(raw.expiresAt)
  return {
    id: str(raw.id) || code,
    code,
    type,
    value: type === 'freeship' ? 0 : num(raw.value),
    maxDiscount: num(raw.maxDiscount),
    minOrder: num(raw.minOrder),
    startsAt,
    /* Không nhập hạn = dùng mãi; nhập hạn cũ hơn lúc bắt đầu là lỗi cấu hình
       nên đổi thành không hạn thay vì tạo mã chết ngay. */
    expiresAt: expiresAt && expiresAt < startsAt ? 0 : expiresAt,
    usageLimit: num(raw.usageLimit),
    usedCount: num(raw.usedCount),
    perUserLimit: num(raw.perUserLimit),
    usedBy: { ...(raw.usedBy && typeof raw.usedBy === 'object' ? raw.usedBy : {}) },
    active: raw.active !== false,
    createdAt: num(raw.createdAt) || Date.now(),
  }
}

/**
 * Chuẩn hoá một bản đánh giá đọc từ kho, bỏ bản ghi hỏng.
 *
 * Kho là `localStorage` nên ai cũng sửa được (devtools, tab cũ, phiên bản trước
 * chưa có trường `locked`). Trả về `null` cho bản ghi không có số sao hợp lệ để
 * `listReviews` và `dishRating` không phải tự đoán.
 */
const normalizeReview = (raw) => {
  const rating = normalizeRating(raw?.rating)
  if (!raw || rating === null) return null
  return {
    id: str(raw.id),
    orderId: str(raw.orderId),
    orderCode: str(raw.orderCode),
    dishKey: str(raw.dishKey),
    userId: str(raw.userId) || null,
    rating,
    comment: str(raw.comment).slice(0, COMMENT_MAX),
    hidden: raw.hidden === true,
    locked: raw.locked === true,
    createdAt: num(raw.createdAt) || Date.now(),
    updatedAt: num(raw.updatedAt) || num(raw.createdAt) || Date.now(),
  }
}

export const normalizeImage = (value) => {
  const url = str(value)
  if (!url) return ''
  if (url.startsWith('//')) return ''

  /*
   * Ảnh món được chọn từ máy được nén thành data:image/... rồi lưu vào
   * localStorage. Data URL thường dài hàng chục/hàng trăm nghìn ký tự, nên
   * giới hạn 500 ký tự cũ làm ảnh biến mất ngay sau khi reload vì
   * normalizeDish() đổi nó thành chuỗi rỗng.
   *
   * URL ảnh bên ngoài vẫn giữ giới hạn nhỏ; ảnh data URL cho phép tối đa
   * khoảng 1.5 MB để tránh làm localStorage phình quá lớn.
   */
  if (url.startsWith('data:image/')) return url.length <= 1500000 ? url : ''
  if (url.length > 500) return ''
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

/* foods.json để cùng một nhãn ở cả `tagType` và `tag` (ví dụ tagType:
   "bestseller" + tag: "Bán chạy nhất"), nếu nối thẳng sẽ ra hai thẻ giống
   nhau. Set giữ thứ tự và loại trùng. */
const uniqueTags = (...values) => [...new Set(values.filter(Boolean))]

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
  tags: uniqueTags(TAG_TONE[item.tagType]?.label, str(item.tag)).slice(0, 2),
  accent: accentOf(index),
  emoji: EMOJIS[index % EMOJIS.length],
  status: item.isAvailable === false ? 'unavailable' : 'available',
  /* Phải có `stock` tường minh: dữ liệu mẫu không có trường này, để undefined
     thì `Math.min(MAX_QTY, undefined)` ra NaN và làm hỏng cả giỏ hàng. */
  stock: null,
  image: normalizeImage(item.image),
  sold: num(item.reviewCount) * 2,
  ingredients: Array.isArray(item.ingredients) ? item.ingredients.map((x) => str(x)).filter(Boolean) : [],
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

/**
 * Chuẩn hoá số lượng tồn của một món.
 *
 * `null` = không giới hạn, nên món tạo từ trước (không có trường `stock`)
 * giữ nguyên hành vi cũ và không bị chặn bởi tồn kho.
 */
export const normalizeStock = (value) => {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.floor(n))
}

/** Món đã hết hàng: còn giới hạn số lượng mà đã về 0. */
export const isSoldOut = (dish) => Boolean(dish) && dish.stock !== null && dish.stock <= 0

/** Có bán được không (tính cả hết hàng, không chỉ trạng thái tạm ngưng). */
export const isPurchasable = (dish) => Boolean(dish) && dish.status !== 'unavailable' && !isSoldOut(dish)

export const normalizeDish = (input, index = 0) => {
  if (!input || typeof input !== 'object') return null
  const name = str(input.name)
  if (!name) return null
  const price = num(input.price)
  const originalPrice = num(input.originalPrice)
  const status = Object.keys(DISH_STATUS).includes(input.status) ? input.status : 'available'
  const vendorId = VENDORS.some((v) => v.id === input.vendorId) ? input.vendorId : defaultVendorForCategory(str(input.category, CATEGORIES[0].id))
  const vendor = vendorById(vendorId)
  return {
    id: str(input.id) || `${CODE_PREFIX}${num(input.seq, index + 1)}`,
    code: str(input.code) || `${CODE_PREFIX}${String(num(input.seq, index + 1)).padStart(3, '0')}`,
    name,
    description: str(input.description),
    category: str(input.category, CATEGORIES[0].id),
    vendorId,
    vendorName: vendor.name,
    price,
    originalPrice: originalPrice > price ? originalPrice : null,
    rating: Number(input.rating) || 0,
    ratingCount: num(input.ratingCount),
    tags: Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === 'string') : [],
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [],
    accent: str(input.accent) || accentOf(index),
    emoji: EMOJIS.includes(str(input.emoji)) ? str(input.emoji) : EMOJIS[index % EMOJIS.length],
    status,
    image: normalizeImage(input.image),
    sold: num(input.sold),
    stock: normalizeStock(input.stock),
    createdAt: num(input.createdAt, Date.now()),
  }
}

let dishes = loadDishes()
let orders = read(ORDER_KEY, []).filter((o) => o && typeof o === 'object')
let reviews = read(REVIEW_KEY, []).map(normalizeReview).filter(Boolean)
let vouchers = read(VOUCHER_KEY, []).map(normalizeVoucher).filter(Boolean)
let seq = num(read(SALE_KEY, rawFoods.dishes.length))
/* Date.now() trùng nhau khi khách đặt nhiều đơn trong cùng 1 mili-giây,
   nên id đơn cần thêm số thứ tự để luôn khác nhau. */
let orderSeq = num(read(ORDER_SEQ_KEY, 0))

const persistDishes = () => write(DISH_KEY, dishes)
const persistOrders = () => write(ORDER_KEY, orders)
const persistSeq = () => write(SALE_KEY, seq)
const persistReviews = () => write(REVIEW_KEY, reviews)
const persistVouchers = () => write(VOUCHER_KEY, vouchers)

/**
 * Nạp lại món/đơn/đánh giá/voucher từ localStorage.
 *
 * `store` giữ dữ liệu trong bộ nhớ nên khi một TÁB KHÁC ghi xuống, sự kiện
 * `storage` báo thay đổi nhưng mảng trong module này vẫn là bản cũ — gọi lại
 * `listDishes()`/`listOrdersByUser()` sẽ trả dữ liệu cũ mãi. Hàm này đồng bộ
 * lại trước khi vẽ giao diện.
 */
export const reloadFromStorage = () => {
  dishes = loadDishes()
  orders = read(ORDER_KEY, []).filter((o) => o && typeof o === 'object')
  reviews = read(REVIEW_KEY, []).map(normalizeReview).filter(Boolean)
  vouchers = read(VOUCHER_KEY, []).map(normalizeVoucher).filter(Boolean)
  seq = num(read(SALE_KEY, rawFoods.dishes.length))
  orderSeq = num(read(ORDER_SEQ_KEY, 0))
}

export const listDishes = () => dishes.map((d) => ({ ...d }))

export const listOrders = () => orders.map((o) => ({ ...o }))

export const listActiveDishes = () =>
  dishes.filter(isPurchasable).map((d) => ({ ...d }))

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
  /* Trống = không giới hạn, nên chỉ chặn khi có nhập mà sai kiểu số. */
  if (input.stock !== undefined && input.stock !== null && input.stock !== '') {
    const n = Number(input.stock)
    if (!Number.isFinite(n)) return 'Số lượng tồn không hợp lệ'
    if (n < 0) return 'Số lượng tồn không được âm'
    if (Math.floor(n) !== n) return 'Số lượng tồn phải là số nguyên'
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
  /* Đánh giá trỏ tới mã môn/đơn cũ nên phải xoá luôn, nếu không mảng này vẫn
     giữ trong bộ nhớ và làm điểm của món cũ rò sang lần nạp sau. */
  reviews = []
  vouchers = []
  orderSeq = 0
  persistDishes()
  persistOrders()
  persistReviews()
  persistVouchers()
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

export const createOrder = ({
  customer = {},
  items = [],
  note = '',
  userId = null,
  voucherCode = '',
  paymentMethod = 'cod',
  paymentChannel = 'bank',
  deliveryMethod = 'delivery',
} = {}) => {
  const name = str(customer.name)
  const phone = str(customer.phone)
  const address = str(customer.address)
  const addressParts = customer.addressParts && typeof customer.addressParts === 'object' ? { ...customer.addressParts } : null
  const lines = (Array.isArray(items) ? items : [])
    .map((item) => {
      const dish = findDish(item.key ?? item.id ?? item.code)
      const qty = Math.min(MAX_QTY, Math.max(0, Math.floor(Number(item.qty) || 0)))
      if (!dish || qty < 1) return null
      const toppingIds = [...new Set(Array.isArray(item.toppings) ? item.toppings.map((id) => str(id)).filter(Boolean) : [])]
      const toppings = toppingIds.map(findTopping).filter(Boolean)
      const toppingPrice = toppings.reduce((sum, topping) => sum + topping.price, 0)
      return {
        key: dish.code,
        name: dish.name,
        vendorId: dish.vendorId,
        vendorName: dish.vendorName,
        price: dish.price + toppingPrice,
        basePrice: dish.price,
        qty,
        toppings: toppings.map((t) => ({ id: t.id, name: t.name, price: t.price })),
      }
    })
    .filter(Boolean)

  if (!lines.length) return { error: 'Giỏ hàng đang rỗng' }
  if (!name) return { error: 'Vui lòng nhập tên người nhận' }
  if (!/^\d{9,11}$/.test(phone)) return { error: 'Số điện thoại không hợp lệ' }
  if (address.length < 5 || address.length > 200) return { error: 'Địa chỉ phải dài 5-200 ký tự' }

  /* Gộp trước khi kiểm tra tồn: nếu không, giỏ gửi lên 3 dòng cùng món 3 phần
     sẽ bị kiểm tra 3 lần (3 <= 5 là ok) rồi chỉ trừ 3, đơn thành 6 phần
     trong khi kho chỉ còn 5. */
  const wanted = new Map()
  for (const line of lines) {
    const total = (wanted.get(line.key) ?? 0) + line.qty
    if (total > MAX_QTY) {
      return { error: `Mỗi món chỉ đặt tối đa ${MAX_QTY} phần` }
    }
    wanted.set(line.key, total)
  }

  /* Chặn vượt tồn TRƯỚC khi trừ: giỏ có thể còn món đã hết từ lúc thêm, và tab
     khác vừa bán hết. Báo món nào hết thay vì âm thầm đặt thiếu. */
  for (const [key, qty] of wanted) {
    const dish = findDish(key)
    if (!dish) return { error: `Không tìm thấy món ${key}` }
    if (dish.status === 'unavailable') return { error: `Món ${dish.name} đang tạm ngưng` }
    if (isSoldOut(dish)) return { error: `Món ${dish.name} đã hết hàng` }
    if (dish.stock !== null && qty > dish.stock) {
      return { error: `Món ${dish.name} chỉ còn ${dish.stock} phần (bạn đặt ${qty})` }
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0)

  /* Voucher kiểm tra lại ở đây chứ không tin vào giỏ: mã có thể hết lượt, hết
     hạn hoặc khách vừa dùng ở tab khác trong lúc đang thanh toán. */
  const wantedVoucher = normalizeCode(voucherCode)
  let discount = 0
  let voucherSnapshot = null
  let shipping = subtotal >= FREE_SHIP_FROM ? 0 : SHIP_FEE
  if (wantedVoucher) {
    const checked = checkVoucher(wantedVoucher, { subtotal, userId, phone })
    if (checked.error) return { error: checked.error }
    discount = checked.discount
    shipping = checked.shipping
    voucherSnapshot = {
      code: checked.voucher.code,
      type: checked.voucher.type,
      value: checked.voucher.value,
      label: voucherLabel(checked.voucher),
      discount,
    }
  }

  if (deliveryMethod === 'pickup') shipping = 0

  orderSeq += 1
  const order = {
    id: `DH${Date.now()}-${String(orderSeq).padStart(4, '0')}`,
    code: nextOrderCode(),
    customer: { name, phone, address, addressParts },
    items: lines,
    note: str(note),
    subtotal,
    discount,
    voucher: voucherSnapshot,
    shipping,
    total: Math.max(0, subtotal - discount) + shipping,
    paymentMethod: ['cod', 'bank', 'momo'].includes(paymentMethod) ? paymentMethod : 'cod',
    paymentChannel: paymentMethod === 'bank' ? (paymentChannel === 'momo' ? 'momo' : 'bank') : null,
    paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'pending',
    deliveryMethod: deliveryMethod === 'pickup' ? 'pickup' : 'delivery',
    receivedAt: null,
    receivedByCustomer: false,
    deliveryProof: null,
    shipper: null,
    status: 'pending',
    userId,
    createdAt: Date.now(),
    history: [{ status: 'pending', at: Date.now() }],
  }
  orders = [order, ...orders]
  dishes = dishes.map((d) => {
    const qty = wanted.get(d.code)
    if (!qty) return d
    /* `stock === null` là không giới hạn nên giữ nguyên null. */
    const nextStock = d.stock === null ? null : Math.max(0, d.stock - qty)
    return { ...d, sold: d.sold + qty, stock: nextStock }
  })
  if (voucherSnapshot) consumeVoucher(voucherSnapshot.code, { userId, phone })
  persistOrders()
  persistDishes()
  write(ORDER_SEQ_KEY, orderSeq)
  return { order: copyOrder(order) }
}

/**
 * Trả tồn kho và lượt dùng voucher khi đơn bị huỷ.
 * `stockRestored` chặn việc hoàn hai lần: huỷ đơn cũ rồi admin bấm huỷ lại ở
 * mục khác sẽ làm tồn kho nhân đôi.
 */
const restoreOrderResources = (order) => {
  if (order.stockRestored) return false
  const lines = order.items ?? []
  dishes = dishes.map((d) => {
    const line = lines.find((l) => l.key === d.code)
    if (!line || d.stock === null) return d
    return { ...d, stock: d.stock + line.qty }
  })
  persistDishes()
  if (order.voucher?.code) {
    releaseVoucher(order.voucher.code, {
      userId: order.userId,
      phone: order.customer?.phone ?? '',
    })
  }
  return true
}

export const findOrder = (key) => {
  const found = orders.find((o) => o.id === key || o.code === key)
  return found ? copyOrder(found) : null
}

/** Shipper nhận một đơn đã được nhà hàng xác nhận. */
export const claimOrder = (key, shipper = {}) => {
  const index = orders.findIndex((o) => o.code === key || o.id === key)
  if (index < 0) return { error: 'Không tìm thấy đơn hàng' }
  const previous = orders[index]
  if (!['pending', 'confirmed'].includes(previous.status)) return { error: 'Đơn chưa sẵn sàng để shipper nhận' }
  if (previous.deliveryMethod !== 'delivery') return { error: 'Đơn này là tự nhận tại cửa hàng' }
  if (previous.shipper?.id && previous.shipper.id !== shipper.id) return { error: 'Đơn đã có shipper nhận' }
  const assigned = {
    id: str(shipper.id),
    name: str(shipper.name, 'Shipper CBM FOOD'),
    phone: str(shipper.phone),
    email: str(shipper.email),
  }
  if (!assigned.id) return { error: 'Tài khoản shipper không hợp lệ' }
  const now = Date.now()
  const next = {
    ...previous,
    shipper: assigned,
    assignedAt: now,
    status: 'confirmed',
    history: [...(previous.history ?? []), { status: 'confirmed', at: now, actor: assigned.name, action: 'Shipper nhận đơn' }],
  }
  orders[index] = next
  persistOrders()
  return { order: copyOrder(next) }
}

export const listOrdersForShipper = (shipperId) => {
  if (!shipperId) return []
  return orders
    .filter((o) => o.shipper?.id === shipperId)
    .map(copyOrder)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export const listAvailableShipOrders = () => orders
  .filter((o) => ['pending', 'confirmed'].includes(o.status) && o.deliveryMethod === 'delivery' && !o.shipper?.id)
  .map(copyOrder)
  .sort((a, b) => b.createdAt - a.createdAt)

export const saveOrderDeliveryProof = (key, { shipperId = '', shipperName = '', shipperPhone = '', shipperEmail = '', photo = '', note = '' } = {}) => {
  const index = orders.findIndex((o) => o.code === key || o.id === key)
  if (index < 0) return null
  const previous = orders[index]
  const existingShipper = previous.shipper || {}
  const next = {
    ...previous,
    // Thông tin shipper được giữ nguyên từ lúc nhận đơn; proof chỉ là thông tin shipper gửi về.
    shipper: {
      id: str(shipperId, existingShipper.id),
      name: str(shipperName, existingShipper.name || 'Shipper CBM FOOD'),
      phone: str(shipperPhone, existingShipper.phone),
      email: str(shipperEmail, existingShipper.email),
    },
    deliveryProof: {
      photo: typeof photo === 'string' && photo.startsWith('data:image/') && photo.length <= 7 * 1024 * 1024 ? photo : '',
      note: str(note),
      at: Date.now(),
      source: 'shipper',
    },
  }
  orders[index] = next
  persistOrders()
  return copyOrder(next)
}

export const confirmOrderReceived = (key, userId = null) => {
  const index = orders.findIndex((o) => o.code === key || o.id === key)
  if (index < 0) return { error: 'Không tìm thấy đơn hàng' }
  const previous = orders[index]
  if (userId && previous.userId && previous.userId !== userId) return { error: 'Bạn không có quyền xác nhận đơn này' }
  if (!['delivering', 'completed'].includes(previous.status)) return { error: 'Đơn chưa ở trạng thái đang giao' }
  if (previous.receivedByCustomer) return { order: copyOrder(previous) }
  const now = Date.now()
  const next = {
    ...previous,
    status: 'completed',
    receivedAt: now,
    receivedByCustomer: true,
    paymentStatus: previous.paymentMethod === 'cod' ? 'paid' : (previous.paymentStatus || 'paid'),
    history: previous.status === 'completed' ? previous.history : [...(previous.history ?? []), { status: 'completed', at: now }],
  }
  orders[index] = next
  persistOrders()
  return { order: copyOrder(next) }
}

export const updateOrderPayment = (key, paymentStatus) => {
  const allowed = ['pending', 'paid', 'unpaid', 'failed']
  if (!allowed.includes(paymentStatus)) return null
  const index = orders.findIndex((o) => o.code === key || o.id === key)
  if (index < 0) return null
  orders[index] = { ...orders[index], paymentStatus }
  persistOrders()
  return copyOrder(orders[index])
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
    paymentStatus: status === 'completed'
      ? (previous.paymentMethod === 'cod' ? 'paid' : (previous.paymentStatus === 'pending' ? 'paid' : previous.paymentStatus))
      : previous.paymentStatus,
    receivedAt: status === 'completed' && !previous.receivedAt ? Date.now() : previous.receivedAt ?? null,
    history: [...previous.history, { status, at: Date.now() }],
  }
  /* Admin cũng có thể huỷ đơn từ bước đang giao, nên hoàn kho phải nằm ở đây
     chứ không chỉ trong cancelOrder của khách. */
  if (status === 'cancelled' && restoreOrderResources(order)) {
    orders = orders.map((o, i) => (i === index ? { ...order, stockRestored: true } : o))
    persistOrders()
    return copyOrder(orders[index])
  }
  orders = orders.map((o, i) => (i === index ? order : o))
  persistOrders()
  return { ...order }
}

export const shipperStats = () => {
  const users = []
  try {
    const raw = localStorage.getItem('cbmfood.users')
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) users.push(...parsed.filter((u) => u?.role === 'shipper'))
  } catch {}
  return users.map((u) => {
    const mine = orders.filter((o) => o.shipper?.id === u.id)
    return {
      id: u.id,
      name: str(u.name, 'Shipper'),
      email: str(u.email),
      phone: str(u.phone),
      total: mine.length,
      delivering: mine.filter((o) => o.status === 'delivering').length,
      completed: mine.filter((o) => o.status === 'completed').length,
      revenue: mine.filter((o) => o.status === 'completed').reduce((sum, o) => sum + num(o.shipping), 0),
    }
  })
}

export const listOrdersByStatus = (status) =>
  orders.filter((o) => o.status === status).map((o) => ({ ...o }))

/**
 * Bản sao độc lập của đơn.
 * `{ ...order }` chỉ copy nông nên mảng `items` và `history` vẫn trỏ vào dữ
 * liệu gốc — code giao diện sửa một phần tử là hỏng luôn đơn trong kho.
 */
const copyOrder = (order) => ({
  ...order,
  items: (order.items ?? []).map((item) => ({ ...item, toppings: (item.toppings ?? []).map((t) => ({ ...t })) })),
  history: (order.history ?? []).map((h) => ({ ...h })),
  customer: { ...order.customer },
  /* Ưu đã dùng để trả lượt, nên phải copy riêng như các mảng kia. */
  voucher: order.voucher ? { ...order.voucher } : null,
  shipper: order.shipper ? { ...order.shipper } : null,
  deliveryProof: order.deliveryProof ? { ...order.deliveryProof } : null,
})

/**
 * Đơn của một khách đã đăng nhập, mới nhất trước.
 * Chỉ khớp `userId`: đơn của khách vãng lai (userId null) không thuộc về ai
 * và không được lộ cho bất kỳ tài khoản nào.
 */
export const listOrdersByUser = (userId) => {
  if (!userId) return []
  return orders
    .filter((o) => o.userId === userId)
    .map(copyOrder)
    .sort((a, b) => b.createdAt - a.createdAt || String(b.code).localeCompare(String(a.code)))
}

/** Khách chỉ được huỷ khi nhà hàng chưa xác nhận. */
export const canCancelOrder = (status) => status === 'pending'

export const cancelOrder = (key, userId = null) => {
  const index = orders.findIndex((o) => o.id === key || o.code === key)
  if (index === -1) return { error: 'Không tìm thấy đơn hàng' }
  const previous = orders[index]
  if (previous.status === 'cancelled') return copyOrder(previous)
  if (userId && previous.userId !== userId) {
    /* Chỉ đơn có chủ mới huỷ được. Thiếu kiểm tra này thì biết mã đơn là
       huỷ hộ được đơn của người khác. */
    return { error: 'Bạn không huỷ được đơn của người khác' }
  }
  if (!canCancelOrder(previous.status)) {
    /* Nhà hàng đã nhận món rồi thì khách tự huỷ trong hệ thống sẽ lệch với
       thực tế. Trả lỗi thay vì âm thầm đổi trạng thái. */
    return { error: `Đơn đang ${ORDER_STATUS[previous.status]?.label ?? previous.status.toLowerCase()} nên không tự huỷ được` }
  }
  const order = {
    ...previous,
    status: 'cancelled',
    cancelledBy: 'customer',
    history: [...previous.history, { status: 'cancelled', at: Date.now() }],
  }
  if (restoreOrderResources(order)) order.stockRestored = true
  orders = orders.map((o, i) => (i === index ? order : o))
  persistOrders()
  return copyOrder(order)
}

/* ===================== ĐÁNH GIÁ MÓN ===================== */

const copyReview = (review) => ({ ...review })

/** Chỉ đơn đã giao thành công mới được đánh giá. */
export const canRateOrder = (status) => status === 'completed'

const findOrderIndex = (key) => orders.findIndex((o) => o.id === key || o.code === key)

/**
 * Kiểm tra quyền đánh giá trước khi ghi: đúng người đặt, đơn đã hoàn thành và
 * món thật sự nằm trong đơn đó. Thiếu kiểm tra `userId` thì khách có thể chấm
 * sao cho đơn của người khác chỉ cần biết mã đơn.
 */
const ratingGuard = (orderKey, dishKey, userId) => {
  const order = orders[findOrderIndex(orderKey)]
  if (!order) return { error: 'Không tìm thấy đơn hàng' }
  if (!userId || order.userId !== userId) return { error: 'Bạn không đánh giá được đơn của người khác' }
  if (!canRateOrder(order.status)) {
    return { error: 'Chỉ đánh giá được sau khi đơn giao thành công' }
  }
  const line = (order.items ?? []).find((i) => i.key === dishKey)
  if (!line) return { error: 'Món này không có trong đơn hàng' }
  return { order, line }
}

/** Tạo mới hoặc sửa đánh giá của chính khách cho một món trong đơn. */
export const saveReview = ({ orderId, dishKey, rating, comment = '', userId = null } = {}) => {
  const guard = ratingGuard(orderId, dishKey, userId)
  if (guard.error) return guard

  const stars = normalizeRating(rating)
  if (stars === null) return { error: `Vui lòng chấm từ ${RATING_MIN} đến ${RATING_MAX} sao` }
  const text = str(comment).slice(0, COMMENT_MAX)

  const index = reviews.findIndex(
    (r) => r.orderId === guard.order.id && r.dishKey === dishKey && r.userId === userId,
  )
  const existing = index === -1 ? null : reviews[index]
  if (existing?.locked) {
    return { error: 'Đánh giá đã khoá, hãy mở khoá trước khi sửa' }
  }

  const review = normalizeReview({
    id: existing?.id ?? `RV-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    orderId: guard.order.id,
    orderCode: guard.order.code,
    dishKey,
    userId,
    rating: stars,
    comment: text,
    hidden: existing?.hidden === true,
    locked: false,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  })

  reviews = index === -1 ? [review, ...reviews] : reviews.map((r, i) => (i === index ? review : r))
  persistReviews()
  return { review: copyReview(review) }
}

/**
 * Khoá / mở khoá đánh giá.
 * Khoá là chốt: khách vẫn tự mở khoá để sửa được, nhưng đánh giá đã khoá thì
 * chặn ghi đè để không lỡ tay làm mất số sao đã chấm.
 */
export const setReviewLock = ({ orderId, dishKey, locked, userId = null } = {}) => {
  const guard = ratingGuard(orderId, dishKey, userId)
  if (guard.error) return guard

  const index = reviews.findIndex(
    (r) => r.orderId === guard.order.id && r.dishKey === dishKey && r.userId === userId,
  )
  if (index === -1) return { error: 'Chưa có đánh giá để khoá' }
  if (reviews[index].locked === Boolean(locked)) return { review: copyReview(reviews[index]) }

  const review = { ...reviews[index], locked: Boolean(locked), updatedAt: Date.now() }
  reviews = reviews.map((r, i) => (i === index ? review : r))
  persistReviews()
  return { review: copyReview(review) }
}

/** Quản trị ẩn/hiện đánh giá; bị ẩn thì không tính vào điểm trung bình. */
export const setReviewHidden = (reviewId, hidden) => {
  const index = reviews.findIndex((r) => r.id === reviewId)
  if (index === -1) return null
  const review = { ...reviews[index], hidden: Boolean(hidden), updatedAt: Date.now() }
  reviews = reviews.map((r, i) => (i === index ? review : r))
  persistReviews()
  return copyReview(review)
}

export const listReviews = ({ includeHidden = true } = {}) =>
  reviews.filter((r) => includeHidden || !r.hidden).map(copyReview)

export const listReviewsByOrder = (orderId) =>
  reviews.filter((r) => r.orderId === orderId).map(copyReview)

/** Đánh giá của một khách cho một món trong đơn (kể cả đang bị ẩn). */
export const findReview = ({ orderId, dishKey, userId }) =>
  copyReview(
    reviews.find((r) => r.orderId === orderId && r.dishKey === dishKey && r.userId === userId) ?? {
      id: '',
      orderId: '',
      dishKey,
      rating: null,
      comment: '',
      hidden: false,
      locked: false,
    },
  )

/**
 * Điểm trung bình hiển thị trên thẻ món.
 * Đánh giá bị ẩn không tính và điểm làm tròn 1 chữ số thập phân.
 */
export const dishRating = (dishKey) => {
  const visible = reviews.filter((r) => r.dishKey === dishKey && !r.hidden)
  if (!visible.length) return { average: 0, count: 0 }
  const sum = visible.reduce((acc, r) => acc + r.rating, 0)
  return { average: Math.round((sum / visible.length) * 10) / 10, count: visible.length }
}

/** Bản đồ điểm của mọi món, để không phải tính lại từng thẻ. */
export const dishRatings = () =>
  Object.fromEntries(dishes.map((d) => [d.code, dishRating(d.code)]))

/* ===================== VOUCHER ===================== */

const copyVoucher = (voucher) => ({ ...voucher, usedBy: { ...voucher.usedBy } })

const usageKey = (userId, phone) => (userId ? `u:${userId}` : phone ? `g:${phone}` : null)

export const voucherUsage = (voucher, { userId = null, phone = '' } = {}) => {
  const key = usageKey(userId, phone)
  return key ? num(voucher.usedBy[key]) : 0
}

const voucherIsLive = (voucher, now = Date.now()) => {
  if (!voucher.active) return 'Mã này đã ngừng sử dụng'
  if (voucher.startsAt && now < voucher.startsAt) return 'Mã chưa tới thời gian áp dụng'
  if (voucher.expiresAt && now > voucher.expiresAt) return 'Mã đã hết hạn'
  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) return 'Mã đã hết lượt dùng'
  return null
}

/** Số tiền voucher trừ cho tạm tính; miễn phí giao hàng trừ ở phí ship. */
export const voucherDiscount = (voucher, subtotal) => {
  if (!voucher || voucher.type === 'freeship') return 0
  if (subtotal <= 0) return 0
  const raw =
    voucher.type === 'percent' ? (subtotal * voucher.value) / 100 : Math.min(voucher.value, subtotal)
  const capped = voucher.maxDiscount > 0 ? Math.min(raw, voucher.maxDiscount) : raw
  const rounded = Math.floor(capped / DISCOUNT_ROUND) * DISCOUNT_ROUND
  return Math.max(0, Math.min(rounded, subtotal))
}

/**
 * Kiểm tra mã trước khi khách áp vào giỏ.
 * Trả kèm số tiền giảm để giao diện hiện ngay, không phải gọi lại từng chỗ.
 */
export const checkVoucher = (code, { subtotal = 0, userId = null, phone = '' } = {}) => {
  const voucher = findVoucher(code)
  if (!voucher) return { error: 'Không tìm thấy mã giảm giá' }
  const live = voucherIsLive(voucher)
  if (live) return { error: live }
  if (subtotal < voucher.minOrder) {
    return { error: `Đơn tối thiểu ${money(voucher.minOrder)} để dùng mã này` }
  }
  if (voucher.perUserLimit > 0) {
    const used = voucherUsage(voucher, { userId, phone })
    if (used >= voucher.perUserLimit) {
      return { error: `Bạn đã dùng mã này ${used}/${voucher.perUserLimit} lần` }
    }
  }
  const discount = voucherDiscount(voucher, subtotal)
  const baseShipping = subtotal >= FREE_SHIP_FROM ? 0 : SHIP_FEE
  const freeShip = voucher.type === 'freeship' && baseShipping > 0
  if (!discount && !freeShip) {
    return { error: 'Mã này không giảm được gì cho đơn hiện tại' }
  }
  return {
    voucher: copyVoucher(voucher),
    discount,
    shipping: freeShip ? 0 : baseShipping,
    total: Math.max(0, subtotal - discount) + (freeShip ? 0 : baseShipping),
  }
}

/** Ghi nhận một lượt dùng. Không gọi trực tiếp từ giao diện. */
const consumeVoucher = (code, { userId = null, phone = '' } = {}) => {
  const index = vouchers.findIndex((v) => v.code === normalizeCode(code))
  if (index === -1) return null
  /* Phải sửa trong mảng rồi gán lại: `findVoucher` trả về bản sao nên tăng
     trên đó sẽ không bao giờ được lưu xuống. */
  const current = vouchers[index]
  const key = usageKey(userId, phone)
  const next = {
    ...current,
    usedCount: current.usedCount + 1,
    usedBy: key ? { ...current.usedBy, [key]: num(current.usedBy[key]) + 1 } : current.usedBy,
  }
  vouchers = vouchers.map((v, i) => (i === index ? next : v))
  persistVouchers()
  return copyVoucher(next)
}

/** Trả lại lượt dùng khi đơn bị huỷ, để mã không bị mất vô lý. */
const releaseVoucher = (code, { userId = null, phone = '' } = {}) => {
  const index = vouchers.findIndex((v) => v.code === normalizeCode(code))
  if (index === -1) return null
  const current = vouchers[index]
  const key = usageKey(userId, phone)
  const next = {
    ...current,
    usedCount: Math.max(0, current.usedCount - 1),
    usedBy: key
      ? { ...current.usedBy, [key]: Math.max(0, num(current.usedBy[key]) - 1) }
      : current.usedBy,
  }
  vouchers = vouchers.map((v, i) => (i === index ? next : v))
  persistVouchers()
  return copyVoucher(next)
}

const validateVoucherInput = (input) => {
  if (!input || typeof input !== 'object') return 'Dữ liệu voucher không hợp lệ'
  const code = normalizeCode(input.code)
  if (!code) return 'Mã voucher không hợp lệ (chỉ dùng chữ và số)'
  if (code.length < 3) return 'Mã voucher quá ngắn'
  if (!Object.keys(VOUCHER_TYPES).includes(input.type)) return 'Loại voucher không hợp lệ'
  if (input.type !== 'freeship') {
    const value = Number(input.value)
    if (!Number.isFinite(value) || value <= 0) return 'Mức giảm phải lớn hơn 0'
    if (input.type === 'percent' && value > 100) return 'Mức giảm không vượt quá 100%'
  }
  const startsAt = num(input.startsAt)
  const expiresAt = num(input.expiresAt)
  if (expiresAt && expiresAt < startsAt) return 'Ngày hết hạn phải sau ngày bắt đầu'
  return null
}

export const listVouchers = () => vouchers.map(copyVoucher)

export const findVoucher = (code) => {
  const wanted = normalizeCode(code)
  if (!wanted) return null
  const found = vouchers.find((v) => v.code === wanted)
  return found ? copyVoucher(found) : null
}

export const createVoucher = (input = {}) => {
  const invalid = validateVoucherInput(input)
  if (invalid) return { error: invalid }
  const code = normalizeCode(input.code)
  if (findVoucher(code)) return { error: 'Mã voucher đã tồn tại' }
  const voucher = normalizeVoucher({ ...input, code, id: `VC-${Date.now()}` })
  vouchers = [voucher, ...vouchers]
  persistVouchers()
  return { voucher: copyVoucher(voucher) }
}

export const updateVoucher = (key, input = {}) => {
  const index = vouchers.findIndex((v) => v.id === key || v.code === key)
  if (index === -1) return { error: 'Không tìm thấy voucher' }
  const previous = vouchers[index]
  const merged = { ...previous, ...input, code: normalizeCode(input.code ?? previous.code) }
  const invalid = validateVoucherInput(merged)
  if (invalid) return { error: invalid }
  if (merged.code !== previous.code && findVoucher(merged.code)) {
    return { error: 'Mã voucher đã tồn tại' }
  }
  const next = normalizeVoucher({
    ...merged,
    id: previous.id,
    usedCount: previous.usedCount,
    usedBy: previous.usedBy,
  })
  vouchers = vouchers.map((v, i) => (i === index ? next : v))
  persistVouchers()
  return { voucher: copyVoucher(next) }
}

export const setVoucherActive = (key, active) => {
  const index = vouchers.findIndex((v) => v.id === key || v.code === key)
  if (index === -1) return null
  vouchers = vouchers.map((v, i) => (i === index ? { ...v, active: Boolean(active) } : v))
  persistVouchers()
  return copyVoucher(vouchers[index])
}

export const deleteVoucher = (key) => {
  const before = vouchers.length
  vouchers = vouchers.filter((v) => v.id !== key && v.code !== key)
  if (vouchers.length === before) return false
  persistVouchers()
  return true
}

/** Mô tả ngắn để hiện ở giỏ/thanh toán và trong danh sách của admin. */
export const voucherLabel = (voucher) => {
  if (!voucher) return ''
  if (voucher.type === 'freeship') return 'Miễn phí giao hàng'
  if (voucher.type === 'percent') return `Giảm ${voucher.value}%`
  return `Giảm ${money(voucher.value)}`
}

export const revenueReport = ({ period = 'day', date = new Date() } = {}) => {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  if (Number.isNaN(d.getTime())) return { period, label: 'Không hợp lệ', revenue: 0, orders: 0, rows: [] }
  const completed = orders.filter((o) => o.status === 'completed')
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate()
  let rows = []
  let label = ''
  if (period === 'year') {
    label = `Năm ${y}`
    rows = Array.from({ length: 12 }, (_, i) => {
      const items = completed.filter((o) => { const x = new Date(o.createdAt); return x.getFullYear() === y && x.getMonth() === i })
      return { key: `${y}-${String(i+1).padStart(2,'0')}`, label: `Tháng ${i+1}`, revenue: items.reduce((s,o)=>s+Number(o.total||0),0), orders: items.length }
    })
  } else if (period === 'month') {
    const days = new Date(y, m + 1, 0).getDate()
    label = `Tháng ${String(m+1).padStart(2,'0')}/${y}`
    rows = Array.from({ length: days }, (_, i) => {
      const items = completed.filter((o) => { const x = new Date(o.createdAt); return x.getFullYear() === y && x.getMonth() === m && x.getDate() === i+1 })
      return { key: `${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`, label: `Ngày ${i+1}`, revenue: items.reduce((s,o)=>s+Number(o.total||0),0), orders: items.length }
    })
  } else {
    label = `${String(day).padStart(2,'0')}/${String(m+1).padStart(2,'0')}/${y}`
    const items = completed.filter((o) => { const x = new Date(o.createdAt); return x.getFullYear() === y && x.getMonth() === m && x.getDate() === day })
    rows = [{ key: label, label: 'Trong ngày', revenue: items.reduce((s,o)=>s+Number(o.total||0),0), orders: items.length }]
  }
  return { period, label, revenue: rows.reduce((s,r)=>s+r.revenue,0), orders: rows.reduce((s,r)=>s+r.orders,0), rows }
}

export const vendorStats = () => VENDORS.map((vendor) => {
  const ds = dishes.filter((d) => d.vendorId === vendor.id)
  const completed = orders.filter((o) => o.status === 'completed')
  const revenue = completed.reduce((sum, o) => sum + (o.items || []).filter((i) => i.vendorId === vendor.id).reduce((a,i)=>a + Number(i.price||0)*Number(i.qty||0), 0), 0)
  return { ...vendor, dishCount: ds.length, revenue, sold: ds.reduce((s,d)=>s+d.sold,0) }
})

export const stats = () => {
  const revenue = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.total, 0)
  const sold = dishes.reduce((sum, d) => sum + d.sold, 0)
  const top = [...dishes]
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5)
    .map((d) => ({ code: d.code, name: d.name, sold: d.sold, price: d.price }))
  /* Sắp hết = còn tối đa 5 phần; đã hết = về 0. Món không giới hạn không tính. */
  const lowStock = dishes.filter((d) => d.stock !== null && d.stock > 0 && d.stock <= 5)
  const statusCounts = Object.fromEntries(
    Object.keys(ORDER_STATUS).map((status) => [status, orders.filter((o) => o.status === status).length]),
  )
  const ingredientCount = new Set(
    dishes.flatMap((d) => Array.isArray(d.ingredients) ? d.ingredients : []),
  ).size
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayRevenue = orders
    .filter((o) => o.status === 'completed' && o.createdAt >= todayStart.getTime())
    .reduce((sum, o) => sum + o.total, 0)
  return {
    dishCount: dishes.length,
    orderCount: orders.length,
    pendingCount: orders.filter((o) => o.status === 'pending').length,
    revenue,
    todayRevenue,
    sold,
    top,
    statusCounts,
    ingredientCount,
    soldOutCount: dishes.filter(isSoldOut).length,
    lowStock: lowStock.map((d) => ({ code: d.code, name: d.name, stock: d.stock })),
    voucherCount: vouchers.length,
    /* Đang dùng được = còn bật, còn hạn và chưa hết lượt. */
    voucherLiveCount: vouchers.filter((v) => voucherIsLive(v)).length,
  }
}

export const menuByCategory = () =>
  CATEGORIES.map((cat) => ({
    ...cat,
    dishes: dishes.filter((d) => d.category === cat.id),
  }))

export const promotions = () => rawFoods.promotions ?? []