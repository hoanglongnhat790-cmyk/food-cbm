import './shipper.css'
import * as db from './store.js'
import * as auth from './auth.js'

window.__cbmShipperModuleReady = true

const $ = (s) => document.querySelector(s)
const escape = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`

const gate = $('#shipper-gate')
const app = $('#shipper-app')
const login = $('#shipper-login')
const loginError = $('#shipper-login-error')
const register = $('#shipper-register')
const registerError = $('#shipper-register-error')
const registerSuccess = $('#shipper-register-success')
const availablePanel = $('#available-panel')
const activePanel = $('#active-panel')
const modal = $('#shipper-modal')
let currentUser = null
let proofOrderCode = ''
let shipMap = null
let riderMarker = null
let mapOrderMarkers = []
let online = true

const toast = (message, error = false) => {
  const node = document.createElement('div')
  node.className = `shipper-toast-msg${error ? ' is-error' : ''}`
  node.textContent = message
  $('#shipper-toast').append(node)
  setTimeout(() => node.remove(), 3000)
}

const statusLabel = (status) => db.ORDER_STATUS[status]?.label || status

const orderCard = (order, available = false) => `
  <article class="ship-order-card">
    <div class="ship-order-head"><div><strong>${escape(order.code)}</strong><small>${new Date(order.createdAt).toLocaleString('vi-VN')}</small></div><span class="ship-status status-${escape(order.status)}">${escape(statusLabel(order.status))}</span></div>
    <div class="ship-customer"><strong>${escape(order.customer.name)}</strong><span>☎ ${escape(order.customer.phone)}</span><span>📍 ${escape(order.customer.address)}</span></div>
    <div class="ship-lines">${order.items.map((item) => `<div><span>${escape(item.name)} × ${item.qty}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}</div>
    <div class="ship-total"><span>${order.paymentMethod === 'cod' ? '💵 Thu COD' : order.paymentMethod === 'momo' ? '🩷 MoMo' : '🏦 Chuyển khoản'}</span><b>${money(order.total)}</b></div>
    ${order.deliveryProof?.photo ? `<div class="ship-proof"><img src="${escape(order.deliveryProof.photo)}" alt="Ảnh giao hàng" /><span>Đã có ảnh giao hàng</span></div>` : ''}
    <div class="ship-actions">
      <button class="ship-secondary" data-action="detail" data-code="${escape(order.code)}">Chi tiết</button>
      ${available ? `<button class="ship-primary" data-action="claim" data-code="${escape(order.code)}">📦 Nhận đơn</button>` : ''}
      ${!available && order.status === 'confirmed' ? `<button class="ship-primary" data-action="start" data-code="${escape(order.code)}">🛵 Bắt đầu giao</button>` : ''}
      ${!available && order.status === 'delivering' ? `<button class="ship-primary" data-action="proof" data-code="${escape(order.code)}">📷 Giao hàng</button>` : ''}
      ${!available && order.status === 'completed' ? `<span class="ship-done">✓ Đã giao thành công</span>` : ''}
    </div>
  </article>`

const initMap = () => {
  if (shipMap || !window.L) return
  const defaultCenter = [21.0285, 105.8542]
  shipMap = window.L.map('shipper-map', { zoomControl: true }).setView(defaultCenter, 13)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(shipMap)
  const storeIcon = window.L.divIcon({ className: 'map-pin map-pin-store', html: '🍜', iconSize: [38,38], iconAnchor:[19,38] })
  window.L.marker(defaultCenter, { icon: storeIcon }).addTo(shipMap).bindPopup('<b>CBM FOOD</b><br>Điểm lấy món')
  locateRider()
}

const locateRider = () => {
  if (!shipMap || !navigator.geolocation) return
  navigator.geolocation.getCurrentPosition((pos) => {
    const point = [pos.coords.latitude, pos.coords.longitude]
    const icon = window.L.divIcon({ className: 'map-pin map-pin-rider', html: '🛵', iconSize:[38,38], iconAnchor:[19,38] })
    if (riderMarker) riderMarker.setLatLng(point)
    else riderMarker = window.L.marker(point, { icon }).addTo(shipMap).bindPopup('<b>Vị trí của bạn</b>')
    shipMap.setView(point, 14)
  }, () => toast('Không lấy được vị trí. Bạn có thể bật quyền vị trí trên trình duyệt.', true), { enableHighAccuracy:true, timeout:8000 })
}

const updateMapOrders = (orders) => {
  if (!shipMap || !window.L) return
  mapOrderMarkers.forEach((m) => m.remove())
  mapOrderMarkers = []
  const icon = window.L.divIcon({ className:'map-pin map-pin-order', html:'📦', iconSize:[36,36], iconAnchor:[18,36] })
  orders.forEach((order, index) => {
    // Demo coordinates quanh trung tâm Hà Nội; khi có GPS/geocoding backend có thể thay bằng tọa độ thật.
    const point = [21.0285 + ((index % 3)-1)*0.012, 105.8542 + ((index % 2)?0.014:-0.010)]
    const marker = window.L.marker(point,{icon}).addTo(shipMap).bindPopup(`<b>${escape(order.code)}</b><br>${escape(order.customer?.address || 'Điểm giao hàng')}`)
    mapOrderMarkers.push(marker)
  })
}

const render = () => {
  if (!currentUser) return
  const available = online ? db.listAvailableShipOrders() : []
  const mine = db.listOrdersForShipper(currentUser.id)
  const active = mine.filter((o) => ['confirmed','delivering'].includes(o.status))
  const done = mine.filter((o) => o.status === 'completed').length
  $('#available-count').textContent = available.length
  $('#active-count').textContent = active.length
  $('#done-count').textContent = done
  availablePanel.innerHTML = available.length ? available.map((o) => orderCard(o, true)).join('') : '<div class="empty-ship">🎉 Hiện chưa có đơn mới để nhận.</div>'
  activePanel.innerHTML = mine.length ? mine.map((o) => orderCard(o, false)).join('') : '<div class="empty-ship">Bạn chưa nhận đơn nào.</div>'
  $('#shipper-welcome-name').textContent = currentUser.name
  const earned = mine.filter((o) => o.status === 'completed').reduce((sum, o) => sum + Math.round(Number(o.total || 0) * 0.1), 0)
  $('#earn-count').textContent = money(earned)
  updateMapOrders(available.concat(active))
}

const openDetail = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  modal.innerHTML = `<div class="ship-modal-backdrop"><div class="ship-modal"><header><h2>Đơn ${escape(order.code)}</h2><button data-action="close">×</button></header><div class="ship-detail"><section><h3>Khách hàng</h3><p><b>${escape(order.customer.name)}</b></p><p>☎ ${escape(order.customer.phone)}</p><p>📍 ${escape(order.customer.address)}</p></section><section><h3>Món hàng</h3>${order.items.map((i) => `<p>${escape(i.name)} × ${i.qty} — <b>${money(i.price*i.qty)}</b></p>`).join('')}</section><section><h3>Thanh toán</h3><p>${order.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng' : order.paymentMethod === 'momo' ? 'MoMo' : 'Chuyển khoản'}</p><p>Tổng: <b>${money(order.total)}</b></p></section></div><footer><button class="ship-primary" data-action="close">Đóng</button></footer></div></div>`
}

const openProof = (code) => {
  proofOrderCode = code
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn', true)
  modal.innerHTML = `<div class="ship-modal-backdrop"><div class="ship-modal"><header><h2>Xác nhận giao đơn</h2><button data-action="close">×</button></header><form id="proof-form"><p class="ship-note">Chụp ảnh món hàng/điểm giao để xác nhận đã giao cho khách.</p><label><span>Ảnh giao hàng *</span><input name="photo" type="file" accept="image/*" capture="environment" required /></label><div class="proof-preview" id="ship-proof-preview"><span>Chưa chọn ảnh</span></div><label><span>Ghi chú</span><textarea name="note" placeholder="Ví dụ: Đã giao đủ món, khách đã nhận và thanh toán COD."></textarea></label><footer><button type="button" class="ship-secondary" data-action="close">Huỷ</button><button class="ship-primary" type="submit">✓ Xác nhận đã giao</button></footer></form></div></div>`
}

const compressPhoto = (file, maxSide=1400, quality=.82) => new Promise((resolve,reject) => {
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

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]')
  if (!target) return
  const action = target.dataset.action
  if (action === 'close') { modal.innerHTML = ''; return }
  if (action === 'detail') return openDetail(target.dataset.code)
  if (action === 'claim') {
    const result = db.claimOrder(target.dataset.code, currentUser)
    if (result.error) return toast(result.error, true)
    toast(`Đã nhận đơn ${result.order.code}`)
    render()
    return
  }
  if (action === 'start') {
    const order = db.findOrder(target.dataset.code)
    if (!order || order.shipper?.id !== currentUser.id) return toast('Đơn không thuộc về bạn', true)
    const updated = db.updateOrderStatus(order.code, 'delivering')
    if (!updated) return toast('Không thể bắt đầu giao đơn', true)
    toast('Đã chuyển sang đang giao')
    render()
    return
  }
  if (action === 'proof') return openProof(target.dataset.code)
})

