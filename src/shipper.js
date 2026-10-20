import './shipper.css'
import * as db from './store.js'
import * as auth from './auth.js'

/* Báo cho đoạn script dự phòng trong shipper.html biết module đã nạp thành công. */
window.__cbmShipperModuleReady = true

/* =========================================================================
 * TIỆN ÍCH CHUNG
 * ========================================================================= */

/** Chọn một phần tử theo selector. */
const $ = (selector) => document.querySelector(selector)

/** Chọn nhiều phần tử theo selector. */
const $$ = (selector) => Array.from(document.querySelectorAll(selector))

/** Escape chuỗi để chèn an toàn vào HTML. */
const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Định dạng số tiền theo kiểu Việt Nam. */
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

/** Đọc JSON từ localStorage, trả về giá trị mặc định nếu lỗi. */
const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/** Ghi JSON vào localStorage, bỏ qua lỗi dung lượng. */
const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Bỏ qua khi trình duyệt chặn localStorage. */
  }
}

/* =========================================================================
 * HẰNG SỐ CẤU HÌNH
 * ========================================================================= */

/** Toạ độ nhà hàng (điểm lấy món). */
const STORE_COORDS = [21.0285, 105.8542]

/** Khoá localStorage lưu tiến trình xử lý đơn của shipper. */
const TASK_KEY = 'cbmfood.shipper.tasks.v1'

/** Khoá localStorage lưu trạng thái online/offline. */
const ONLINE_KEY = 'cbmfood.shipper.online'

/** Khoá localStorage lưu lịch sử tin nhắn nhanh. */
const CHAT_KEY = 'cbmfood.shipper.chats.v1'

/** Danh sách lý do huỷ đơn / báo sự cố. */
const INCIDENT_REASONS = [
  'Khách không nghe máy',
  'Quán đóng cửa / chưa chuẩn bị xong',
  'Khách đổi ý / huỷ đơn',
  'Không liên hệ được quán',
  'Sự cố khác',
]

/**
 * Siêu dữ liệu cho từng bước trong vòng đời đơn hàng phía shipper.
 * `rank` càng lớn thì càng tiến xa trong quy trình.
 */
const STAGE_META = {
  new: { label: 'Chờ nhận', rank: 0, tone: 'warn' },
  accepted: { label: 'Đã nhận đơn', rank: 1, tone: 'info' },
  picked: { label: 'Đang giao', rank: 2, tone: 'info' },
  returned: { label: 'Đã hoàn hàng', rank: 3, tone: 'off' },
  done: { label: 'Hoàn thành', rank: 4, tone: 'ok' },
  cancelled: { label: 'Đã huỷ', rank: -1, tone: 'off' },
}

/* =========================================================================
 * TRẠNG THÁI ỨNG DỤNG
 * ========================================================================= */

let currentUser = null
let proofOrderCode = ''
let pickupOrderCode = ''
let cancelOrderCode = ''
let returnOrderCode = ''
let chatOrderCode = ''

let shipMap = null
let riderMarker = null
let storeMarker = null
let destMarker = null
let routeLine = null
let mapOrderMarkers = []

let online = readStore(ONLINE_KEY, true) !== false
let availabilitySynced = false
let knownAvailable = new Set()
let renderSignature = ''
let bannerTimer = null

/** Kỳ đang chọn trong tab Thu nhập. */
let incomePeriod = 'day'

let audioCtx = null
let audioUnlocked = false

/* =========================================================================
 * THAM CHIẾU DOM
 * ========================================================================= */

const gate = $('#shipper-gate')
const app = $('#shipper-app')
const login = $('#shipper-login')
const loginError = $('#shipper-login-error')
const register = $('#shipper-register')
const registerError = $('#shipper-register-error')
const registerSuccess = $('#shipper-register-success')
const availablePanel = $('#available-panel')
const activePanel = $('#active-panel')
const historyPanel = $('#history-panel')
const incomePanel = $('#income-panel')
const modal = $('#shipper-modal')

/* =========================================================================
 * THÔNG BÁO (TOAST / BANNER / ÂM THANH)
 * ========================================================================= */

/**
 * Hiển thị một thông báo nhỏ ở góc màn hình.
 * @param {string} message nội dung
 * @param {boolean} isError có phải lỗi hay không
 */
const toast = (message, isError = false) => {
  const node = document.createElement('div')
  node.className = `shipper-toast-msg${isError ? ' is-error' : ''}`
  node.textContent = message
  $('#shipper-toast').append(node)
  setTimeout(() => node.remove(), 3200)
}

/**
 * Hiển thị banner thông báo đơn mới ở đầu trang.
 * @param {string} text nội dung
 * @param {string} code mã đơn để điều hướng
 */
const showBanner = (text, code = '') => {
  const banner = $('#ship-banner')
  if (!banner) return
  banner.innerHTML = `
    <span class="ship-banner-text">${escape(text)}</span>
    ${code ? `<button type="button" data-action="banner-goto" data-code="${escape(code)}">Xem đơn</button>` : ''}
    <button type="button" class="ship-banner-close" data-action="banner-close" aria-label="Đóng thông báo">×</button>`
  banner.hidden = false
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => {
    banner.hidden = true
  }, 12000)
}

/** Mở khoá AudioContext sau tương tác đầu tiên của người dùng. */
const unlockAudio = () => {
  if (audioUnlocked) return
  audioUnlocked = true
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    /* Trình duyệt không hỗ trợ WebAudio. */
  }
}

/** Phát âm thanh "ting ting" khi có đơn hàng mới. */
const playTingTing = () => {
  try {
    unlockAudio()
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const notes = [880, 1174.66]
    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      const start = now + index * 0.18
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(start)
      osc.stop(start + 0.18)
    })
  } catch {
    /* Không có âm thanh cũng không sao. */
  }
}

/* =========================================================================
 * TIẾN TRÌNH ĐƠN HÀNG (LƯU LOCALSTORAGE)
 * ========================================================================= */

/** Đọc toàn bộ tiến trình đơn đã lưu. */
const readTasks = () => {
  const value = readStore(TASK_KEY, {})
  return value && typeof value === 'object' ? value : {}
}

/**
 * Lưu bước xử lý hiện tại của một đơn.
 * @param {string} code mã đơn
 * @param {string} stage bước xử lý
 * @param {object} extra dữ liệu kèm theo (lý do huỷ, ghi chú...)
 */
const setTask = (code, stage, extra = {}) => {
  const tasks = readTasks()
  tasks[code] = { stage, updatedAt: Date.now(), ...extra }
  writeStore(TASK_KEY, tasks)
}

/**
 * Suy ra bước xử lý từ trạng thái đơn trong kho dữ liệu.
 * @param {object} order đơn hàng
 */
const deriveStage = (order) => {
  if (order.returnInfo) return 'returned'
  if (order.status === 'completed') return 'done'
  if (order.status === 'cancelled') return 'cancelled'
  if (!order.shipper?.id) return 'new'
  if (order.status === 'delivering') return 'picked'
  if (order.status === 'confirmed') return 'accepted'
  return 'new'
}

/**
 * Bỏ bước "đến quán" cũ: dữ liệu localStorage từ phiên bản trước có thể còn
 * `at_store`, quy về `accepted` để không kẹt tiến trình.
 */
const normalizeStage = (stage) => (stage === 'at_store' ? 'accepted' : stage)

/**
 * Lấy bước xử lý hiện tại, ưu tiên bước tiến xa hơn giữa localStorage và kho.
 * @param {object} order đơn hàng
 */