modal.addEventListener('change', (event) => {
  if (event.target.name !== 'photo') return
  const file = event.target.files?.[0]
  const preview = $('#ship-proof-preview')
  if (!file || !preview) return
  if (!file.type.startsWith('image/')) return toast('Vui lòng chọn file ảnh', true)
  preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Ảnh xem trước" />`
})

modal.addEventListener('submit', async (event) => {
  if (event.target.id !== 'proof-form') return
  event.preventDefault()
  const data = new FormData(event.target)
  const file = data.get('photo')
  if (!(file instanceof File) || !file.size) return toast('Vui lòng chụp/chọn ảnh giao hàng', true)
  if (file.size > 8 * 1024 * 1024) return toast('Ảnh giao hàng tối đa 8MB', true)
  const code = proofOrderCode
  if (!code) return toast('Không xác định được đơn giao', true)
  try {
    const photo = await compressPhoto(file)
    const saved = db.saveOrderDeliveryProof(code, {
      shipperId: currentUser.id,
      shipperName: currentUser.name,
      shipperPhone: currentUser.phone || '',
      shipperEmail: currentUser.email || '',
      photo,
      note: String(data.get('note') || ''),
    })
    if (!saved) return toast('Không lưu được ảnh giao hàng', true)
    const updated = db.updateOrderStatus(code, 'completed')
    if (!updated) return toast('Không cập nhật được trạng thái đơn', true)
    toast(`Đã giao thành công ${updated.code}`)
    modal.innerHTML = ''
    proofOrderCode = ''
    render()
  } catch {
    toast('Không xử lý được ảnh giao hàng', true)
  }
})