const getStage = (order) => {
  const derived = deriveStage(order)
  if (derived === 'done' || derived === 'cancelled' || derived === 'returned') return derived
  const task = readTasks()[order.code]
  const taskStage = normalizeStage(task?.stage)
  const taskRank = STAGE_META[taskStage]?.rank ?? -1
  const derivedRank = STAGE_META[derived]?.rank ?? -1
  return taskRank > derivedRank ? taskStage : derived
}

/** Lấy nhãn hiển thị cho bước xử lý. */
const stageLabel = (stage) => STAGE_META[stage]?.label || stage

/* =========================================================================
 * THỐNG KÊ THU NHẬP
 * ========================================================================= */

/** Lấy thời điểm hoàn thành đơn (receivedAt hoặc mốc cuối trong history). */
const completedAt = (order) => {
  if (order.receivedAt) return Number(order.receivedAt)
  const history = Array.isArray(order.history) ? order.history : []
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.status === 'completed' && history[i]?.at) return Number(history[i].at)
  }
  return Number(order.createdAt || 0)
}

/** Mốc 00:00 của ngày hôm nay. */
const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Kiểm tra một mốc thời gian có nằm trong hôm nay không. */
const isToday = (timestamp) => Number(timestamp) >= startOfToday()

/**
 * Tính các chỉ số thu nhập từ danh sách đơn của shipper.
 * @param {Array} orders đơn của shipper
 */
const computeStats = (orders) => {
  const done = orders.filter((order) => order.status === 'completed')
  const returned = orders.filter((order) => order.returnInfo)
  const doneToday = done.filter((order) => isToday(completedAt(order)))
  const returnedToday = returned.filter((order) => isToday(Number(order.returnInfo.at || 0)))
  return {
    doneToday: doneToday.length,
    codToday: doneToday
      .filter((order) => order.paymentMethod === 'cod')
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
    earnToday:
      doneToday.reduce((sum, order) => sum + Number(order.shipping || 0), 0) +
      returnedToday.reduce((sum, order) => sum + Number(order.returnInfo.fee || 0), 0),
    earnTotal:
      done.reduce((sum, order) => sum + Number(order.shipping || 0), 0) +
      returned.reduce((sum, order) => sum + Number(order.returnInfo.fee || 0), 0),
  }
}

/* =========================================================================
 * BẢN ĐỒ LEAFLET
 * ========================================================================= */