for (const button of document.querySelectorAll('.shipper-tabs button')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('.shipper-tabs button').forEach((b) => b.classList.remove('is-active'))
    button.classList.add('is-active')
    const available = button.dataset.tab === 'available'
    availablePanel.hidden = !available
    activePanel.hidden = available
  })
}

document.querySelectorAll('[data-quick-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.quickTab
    document.querySelector(`.shipper-tabs button[data-tab="${tab}"]`)?.click()
    document.querySelector('.shipper-tabs')?.scrollIntoView({ behavior:'smooth', block:'start' })
  })
})

$('#ship-my-location').addEventListener('click', () => locateRider())
$('#ship-online-toggle').addEventListener('click', () => {
  online = !online
  const btn = $('#ship-online-toggle')
  btn.textContent = online ? '🟢 Đang nhận đơn' : '⚪ Tạm nghỉ'
  btn.classList.toggle('is-offline', !online)
  toast(online ? 'Bạn đã online và có thể nhận đơn.' : 'Bạn đã tạm nghỉ, sẽ không nhận đơn mới.')
})

let authReady = false
let authStarting = null

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
    /* Nếu dữ liệu localStorage của bản cũ làm hỏng tài khoản demo, tự khôi phục
       đúng tài khoản demo rồi thử đăng nhập lại một lần. */
    if (result.error && email === 'shipper@cbmfood.vn' && password === 'shipper123') {
      await auth.ensureDemoShipper()
      result = await auth.login({ email, password })
    }
    if (result.error) { loginError.textContent = result.error; loginError.hidden = false; return }
    if (result.user.role !== 'shipper') { loginError.textContent = 'Tài khoản này không phải tài khoản shipper'; loginError.hidden = false; return }
    currentUser = result.user
    $('#shipper-name').textContent = currentUser.name
    $('#shipper-phone').textContent = currentUser.phone || currentUser.email
    $('#shipper-avatar').textContent = currentUser.name.charAt(0).toUpperCase()
    gate.hidden = true
    gate.style.display = 'none'
    app.hidden = false
    app.style.display = 'block'
    initMap()
    render()
  } catch (error) {
    console.error(error)
    loginError.textContent = 'Không thể đăng nhập. Hãy tải lại trang rồi thử lại.'
    loginError.hidden = false
  }
})

$('#shipper-logout').addEventListener('click', (event) => {
  event.preventDefault()
  auth.logout()
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
})


const switchAuthTab = (tab) => {
  document.querySelectorAll('[data-auth-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.authTab === tab))
  if (login) login.hidden = tab !== 'login'
  if (register) register.hidden = tab !== 'register'
  if (loginError) loginError.hidden = true
  if (registerError) registerError.hidden = true
  if (registerSuccess) registerSuccess.hidden = true
}

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
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

window.addEventListener('storage', (event) => {
  if (['cbmfood.orders','cbmfood.dishes','cbmfood.session.shipper'].includes(event.key)) {
    db.reloadFromStorage()
    if (currentUser) render()
  }
})

async function startAuth() {
  auth.useScope('shipper')
  await auth.init()
  await auth.ensureDemoShipper()
  authReady = true
  return true
}

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
  if (user?.role === 'shipper') {
    currentUser = user
    $('#shipper-name').textContent = user.name
    $('#shipper-phone').textContent = user.phone || user.email
    $('#shipper-avatar').textContent = user.name.charAt(0).toUpperCase()
    gate.hidden = true
    app.hidden = false
    app.style.display = 'block'
    gate.style.display = 'none'
    initMap()
    render()
  }
}
setInterval(() => {
  if (!currentUser) return
  db.reloadFromStorage()
  render()
}, 1500)

start().catch((error) => { console.error(error); toast('Không khởi động được trang shipper', true) })