/** Khởi tạo bản đồ, marker nhà hàng và vị trí shipper. */
const initMap = () => {
  const L = window.L
  if (shipMap || !L) return
  shipMap = L.map('shipper-map', { zoomControl: true }).setView(STORE_COORDS, 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(shipMap)

  const storeIcon = L.divIcon({ className: 'map-pin map-pin-store', html: '🍜', iconSize: [38, 38], iconAnchor: [19, 38] })
  storeMarker = L.marker(STORE_COORDS, { icon: storeIcon })
    .addTo(shipMap)
    .bindPopup('<b>CBM FOOD</b><br>Điểm lấy món')

  locateRider()
  setTimeout(() => shipMap?.invalidateSize(), 300)
}

/** Lấy vị trí hiện tại của shipper và cập nhật marker. */
const locateRider = () => {
  if (!shipMap || !navigator.geolocation) {
    toast('Trình duyệt không hỗ trợ định vị.', true)
    return
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const point = [position.coords.latitude, position.coords.longitude]
      const icon = window.L.divIcon({ className: 'map-pin map-pin-rider', html: '🛵', iconSize: [38, 38], iconAnchor: [19, 38] })
      if (riderMarker) riderMarker.setLatLng(point)
      else riderMarker = window.L.marker(point, { icon }).addTo(shipMap).bindPopup('<b>Vị trí của bạn</b>')
      shipMap.setView(point, 14)
    },
    () => toast('Không lấy được vị trí. Hãy bật quyền vị trí trên trình duyệt.', true),
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

/** Băm chuỗi thành số nguyên không âm. */
const hashString = (value) => {
  let hash = 0
  const text = String(value ?? '')
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

/**
 * Sinh toạ độ điểm giao (ước tính) ổn định cho một đơn.
 * Dùng mã đơn + địa chỉ để mỗi đơn luôn ra cùng một vị trí trên bản đồ.
 * @param {object} order đơn hàng
 */
const geoForOrder = (order) => {
  const hash = hashString(`${order.code}|${order.customer?.address || ''}`)
  const dLat = ((hash % 1000) / 1000 - 0.5) * 0.05
  const dLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.05
  return [STORE_COORDS[0] + dLat, STORE_COORDS[1] + dLng]
}

/** Khoảng cách đường chim bay (km) giữa hai toạ độ [lat, lng]. */
const haversineKm = ([lat1, lng1], [lat2, lng2]) => {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Khoảng cách chuyến hoàn hàng (quán ↔ điểm giao), làm tròn 1 chữ số thập phân. */
const returnDistanceKm = (order) => Math.round(haversineKm(STORE_COORDS, geoForOrder(order)) * 10) / 10

/** Phí hoàn hàng = 4.000đ × số km (làm tròn đồng). */
const returnFee = (order) => Math.round(returnDistanceKm(order) * (db.RETURN_FEE_PER_KM || 4000))

/** Tạo URL chỉ đường Google Maps tới điểm giao của đơn. */
const directionsUrl = (order) => {
  const [lat, lng] = geoForOrder(order)
  const origin = `${STORE_COORDS[0]},${STORE_COORDS[1]}`
  const destination = `${lat.toFixed(6)},${lng.toFixed(6)}`
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
}

/** Vẽ marker cho tất cả đơn đang có trên bản đồ. */
const updateMapOrders = (orders) => {
  if (!shipMap || !window.L) return
  mapOrderMarkers.forEach((marker) => marker.remove())
  mapOrderMarkers = []
  const L = window.L
  const icon = L.divIcon({ className: 'map-pin map-pin-order', html: '📦', iconSize: [36, 36], iconAnchor: [18, 36] })
  orders.forEach((order) => {
    const point = geoForOrder(order)
    const marker = L.marker(point, { icon })
      .addTo(shipMap)
      .bindPopup(`<b>${escape(order.code)}</b><br>${escape(order.customer?.address || 'Điểm giao hàng')}`)
    marker.on('click', () => openDetail(order.code))
    mapOrderMarkers.push(marker)
  })
}

/** Xoá đường chỉ dẫn đang vẽ. */
const clearRoute = () => {
  if (routeLine) {
    routeLine.remove()
    routeLine = null
  }
  if (destMarker) {
    destMarker.remove()
    destMarker = null
  }
}

/**
 * Vẽ đường đi từ nhà hàng tới điểm giao của đơn.
 * Ưu tiên route thật từ OSRM, nếu lỗi thì vẽ đường thẳng.
 * @param {object} order đơn hàng
 */
const drawRoute = async (order) => {
  if (!shipMap || !window.L) return
  const L = window.L
  const destination = geoForOrder(order)
  clearRoute()

  const icon = L.divIcon({ className: 'map-pin map-pin-order', html: '📍', iconSize: [36, 36], iconAnchor: [18, 36] })
  destMarker = L.marker(destination, { icon })
    .addTo(shipMap)
    .bindPopup(`<b>${escape(order.code)}</b><br>${escape(order.customer?.address || 'Điểm giao')}`)
    .openPopup()

  const fallback = () => {
    routeLine = L.polyline([STORE_COORDS, destination], {
      color: '#ef542f',
      weight: 5,
      opacity: 0.85,
      dashArray: '8 8',
    }).addTo(shipMap)
    shipMap.fitBounds(routeLine.getBounds(), { padding: [30, 30] })
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`
    const options = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(6000) } : {}
    const response = await fetch(url, options)
    if (!response.ok) throw new Error('route')
    const data = await response.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng])
    if (!coords?.length) throw new Error('empty')
    routeLine = L.polyline(coords, { color: '#ef542f', weight: 5, opacity: 0.9 }).addTo(shipMap)
    shipMap.fitBounds(routeLine.getBounds(), { padding: [30, 30] })
  } catch {
    fallback()
  }
}

/**
 * Đưa bản đồ tới đơn được chọn và vẽ đường đi.
 * @param {string} code mã đơn
 * @param {{scroll?: boolean}} options có cuộn tới bản đồ hay không
 */
const focusOrderOnMap = (code, { scroll = true } = {}) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  if (!shipMap) initMap()
  if (!shipMap) return
  drawRoute(order)
  if (scroll) document.querySelector('.ship-map-wrap')?.scrollIntoView({ behavior: 'auto', block: 'center' })
}

/* =========================================================================
 * HIỂN THỊ DANH SÁCH ĐƠN
 * ========================================================================= */

/** Nhãn phương thức thanh toán. */
const payLabel = (order) => {
  if (order.paymentMethod === 'cod') return 'Thu COD'
  if (order.paymentMethod === 'momo') return 'MoMo'
  return 'Chuyển khoản'
}

/** Tạo thanh tiến trình 3 bước cho một đơn (hoàn hàng thay cho bước giao). */
const timelineHtml = (stage) => {
  const returned = stage === 'returned'
  const steps = ['Nhận đơn', 'Lấy hàng', returned ? 'Hoàn hàng' : 'Giao xong']
  const current = STAGE_META[stage]?.rank ?? 0
  return `<ol class="ship-timeline">${steps
    .map((label, index) => {
      const done = index < current
      const active = index === current && current < steps.length
      return `<li class="ship-step${done ? ' is-done' : ''}${active ? ' is-current' : ''}">
        <span class="ship-step-dot">${done ? '✓' : index + 1}</span>
        <em>${label}</em>
      </li>`
    })
    .join('')}</ol>`
}

/** Tạo nhóm nút hành động theo bước xử lý hiện tại. */
const actionsHtml = (order, stage, mode) => {
  const code = escape(order.code)
  const detail = `<button type="button" class="ship-secondary" data-action="detail" data-code="${code}">Chi tiết</button>`
  const mapButton = `<button type="button" class="ship-secondary" data-action="show-map" data-code="${code}">Bản đồ</button>`
  const cancelButton = `<button type="button" class="ship-danger" data-action="cancel" data-code="${code}">Hủy / Sự cố</button>`

  if (mode === 'available') {
    return `<div class="ship-actions">${detail}${mapButton}
      <button type="button" class="ship-primary" data-action="claim" data-code="${code}">📦 Nhận đơn</button>
    </div>`
  }
  if (stage === 'accepted') {
    const requested = order.returnRequest?.status === 'requested'
    const returnButton = requested
      ? `<button type="button" class="ship-primary is-return" data-action="return" data-code="${code}">↩️ Hoàn hàng về quán</button>`
      : ''
    return `<div class="ship-actions">${detail}${mapButton}${cancelButton}${returnButton}
      <button type="button" class="ship-${requested ? 'secondary' : 'primary'}" data-action="pickup" data-code="${code}">📷 Đã lấy hàng</button>
    </div>`
  }
  if (stage === 'picked') {
    const returnButton = order.returnRequest?.status === 'requested'
      ? `<button type="button" class="ship-primary is-return" data-action="return" data-code="${code}">↩️ Hoàn hàng về quán</button>`
      : ''
    return `<div class="ship-actions">${detail}${mapButton}
      ${returnButton}
      <button type="button" class="ship-${order.returnRequest?.status === 'requested' ? 'secondary' : 'primary'}" data-action="deliver" data-code="${code}">✅ Xác nhận đã giao</button>
    </div>`
  }
  if (stage === 'returned') {
    const distance = order.returnInfo?.distanceKm ? `${order.returnInfo.distanceKm} km` : ''
    const fee = order.returnInfo?.fee ? `+${money(order.returnInfo.fee)}` : ''
    return `<div class="ship-actions">${detail}<span class="ship-returned">↩️ Đã hoàn hàng${distance ? ` · ${distance}` : ''}${fee ? ` · ${fee}` : ''}</span></div>`
  }
  if (stage === 'done') {
    return `<div class="ship-actions">${detail}${mapButton}<span class="ship-done">✓ Đã giao thành công</span></div>`
  }
  if (stage === 'cancelled') {
    return `<div class="ship-actions">${detail}<span class="ship-cancelled">✕ Đã huỷ</span></div>`
  }
  return `<div class="ship-actions">${detail}${mapButton}</div>`
}

/**
 * Tạo HTML cho một thẻ đơn hàng.
 * @param {object} order đơn hàng
 * @param {'available'|'active'|'history'} mode chế độ hiển thị
 */
const orderCard = (order, mode = 'active') => {
  const stage = getStage(order)
  const meta = STAGE_META[stage] || STAGE_META.new
  const code = escape(order.code)
  const phone = escape(order.customer?.phone || '')
  const address = escape(order.customer?.address || '')
  const items = (order.items || [])
    .map((item) => {
      const toppings = item.toppings?.length ? ` <i>+ ${item.toppings.map((t) => escape(t.name)).join(', ')}</i>` : ''
      return `<div class="ship-line"><span>${escape(item.name)} × ${item.qty}${toppings}</span><b>${money(item.price * item.qty)}</b></div>`
    })
    .join('')

  return `<article class="ship-order-card stage-${escape(stage)}" data-code="${code}">
    <div class="ship-order-head">
      <div><strong>#${code}</strong><small>${new Date(order.createdAt).toLocaleString('vi-VN')}</small></div>
      <span class="ship-status status-${escape(order.status)} tone-${escape(meta.tone)}">${escape(stageLabel(stage))}</span>
    </div>
    ${timelineHtml(stage)}
    <div class="ship-customer">
      <div class="ship-cust-head"><strong>${escape(order.customer?.name || 'Khách hàng')}</strong><span class="ship-pay-type">${payLabel(order)}</span></div>
      <div class="ship-contact">
        <a class="ship-chip" href="tel:${phone}" title="Gọi điện cho khách">📞 ${phone}</a>
        <button type="button" class="ship-chip" data-action="sms" data-code="${code}" title="Gửi SMS">💬 SMS</button>
        <button type="button" class="ship-chip" data-action="chat" data-code="${code}" title="Nhắn tin nhanh">✉️ Chat</button>
      </div>
      <p class="ship-addr">📍 ${address}
        <button type="button" class="ship-link" data-action="directions" data-code="${code}">Chỉ đường ↗</button>
      </p>
    </div>
    <div class="ship-lines">${items}</div>
    ${order.note ? `<p class="ship-note-line">📝 ${escape(order.note)}</p>` : ''}
    <div class="ship-total">
      <span>${order.paymentMethod === 'cod' ? '💵 Thu hộ (COD)' : `💳 ${payLabel(order)}`}</span>
      <b>${money(order.total)}</b>
    </div>
    <div class="ship-fee"><span>Phí ship của bạn</span><b>${money(order.shipping)}</b></div>
    ${order.pickupProof?.photo ? `<div class="ship-proof"><img src="${escape(order.pickupProof.photo)}" alt="Ảnh lấy hàng" /><span>Đã có ảnh lấy hàng</span></div>` : ''}
    ${order.deliveryProof?.photo ? `<div class="ship-proof"><img src="${escape(order.deliveryProof.photo)}" alt="Ảnh giao hàng" /><span>Đã có ảnh giao hàng</span></div>` : ''}
    ${order.returnRequest?.status === 'requested' ? `<div class="ship-return-req">↩️ Khách yêu cầu hoàn hàng · Lý do: ${escape(order.returnRequest.reason || '')}</div>` : ''}
    ${order.returnInfo ? `<div class="ship-return-info">↩️ Đã hoàn hàng · Lý do: ${escape(order.returnInfo.reason || '')}${order.returnInfo.distanceKm ? ` · ${order.returnInfo.distanceKm} km` : ''}${order.returnInfo.fee ? ` · Phí ${money(order.returnInfo.fee)}` : ''}</div>` : ''}
    ${actionsHtml(order, stage, mode)}
  </article>`
}

/** Tạo khối trạng thái rỗng. */
const emptyHtml = (icon, text) => `<div class="empty-ship"><span>${icon}</span><p>${escape(text)}</p></div>`

/** Cập nhật số liệu nhanh trên dashboard. */
const renderStats = (available, active, mine) => {
  const stats = computeStats(mine)
  $('#available-count').textContent = available.length
  $('#active-count').textContent = active.length
  $('#done-count').textContent = stats.doneToday
  $('#earn-count').textContent = money(stats.earnToday)
  $('#cod-count').textContent = money(stats.codToday)
  $('#total-earn-count').textContent = money(stats.earnTotal)
}

/* =========================================================================
 * THỐNG KÊ THU NHẬP (TAB "THU NHẬP")
 * ========================================================================= */

const DAY_MS = 86400000

const INCOME_PERIODS = [
  ['day', 'Hôm nay'],
  ['week', '7 ngày'],
  ['month', 'Tháng này'],
  ['all', 'Tất cả'],
]

const INCOME_PERIOD_LABEL = {
  day: 'Hôm nay',
  week: '7 ngày gần nhất',
  month: 'Tháng này',
  all: 'Tất cả thời gian',
}

/** Mốc thời gian ghi nhận thu nhập: hoàn hàng dùng `returnInfo.at`, còn lại là lúc hoàn thành. */
const incomeStamp = (order) => (order.returnInfo ? Number(order.returnInfo.at || 0) : completedAt(order))

/** Khoản shipper thực nhận cho một đơn: phí hoàn hàng hoặc phí ship. */
const orderIncome = (order) => (order.returnInfo ? Number(order.returnInfo.fee || 0) : Number(order.shipping || 0))

/** Cộng dồn phí ship, phí hoàn hàng, COD và giá trị đơn cho một nhóm đơn. */
const sumIncome = (list) =>
  list.reduce(
    (acc, order) => {
      acc.orders += 1
      acc.fee += orderIncome(order)
      if (order.returnInfo) {
        acc.returned += 1
        acc.returnFee += orderIncome(order)
      } else if (order.paymentMethod === 'cod') {
        acc.cod += Number(order.total || 0)
      }
      acc.value += Number(order.total || 0)
      return acc
    },
    { orders: 0, fee: 0, cod: 0, value: 0, returned: 0, returnFee: 0 },
  )

/** Tính thu nhập theo kỳ và chuỗi 7 ngày gần nhất (gồm đơn hoàn hàng). */
const incomeData = (mine) => {
  const settled = mine.filter((order) => order.status === 'completed' || order.returnInfo)
  const todayStart = startOfToday()
  const weekStart = todayStart - 6 * DAY_MS
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const periods = {
    day: sumIncome(settled.filter((order) => incomeStamp(order) >= todayStart)),
    week: sumIncome(settled.filter((order) => incomeStamp(order) >= weekStart)),
    month: sumIncome(settled.filter((order) => incomeStamp(order) >= monthStart)),
    all: sumIncome(settled),
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = todayStart - (6 - index) * DAY_MS
    const end = start + DAY_MS
    const items = settled.filter((order) => {
      const at = incomeStamp(order)
      return at >= start && at < end
    })
    return {
      start,
      label: new Date(start).toLocaleDateString('vi-VN', { weekday: 'short' }),
      orders: items.length,
      fee: items.reduce((sum, order) => sum + orderIncome(order), 0),
    }
  })
  const recent = [...settled].sort((a, b) => incomeStamp(b) - incomeStamp(a)).slice(0, 15)
  return { periods, days, settled, recent }
}

/** Dựng HTML cho tab Thu nhập. */
const incomeHtml = (mine) => {
  const { periods, days, recent } = incomeData(mine)
  const current = periods[incomePeriod] || periods.day
  const maxFee = Math.max(1, ...days.map((day) => day.fee))
  const best = recent.reduce((top, order) => Math.max(top, orderIncome(order)), 0)

  return `
    <div class="income-card">
      <div class="income-card-head">
        <div class="income-total">
          <small>Thu nhập · ${escape(INCOME_PERIOD_LABEL[incomePeriod] || '')}</small>
          <b>${money(current.fee)}</b>
        </div>
        <div class="income-periods">
          ${INCOME_PERIODS.map(
            ([id, label]) =>
              `<button type="button" data-action="income-period" data-period="${id}" class="${incomePeriod === id ? 'is-active' : ''}">${label}</button>`,
          ).join('')}
        </div>
      </div>
      <div class="income-grid">
        <article><span>Đơn hoàn thành</span><b>${current.orders - current.returned}</b></article>
        <article><span>Đơn hoàn hàng</span><b>${current.returned}</b></article>
        <article><span>Phí hoàn hàng</span><b>${money(current.returnFee)}</b></article>
        <article><span>Thu nhập TB/đơn</span><b>${money(current.orders ? Math.round(current.fee / current.orders) : 0)}</b></article>
      </div>
      <div class="income-cod">
        <span>💵 COD đã thu hôm nay (cần nộp lại)</span><b>${money(periods.day.cod)}</b>
      </div>
    </div>

    <div class="income-card">
      <h3>Thu nhập 7 ngày gần nhất</h3>
      <div class="income-bars">
        ${days
          .map(
            (day) => `<div class="income-bar" title="${day.orders} đơn · ${money(day.fee)}">
              <span class="income-bar-value">${day.fee ? money(day.fee) : ''}</span>
              <div class="income-bar-track"><i style="height:${Math.max(6, Math.round((day.fee / maxFee) * 100))}%"></i></div>
              <em>${escape(day.label)}</em>
            </div>`,
          )
          .join('')}
      </div>
      <p class="income-note">Tổng 7 ngày: <b>${money(days.reduce((sum, day) => sum + day.fee, 0))}</b> · Đơn cao nhất: <b>${money(best)}</b></p>
    </div>

    <div class="income-card">
      <h3>Đơn đã xử lý <span>(${recent.length})</span></h3>
      ${
        recent.length
          ? `<div class="income-orders">${recent
              .map(
                (order) => `<div class="income-order-row${order.returnInfo ? ' is-returned' : ''}">
                  <div><b>#${escape(order.code)}</b><small>${new Date(incomeStamp(order)).toLocaleString('vi-VN')}</small></div>
                  <span class="income-order-pay">${order.returnInfo ? '↩️ Hoàn hàng' : escape(payLabel(order))}</span>
                  <b class="income-order-fee">+${money(orderIncome(order))}</b>
                </div>`,
              )
              .join('')}</div>`
          : '<p class="income-empty">Chưa có đơn nào đã xử lý.</p>'
      }
    </div>`
}

/** Vẽ lại tab Thu nhập theo dữ liệu mới nhất. */
const renderIncome = () => {
  if (!incomePanel || !currentUser) return
  incomePanel.innerHTML = incomeHtml(db.listOrdersForShipper(currentUser.id))
}

/** Cập nhật trạng thái online/offline trên giao diện. */
const renderOnlineState = () => {
  const toggle = $('#ship-online-toggle')
  const state = $('#ship-online-state')
  const dot = $('#ship-online-dot')
  if (toggle) {
    toggle.textContent = online ? '🟢 Đang nhận đơn' : '⚪ Tạm nghỉ'
    toggle.classList.toggle('is-offline', !online)
  }
  if (state) state.textContent = online ? 'Đang online' : 'Đang offline'
  if (dot) dot.classList.toggle('is-offline', !online)
}

/** Phát hiện đơn mới và phát thông báo. */
const detectNewOrders = (available) => {
  if (!online) return
  const codes = new Set(available.map((order) => order.code))
  if (!availabilitySynced) {
    knownAvailable = codes
    availabilitySynced = true
    return
  }
  const fresh = [...codes].filter((code) => !knownAvailable.has(code))
  knownAvailable = codes
  if (!fresh.length) return
  playTingTing()
  if (fresh.length === 1) {
    const order = available.find((item) => item.code === fresh[0])
    showBanner(`🔔 Đơn mới ${fresh[0]} • ${order?.customer?.address || 'có địa chỉ giao'}`, fresh[0])
  } else {
    showBanner(`🔔 Có ${fresh.length} đơn hàng mới đang chờ bạn`, fresh[0])
  }
}

/**
 * Tạo "chữ ký" dữ liệu để biết giao diện có cần vẽ lại hay không.
 * Tránh dựng lại DOM mỗi 1,5 giây khiến nút bị thay giữa lúc người dùng bấm.
 */
const buildSignature = (available, mine) =>
  JSON.stringify({
    online,
    available: available.map((order) => order.code),
    mine: mine.map((order) => [
      order.code,
      order.status,
      order.shipper?.id || '',
      getStage(order),
      order.pickupProof?.at || 0,
      order.deliveryProof?.at || 0,
      order.returnInfo?.at || 0,
      order.returnRequest?.status || '',
      order.receivedAt || 0,
    ]),
  })

/** Vẽ lại giao diện theo dữ liệu mới nhất (chỉ dựng lại DOM khi dữ liệu đổi). */
const render = () => {
  if (!currentUser) return
  const available = online ? db.listAvailableShipOrders() : []
  const mine = db.listOrdersForShipper(currentUser.id)
  const active = mine.filter((order) => ['confirmed', 'delivering'].includes(order.status))
  const history = mine.filter((order) => ['completed', 'cancelled'].includes(order.status))
  const signature = buildSignature(available, mine)

  if (signature !== renderSignature) {
    renderSignature = signature

    availablePanel.innerHTML = !online
      ? emptyHtml('😴', 'Bạn đang offline. Bật "Đang nhận đơn" để xem đơn mới.')
      : available.length
        ? available.map((order) => orderCard(order, 'available')).join('')
        : emptyHtml('🎉', 'Hiện chưa có đơn mới để nhận.')

    activePanel.innerHTML = active.length
      ? active.map((order) => orderCard(order, 'active')).join('')
      : emptyHtml('🛵', 'Bạn chưa có đơn nào đang thực hiện.')

    historyPanel.innerHTML = history.length
      ? history.map((order) => orderCard(order, 'history')).join('')
      : emptyHtml('📭', 'Chưa có đơn nào đã hoàn thành hoặc huỷ.')

    updateMapOrders(available.concat(active))
    renderIncome()
  }

  renderStats(available, active, mine)
  renderOnlineState()
  detectNewOrders(available)
}

/* =========================================================================
 * MODAL
 * ========================================================================= */

/** Đóng modal đang mở. */
const closeModal = () => {
  modal.innerHTML = ''
  proofOrderCode = ''
  pickupOrderCode = ''
  cancelOrderCode = ''
  returnOrderCode = ''
  chatOrderCode = ''
}

/** Mở modal chi tiết đơn hàng. */
const openDetail = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  const stage = getStage(order)
  const phone = escape(order.customer?.phone || '')
  modal.innerHTML = `<div class="ship-modal-backdrop">
    <div class="ship-modal" role="dialog" aria-modal="true">
      <header><h2>Đơn #${escape(order.code)}</h2><button type="button" data-action="close" aria-label="Đóng">×</button></header>
      <div class="ship-detail">
        <div class="ship-detail-status"><span class="ship-status status-${escape(order.status)}">${escape(stageLabel(stage))}</span></div>
        ${timelineHtml(stage)}
        <section>
          <h3>Khách hàng</h3>
          <p><b>${escape(order.customer?.name || '')}</b></p>
          <p>☎ ${phone}</p>
          <p>📍 ${escape(order.customer?.address || '')}</p>
          <div class="ship-detail-actions">
            <a class="ship-chip" href="tel:${phone}">📞 Gọi khách</a>
            <button type="button" class="ship-chip" data-action="sms" data-code="${escape(order.code)}">💬 SMS</button>
            <button type="button" class="ship-chip" data-action="chat" data-code="${escape(order.code)}">✉️ Chat</button>
            <button type="button" class="ship-chip" data-action="directions" data-code="${escape(order.code)}">🧭 Chỉ đường</button>
          </div>
        </section>
        <section>
          <h3>Món hàng</h3>
          ${(order.items || []).map((item) => `<p>${escape(item.name)} × ${item.qty} — <b>${money(item.price * item.qty)}</b></p>`).join('')}
        </section>
        <section>
          <h3>Thanh toán</h3>
          <p>${payLabel(order)}${order.paymentStatus === 'paid' ? ' · Đã thanh toán' : ''}</p>
          <p>Tổng: <b>${money(order.total)}</b></p>
          <p>Phí ship: ${money(order.shipping)}</p>
        </section>
        ${order.deliveryProof?.photo ? `<section><h3>Ảnh giao hàng</h3><img class="ship-detail-proof" src="${escape(order.deliveryProof.photo)}" alt="Ảnh giao hàng" /></section>` : ''}
      </div>
      <footer><button type="button" class="ship-primary" data-action="close">Đóng</button></footer>
    </div>
  </div>`
}

/** Mở modal chụp ảnh xác nhận đã lấy hàng tại quán (ảnh bắt buộc). */
const openPickup = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  pickupOrderCode = code
  modal.innerHTML = `<div class="ship-modal-backdrop">
    <div class="ship-modal" role="dialog" aria-modal="true">
      <header><h2>Chụp ảnh đã lấy hàng</h2><button type="button" data-action="close" aria-label="Đóng">×</button></header>
      <form id="pickup-form">
        <p class="ship-note">Đơn <b>#${escape(order.code)}</b>. Chụp ảnh món hàng đã nhận tại quán rồi mới bắt đầu giao.</p>
        <label><span>Ảnh đã lấy hàng *</span><input name="photo" type="file" accept="image/*" capture="environment" required /></label>
        <div class="proof-preview" id="ship-pickup-preview"><span>Bắt buộc chụp ảnh đã lấy hàng</span></div>
        <label><span>Ghi chú</span><textarea name="note" placeholder="Ví dụ: Đã nhận đủ món, quán giao đúng đơn."></textarea></label>
        <footer>
          <button type="button" class="ship-secondary" data-action="close">Huỷ</button>
          <button type="submit" class="ship-primary">✓ Xác nhận đã lấy hàng</button>
        </footer>
      </form>
    </div>
  </div>`
}

/** Mở modal hoàn hàng: hiển thị lý do khách yêu cầu, số km và phí 4.000đ/km. */
const openReturn = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  returnOrderCode = code
  const km = returnDistanceKm(order)
  const fee = returnFee(order)
  modal.innerHTML = `<div class="ship-modal-backdrop">
    <div class="ship-modal" role="dialog" aria-modal="true">
      <header><h2>Hoàn hàng về quán</h2><button type="button" data-action="close" aria-label="Đóng">×</button></header>
      <form id="return-form">
        <p class="ship-note">Đơn <b>#${escape(order.code)}</b>. Khách yêu cầu hoàn hàng — mang hàng về quán.</p>
        <div class="return-fee-line"><span>Lý do khách chọn</span><b>${escape(order.returnRequest?.reason || 'Không rõ')}</b></div>
        ${order.returnRequest?.note ? `<p class="ship-note">Ghi chú khách: ${escape(order.returnRequest.note)}</p>` : ''}
        <div class="return-fee-line"><span>Quãng đường hoàn</span><b>${km} km</b></div>
        <div class="return-fee-line is-total"><span>Phí hoàn (${money(db.RETURN_FEE_PER_KM || 4000)}/km)</span><b>${money(fee)}</b></div>
        <label><span>Ảnh hoàn hàng (khuyến khích)</span><input name="photo" type="file" accept="image/*" capture="environment" /></label>
        <div class="proof-preview" id="ship-return-preview"><span>Chưa chọn ảnh</span></div>
        <label><span>Ghi chú của shipper</span><textarea name="note" placeholder="Ví dụ: Đã trả hàng cho quán, quán xác nhận đủ món."></textarea></label>
        <footer>
          <button type="button" class="ship-secondary" data-action="close">Huỷ</button>
          <button type="submit" class="ship-primary">↩️ Xác nhận đã hoàn hàng</button>
        </footer>
      </form>
    </div>
  </div>`
}

/** Mở modal xác nhận đã giao hàng (cho phép đính kèm ảnh). */
const openProof = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  proofOrderCode = code
  modal.innerHTML = `<div class="ship-modal-backdrop">
    <div class="ship-modal" role="dialog" aria-modal="true">
      <header><h2>Xác nhận đã giao</h2><button type="button" data-action="close" aria-label="Đóng">×</button></header>
      <form id="proof-form">
        <p class="ship-note">Đơn <b>#${escape(order.code)}</b> · ${money(order.total)} · ${payLabel(order)}</p>
        <label><span>Ảnh giao hàng (khuyến khích)</span><input name="photo" type="file" accept="image/*" capture="environment" /></label>
        <div class="proof-preview" id="ship-proof-preview"><span>Chưa chọn ảnh</span></div>
        <label><span>Ghi chú</span><textarea name="note" placeholder="Ví dụ: Đã giao đủ món, khách đã thanh toán COD."></textarea></label>
        <footer>
          <button type="button" class="ship-secondary" data-action="close">Huỷ</button>
          <button type="submit" class="ship-primary">✓ Xác nhận đã giao</button>
        </footer>
      </form>
    </div>
  </div>`
}

/** Mở modal huỷ đơn / báo sự cố với danh sách lý do. */
const openCancel = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  cancelOrderCode = code
  modal.innerHTML = `<div class="ship-modal-backdrop">
    <div class="ship-modal" role="dialog" aria-modal="true">
      <header><h2>Huỷ đơn / Báo sự cố</h2><button type="button" data-action="close" aria-label="Đóng">×</button></header>
      <form id="cancel-form">
        <p class="ship-note">Đơn <b>#${escape(order.code)}</b>. Vui lòng chọn lý do để báo về nhà hàng.</p>
        <div class="cancel-reasons">
          ${INCIDENT_REASONS.map(
            (reason, index) => `<label class="reason-opt">
              <input type="radio" name="reason" value="${escape(reason)}" ${index === 0 ? 'checked' : ''} />
              <span>${escape(reason)}</span>
            </label>`,
          ).join('')}
        </div>
        <label><span>Ghi chú thêm</span><textarea name="note" placeholder="Mô tả chi tiết sự cố (không bắt buộc)"></textarea></label>
        <footer>
          <button type="button" class="ship-secondary" data-action="close">Đóng</button>
          <button type="submit" class="ship-danger">Xác nhận huỷ</button>
        </footer>
      </form>
    </div>
  </div>`
}

/** Mở hộp thoại nhắn tin nhanh cho khách. */
const openChat = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  chatOrderCode = code
  const presets = [
    'Chào anh/chị, tôi là shipper CBM FOOD, đang trên đường giao đơn.',
    'Tôi đã đến điểm giao, anh/chị vui lòng ra nhận hàng giúp tôi.',
    'Anh/chị cho tôi xin số phòng/tầng để giao hàng nhanh hơn.',
  ]
  modal.innerHTML = `<div class="ship-modal-backdrop">
    <div class="ship-modal" role="dialog" aria-modal="true">
      <header><h2>Nhắn tin cho khách</h2><button type="button" data-action="close" aria-label="Đóng">×</button></header>
      <form id="chat-form">
        <p class="ship-note">Gửi tới <b>${escape(order.customer?.name || '')}</b> · ${escape(order.customer?.phone || '')}</p>
        <div class="chat-presets">
          ${presets.map((text) => `<button type="button" class="chat-preset" data-preset="${escape(text)}">${escape(text)}</button>`).join('')}
        </div>
        <label><span>Nội dung tin nhắn</span><textarea name="message" rows="3" placeholder="Nhập tin nhắn..."></textarea></label>
        <footer>
          <button type="button" class="ship-secondary" data-action="close">Đóng</button>
          <button type="button" class="ship-secondary" data-action="send-sms" data-code="${escape(order.code)}">💬 Gửi SMS</button>
          <button type="submit" class="ship-primary">Gửi tin nhắn</button>
        </footer>
      </form>
    </div>
  </div>`
}

/** Lưu tin nhắn nhanh vào localStorage (giả lập lịch sử chat). */
const saveChatMessage = (code, text) => {
  const all = readStore(CHAT_KEY, {})
  const list = Array.isArray(all[code]) ? all[code] : []
  list.push({ at: Date.now(), text })
  all[code] = list.slice(-50)
  writeStore(CHAT_KEY, all)
}

/* =========================================================================
 * HÀNH ĐỘNG ĐƠN HÀNG
 * ========================================================================= */

/** Nhận một đơn mới. */
const claim = (code) => {
  const result = db.claimOrder(code, currentUser)
  if (result.error) return toast(result.error, true)
  setTask(result.order.code, 'accepted')
  toast(`Đã nhận đơn ${result.order.code}`)
  focusOrderOnMap(result.order.code, { scroll: false })
  render()
  switchTab('active')
}

/** Lưu ảnh lấy hàng rồi chuyển đơn sang "Đang giao". */
const pickedUp = (code, { photo = '', note = '' } = {}) => {
  const order = db.findOrder(code)
  if (!order || order.shipper?.id !== currentUser.id) return toast('Đơn không thuộc về bạn', true)
  const saved = db.saveOrderPickupProof(code, {
    shipperId: currentUser.id,
    shipperName: currentUser.name,
    photo,
    note,
  })
  if (!saved) return toast('Không lưu được ảnh lấy hàng', true)
  const updated = db.updateOrderStatus(code, 'delivering')
  if (!updated) return toast('Không thể chuyển sang đang giao', true)
  setTask(code, 'picked', { pickupAt: Date.now() })
  toast('Đã lấy hàng — bắt đầu giao')
  render()
}

/** Shipper xác nhận mang hàng về quán và cộng phí 4.000đ/km vào thu nhập. */
const returnToStore = (code, { photo = '', note = '' } = {}) => {
  const order = db.findOrder(code)
  if (!order || order.shipper?.id !== currentUser.id) return toast('Đơn không thuộc về bạn', true)
  const km = returnDistanceKm(order)
  const fee = returnFee(order)
  const saved = db.saveOrderReturn(code, {
    shipperId: currentUser.id,
    shipperName: currentUser.name,
    photo,
    note,
    distanceKm: km,
    fee,
  })
  if (!saved) return toast('Không lưu được thông tin hoàn hàng', true)
  setTask(code, 'returned', { returnAt: Date.now(), reason: order.returnRequest?.reason || '', fee })
  toast(`Đã hoàn hàng ${code} · ${km} km · +${money(fee)}`)
  render()
}

/** Huỷ đơn kèm lý do sự cố. Không cho huỷ sau khi đã lấy hàng. */
const cancelByShipper = (code, { reason, note }) => {
  const order = db.findOrder(code)
  if (!order || order.shipper?.id !== currentUser.id) return toast('Đơn không thuộc về bạn', true)
  if (getStage(order) === 'picked') return toast('Đã lấy hàng thì không thể huỷ đơn', true)
  const updated = db.updateOrderStatus(code, 'cancelled')
  if (!updated) return toast('Không thể huỷ đơn', true)
  setTask(code, 'cancelled', { reason, note })
  toast(`Đã huỷ đơn ${code}: ${reason}`)
  render()
}

/** Mở Google Maps chỉ đường tới khách. */
const openDirections = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  window.open(directionsUrl(order), '_blank', 'noopener')
}

/** Mở ứng dụng SMS với nội dung soạn sẵn. */
const sendSms = (code, message) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  const phone = String(order.customer?.phone || '').replace(/\s+/g, '')
  if (!phone) return toast('Đơn không có số điện thoại', true)
  const body = message || `Chào ${order.customer?.name || 'anh/chị'}, tôi là shipper CBM FOOD đang giao đơn ${order.code}.`
  window.location.href = `sms:${phone}?body=${encodeURIComponent(body)}`
}

/** Bật/tắt trạng thái nhận đơn. */
const toggleOnline = () => {
  online = !online
  writeStore(ONLINE_KEY, online)
  availabilitySynced = false
  toast(online ? 'Bạn đã online và có thể nhận đơn.' : 'Bạn đã tạm nghỉ, sẽ không nhận đơn mới.')
  render()
}

/* =========================================================================
 * SỰ KIỆN CLICK (UỶ QUYỀN)
 * ========================================================================= */

document.addEventListener('click', (event) => {
  /* Bấm ra ngoài modal thì đóng. */
  if (event.target.classList?.contains('ship-modal-backdrop')) {
    closeModal()
    return
  }

  /* Nút chọn nhanh nội dung chat. */
  const preset = event.target.closest('.chat-preset')
  if (preset) {
    const textarea = modal.querySelector('#chat-form textarea[name="message"]')
    if (textarea) textarea.value = preset.dataset.preset || ''
    return
  }

  const target = event.target.closest('[data-action]')
  if (!target) return
  const action = target.dataset.action
  const code = target.dataset.code || ''

  if (action === 'close' || action === 'banner-close') {
    if (action === 'banner-close') $('#ship-banner').hidden = true
    else closeModal()
    return
  }
  if (action === 'banner-goto') {
    switchTab('available')
    if (code) focusOrderOnMap(code)
    $('#ship-banner').hidden = true
    return
  }
  if (action === 'detail') return openDetail(code)
  if (action === 'show-map') return focusOrderOnMap(code)
  if (action === 'directions') return openDirections(code)
  if (action === 'sms') return sendSms(code)
  if (action === 'chat') return openChat(code)
  if (action === 'claim') return claim(code)
  if (action === 'pickup') return openPickup(code)
  if (action === 'deliver') return openProof(code)
  if (action === 'return') return openReturn(code)
  if (action === 'cancel') return openCancel(code)
  if (action === 'income-period') {
    incomePeriod = target.dataset.period || 'day'
    renderIncome()
    return
  }
  if (action === 'send-sms') {
    const textarea = modal.querySelector('#chat-form textarea[name="message"]')
    return sendSms(code, textarea?.value?.trim())
  }
})

/* =========================================================================
 * SỰ KIỆN FORM TRONG MODAL
 * ========================================================================= */

/** Cập nhật ảnh xem trước khi chọn ảnh (lấy hàng hoặc giao hàng). */
modal.addEventListener('change', (event) => {
  if (event.target.name !== 'photo') return
  const file = event.target.files?.[0]
  const preview = event.target.closest('form')?.querySelector('.proof-preview')
  if (!file || !preview) return
  if (!file.type.startsWith('image/')) return toast('Vui lòng chọn file ảnh', true)
  preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Ảnh xem trước" />`
})

/** Nén ảnh giao hàng trước khi lưu vào localStorage. */
const compressPhoto = (file, maxSide = 1400, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image'))
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })

/** Xử lý submit các form trong modal (xác nhận giao / huỷ đơn / chat). */
modal.addEventListener('submit', async (event) => {
  const form = event.target

  /* ---------- Xác nhận đã lấy hàng (ảnh bắt buộc) ---------- */
  if (form.id === 'pickup-form') {
    event.preventDefault()
    const code = pickupOrderCode
    if (!code) return toast('Không xác định được đơn', true)
    const data = new FormData(form)
    const file = data.get('photo')
    if (!(file instanceof File) || !file.size) return toast('Bắt buộc chụp ảnh đã lấy hàng', true)
    try {
      if (file.size > 12 * 1024 * 1024) return toast('Ảnh lấy hàng tối đa 12MB', true)
      const photo = await compressPhoto(file)
      pickedUp(code, { photo, note: String(data.get('note') || '') })
      closeModal()
    } catch {
      toast('Không xử lý được ảnh lấy hàng', true)
    }
    return
  }

  /* ---------- Xác nhận hoàn hàng về quán ---------- */
  if (form.id === 'return-form') {
    event.preventDefault()
    const code = returnOrderCode
    if (!code) return toast('Không xác định được đơn', true)
    const data = new FormData(form)
    const file = data.get('photo')
    let photo = ''
    try {
      if (file instanceof File && file.size) {
        if (file.size > 8 * 1024 * 1024) return toast('Ảnh hoàn hàng tối đa 8MB', true)
        photo = await compressPhoto(file)
      }
      returnToStore(code, { photo, note: String(data.get('note') || '') })
      closeModal()
    } catch {
      toast('Không xử lý được ảnh hoàn hàng', true)
    }
    return
  }

  /* ---------- Xác nhận đã giao ---------- */
  if (form.id === 'proof-form') {
    event.preventDefault()
    const code = proofOrderCode
    if (!code) return toast('Không xác định được đơn giao', true)
    const data = new FormData(form)
    const file = data.get('photo')
    let photo = ''
    try {
      if (file instanceof File && file.size) {
        if (file.size > 8 * 1024 * 1024) return toast('Ảnh giao hàng tối đa 8MB', true)
        photo = await compressPhoto(file)
      }
      db.saveOrderDeliveryProof(code, {
        shipperId: currentUser.id,
        shipperName: currentUser.name,
        shipperPhone: currentUser.phone || '',
        shipperEmail: currentUser.email || '',
        photo,
        note: String(data.get('note') || ''),
      })
      const updated = db.updateOrderStatus(code, 'completed')
      if (!updated) return toast('Không cập nhật được trạng thái đơn', true)
      setTask(code, 'done')
      toast(`Đã giao thành công ${updated.code}`)
      playTingTing()
      closeModal()
      render()
    } catch {
      toast('Không xử lý được ảnh giao hàng', true)
    }
    return
  }

  /* ---------- Huỷ đơn / báo sự cố ---------- */
  if (form.id === 'cancel-form') {
    event.preventDefault()
    const code = cancelOrderCode
    if (!code) return toast('Không xác định được đơn', true)
    const data = new FormData(form)
    const reason = String(data.get('reason') || '').trim() || INCIDENT_REASONS[0]
    const note = String(data.get('note') || '').trim()
    cancelByShipper(code, { reason, note })
    closeModal()
    return
  }

  /* ---------- Gửi tin nhắn nhanh ---------- */
  if (form.id === 'chat-form') {
    event.preventDefault()
    const code = chatOrderCode
    if (!code) return toast('Không xác định được đơn', true)
    const message = String(new FormData(form).get('message') || '').trim()
    if (!message) return toast('Vui lòng nhập nội dung tin nhắn', true)
    saveChatMessage(code, message)
    toast('Đã gửi tin nhắn cho khách')
    closeModal()
  }
})

/* =========================================================================
 * TAB & ĐIỀU HƯỚNG
 * ========================================================================= */

/** Chuyển giữa các tab đơn hàng. */
const switchTab = (tab) => {
  $$('.shipper-tabs button').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab))
  availablePanel.hidden = tab !== 'available'
  activePanel.hidden = tab !== 'active'
  historyPanel.hidden = tab !== 'history'
  incomePanel.hidden = tab !== 'income'
  if (tab === 'income') renderIncome()
  $('.shipper-tabs')?.scrollIntoView({ behavior: 'auto', block: 'start' })
}

$$('.shipper-tabs button').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab))
})

$$('[data-quick-tab]').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.quickTab))
})

/* =========================================================================
 * ĐIỀU KHIỂN ONLINE / BẢN ĐỒ
 * ========================================================================= */

$('#ship-online-toggle')?.addEventListener('click', toggleOnline)
$('#ship-my-location')?.addEventListener('click', () => locateRider())

/* Mở khoá âm thanh ở lần chạm/click đầu tiên (chính sách autoplay của trình duyệt). */
document.addEventListener('pointerdown', unlockAudio, { once: true })

/* =========================================================================
 * ĐĂNG NHẬP / ĐĂNG KÝ
 * ========================================================================= */

/** Hiển thị ứng dụng sau khi đăng nhập thành công. */
const showApp = (user) => {
  currentUser = user
  $('#shipper-name').textContent = user.name
  $('#shipper-phone').textContent = user.phone || user.email
  $('#shipper-avatar').textContent = String(user.name || 'S').charAt(0).toUpperCase()
  $('#shipper-welcome-name').textContent = user.name
  gate.hidden = true
  gate.style.display = 'none'
  app.hidden = false
  app.style.display = 'block'
  availabilitySynced = false
  renderSignature = ''
  renderOnlineState()
  initMap()
  render()
}

/** Quay lại cổng đăng nhập. */
const showGate = () => {
  currentUser = null
  app.hidden = true
  app.style.display = 'none'
  gate.hidden = false
  gate.style.display = 'grid'
  loginError.hidden = true
  if (login) {
    login.reset()
    login.elements.email.value = 'shipper@cbmfood.vn'
    login.elements.password.value = 'shipper123'
  }
  switchAuthTab('login')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

let authReady = false
let authStarting = null

/** Khởi tạo module xác thực cho phạm vi shipper. */
async function startAuth() {
  auth.useScope('shipper')
  await auth.init()
  await auth.ensureDemoShipper()
  authReady = true
  return true
}

login.addEventListener('submit', async (event) => {
  event.preventDefault()
  loginError.hidden = true
  if (!authReady) {
    try {
      loginError.textContent = 'Đang khởi tạo tài khoản Shipper...'
      loginError.hidden = false
      if (!authStarting) authStarting = startAuth()
      await authStarting
    } catch (error) {
      console.error(error)
      loginError.textContent = 'Không khởi tạo được tài khoản Shipper. Hãy tải lại trang.'
      loginError.hidden = false
      return
    }
    loginError.hidden = true
  }
  const data = new FormData(login)
  const email = String(data.get('email') || '').trim().toLowerCase()
  const password = String(data.get('password') || '')
  try {
    let result = await auth.login({ email, password })
    /* Nếu localStorage cũ làm hỏng tài khoản demo, khôi phục rồi đăng nhập lại. */
    if (result.error && email === 'shipper@cbmfood.vn' && password === 'shipper123') {
      await auth.ensureDemoShipper()
      result = await auth.login({ email, password })
    }
    if (result.error) {
      loginError.textContent = result.error
      loginError.hidden = false
      return
    }
    if (result.user.role !== 'shipper') {
      loginError.textContent = 'Tài khoản này không phải tài khoản shipper'
      loginError.hidden = false
      return
    }
    showApp(result.user)
  } catch (error) {
    console.error(error)
    loginError.textContent = 'Không thể đăng nhập. Hãy tải lại trang rồi thử lại.'
    loginError.hidden = false
  }
})

$('#shipper-logout').addEventListener('click', (event) => {
  event.preventDefault()
  auth.logout()
  showGate()
})

/** Chuyển giữa tab đăng nhập và đăng ký. */
const switchAuthTab = (tab) => {
  $$('[data-auth-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.authTab === tab))
  if (login) login.hidden = tab !== 'login'
  if (register) register.hidden = tab !== 'register'
  if (loginError) loginError.hidden = true
  if (registerError) registerError.hidden = true
  if (registerSuccess) registerSuccess.hidden = true
}

$$('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => switchAuthTab(button.dataset.authTab))
})

register?.addEventListener('submit', async (event) => {
  event.preventDefault()
  registerError.hidden = true
  registerSuccess.hidden = true
  const data = new FormData(register)
  const password = String(data.get('password') || '')
  const confirmPassword = String(data.get('confirmPassword') || '')
  if (password !== confirmPassword) {
    registerError.textContent = 'Mật khẩu nhập lại không khớp.'
    registerError.hidden = false
    return
  }
  try {
    if (!authReady) {
      if (!authStarting) authStarting = startAuth()
      await authStarting
    }
    const result = await auth.registerShipper({
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
      phone: String(data.get('phone') || ''),
      password,
    })
    if (result.error) {
      registerError.textContent = result.error
      registerError.hidden = false
      return
    }
    register.reset()
    registerSuccess.textContent = 'Đăng ký thành công! Bạn có thể đăng nhập ngay.'
    registerSuccess.hidden = false
    setTimeout(() => {
      if (!registerSuccess.hidden) switchAuthTab('login')
      if (login) {
        login.elements.email.value = result.user.email
        login.elements.password.value = ''
        login.elements.password.focus()
      }
    }, 700)
  } catch (error) {
    console.error(error)
    registerError.textContent = 'Không thể đăng ký lúc này. Vui lòng thử lại.'
    registerError.hidden = false
  }
})

/* =========================================================================
 * ĐỒNG BỘ DỮ LIỆU & KHỞI ĐỘNG
 * ========================================================================= */

/* Đóng modal bằng phím Escape. */
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal()
})

/* Đồng bộ khi tab khác thay đổi dữ liệu (admin/khách đặt đơn...). */
window.addEventListener('storage', (event) => {
  if (!event.key) return
  if (event.key.startsWith('cbmfood.')) {
    db.reloadFromStorage()
    if (currentUser) render()
  }
})

/* Cập nhật realtime: đọc lại dữ liệu và vẽ lại mỗi 1,5 giây. */
setInterval(() => {
  if (!currentUser) return
  db.reloadFromStorage()
  render()
}, 1500)

/** Khởi động ứng dụng: chuẩn bị xác thực rồi khôi phục phiên nếu có. */
async function start() {
  try {
    authStarting = startAuth()
    await authStarting
  } catch (error) {
    console.error('Shipper auth init failed:', error)
    authReady = false
    loginError.textContent = 'Không khởi tạo được hệ thống đăng nhập. Hãy tải lại trang.'
    loginError.hidden = false
    return
  }
  const user = auth.getUser()
  if (user?.role === 'shipper') showApp(user)
}

start().catch((error) => {
  console.error(error)
  toast('Không khởi động được trang shipper', true)
})
