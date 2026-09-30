import { cart } from './cart.js'
import { formatPrice, escapeHtml, formatTime, formatDateTime, syncScrollLock } from './utils.js'

const ORDERS_KEY = 'cbmOrders'
const PROFILE_KEY = 'cbmProfile'
const PREP_MINUTES = 30

const PAYMENT_METHODS = {
  cod: { label: 'Thanh toán khi nhận hàng', hint: 'Chuẩn bị món và giao đến tận nơi' },
  momo: { label: 'Ví MoMo', hint: 'Quét mã QR khi nhận món' },
  bank: { label: 'Chuyển khoản ngân hàng', hint: 'Chuyển trước khi giao hàng' },
}

const STATUS_LABELS = {
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  delivering: 'Đang giao hàng',
  completed: 'Hoàn tất',
}

function createOrderId() {
  const random = Math.floor(Math.random() * 1000)
  return `CBM${Date.now().toString().slice(-6)}${random}`
}

export function getOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

function renderSummary() {
  const summary = document.querySelector('#checkoutSummary')
  if (!summary) return
  summary.innerHTML = `
    <h3 class="summary-title">Đơn hàng của bạn</h3>
    <div class="summary-list">
      ${cart.items
        .map(
          item => `
          <div class="summary-item">
            <span>${escapeHtml(item.name)} × ${item.quantity}</span>
            <strong>${formatPrice(item.price * item.quantity)}</strong>
          </div>`
        )
        .join('')}
    </div>
    <div class="summary-line"><span>Tạm tính</span><strong>${formatPrice(cart.subtotal)}</strong></div>
    <div class="summary-line"><span>Phí giao hàng</span><strong>${cart.deliveryFee ? formatPrice(cart.deliveryFee) : 'Miễn phí'}</strong></div>
    <div class="summary-line summary-total"><span>Tổng cộng</span><strong>${formatPrice(cart.total)}</strong></div>
    <p class="summary-note">${cart.deliveryFee ? `Miễn phí giao hàng khi đơn từ ${formatPrice(200000)}.` : 'Bạn được miễn phí giao hàng cho đơn này.'}</p>`
}

function prefillForm() {
  const user = JSON.parse(localStorage.getItem('cbmCurrentUser') || 'null')
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')
  if (profile) {
    document.querySelector('#orderName').value = profile.fullName || ''
    document.querySelector('#orderPhone').value = profile.phone || ''
    document.querySelector('#orderAddress').value = profile.address || ''
  }
  if (user && !document.querySelector('#orderName').value)
    document.querySelector('#orderName').value = user.name || ''
}

function showCheckoutStep() {
  document.querySelector('#checkoutFormStep').hidden = false
  document.querySelector('#checkoutSuccess').hidden = true
}

function showSuccessStep(order) {
  const delivery = new Date(order.estimatedAt)
  document.querySelector('#checkoutFormStep').hidden = true
  document.querySelector('#checkoutSuccess').hidden = false
  document.querySelector('#successBody').innerHTML = `
    <span class="success-icon">✓</span>
    <h2>Đơn hàng đã xác nhận</h2>
    <p class="success-sub">Cảm ơn ${escapeHtml(order.customer.fullName)}! Chúng tôi đã nhận đơn và đang chuẩn bị món ngon cho bạn.</p>
    <span class="success-code">${escapeHtml(order.id)}</span>
    <div class="success-grid">
      <div class="success-card"><span>Giao đến</span><strong>${escapeHtml(order.customer.address)}</strong></div>
      <div class="success-card"><span>Liên hệ</span><strong>${escapeHtml(order.customer.phone)}</strong></div>
      <div class="success-card"><span>Thanh toán</span><strong>${escapeHtml(PAYMENT_METHODS[order.payment].label)}</strong></div>
    </div>
    <ol class="order-timeline">
      <li class="done"><span>✓</span><div><strong>Đã xác nhận</strong><small>${formatTime(new Date(order.createdAt))} · ${formatPrice(order.total)}</small></div></li>
      <li class="active"><span>2</span><div><strong>Đang chuẩn bị</strong><small>Bếp nhận đơn lúc ${formatTime(new Date(order.createdAt))}</small></div></li>
      <li><span>3</span><div><strong>Đang giao hàng</strong><small>Dự kiến giao lúc ${formatTime(delivery)}</small></div></li>
      <li><span>4</span><div><strong>Hoàn tất</strong><small>Cảm ơn bạn đã ủng hộ CBM FOOD</small></div></li>
    </ol>
    <div class="success-actions">
      <button type="button" class="btn btn-primary" data-success-orders>Xem đơn hàng của tôi</button>
      <button type="button" class="btn btn-outline" data-success-close>Đặt thêm món</button>
    </div>`
}

function validateForm() {
  const fullName = document.querySelector('#orderName')
  const phone = document.querySelector('#orderPhone')
  const address = document.querySelector('#orderAddress')
  const message = document.querySelector('#checkoutMessage')
  const fields = [fullName, phone, address]

  fields.forEach(field => field.closest('.form-group').classList.remove('field-error'))

  const fail = (field, text) => {
    field.closest('.form-group').classList.add('field-error')
    message.textContent = text
    field.focus()
    return false
  }

  if (fullName.value.trim().length < 2) return fail(fullName, 'Vui lòng nhập họ và tên.')
  if (!/^(0|\+84)\d{9,10}$/.test(phone.value.trim())) return fail(phone, 'Số điện thoại chưa hợp lệ. Ví dụ: 0901234567.')
  if (address.value.trim().length < 6) return fail(address, 'Vui lòng nhập địa chỉ giao hàng đầy đủ.')

  message.textContent = ''
  return true
}

function renderOrders() {
  const list = document.querySelector('#ordersList')
  const orders = getOrders()

  if (!orders.length) {
    list.innerHTML = `
      <div class="orders-empty">
        <span class="cart-empty-icon">🧾</span>
        <h3>Bạn chưa có đơn hàng nào</h3>
        <p>Hãy chọn món ngon để đơn hàng đầu tiên của bạn xuất hiện tại đây.</p>
        <button type="button" class="btn btn-primary" data-orders-close>Đi đến thực đơn</button>
      </div>`
    document.querySelector('#ordersTotal').textContent = ''
    return
  }

  list.innerHTML = orders
    .map(
      order => `
      <article class="order-card">
        <div class="order-card-head">
          <span class="order-code">${escapeHtml(order.id)}</span>
          <span class="status-badge">${escapeHtml(STATUS_LABELS[order.status])}</span>
        </div>
        <p class="order-date">${formatDateTime(order.createdAt)} · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} món</p>
        <ul>
          ${order.items.map(item => `<li><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${formatPrice(item.price * item.quantity)}</strong></li>`).join('')}
        </ul>
        <div class="order-card-foot"><span>Giao đến ${escapeHtml(order.customer.address)}</span><strong>${formatPrice(order.total)}</strong></div>
      </article>`
    )
    .join('')
  document.querySelector('#ordersTotal').textContent = `Tổng ${orders.length} đơn hàng`
}

export function openOrders() {
  renderOrders()
  document.querySelector('#ordersModal').classList.add('show')
  document.querySelector('#ordersModal').setAttribute('aria-hidden', 'false')
  document.body.classList.add('modal-open')
}

function closeOrders() {
  document.querySelector('#ordersModal').classList.remove('show')
  document.querySelector('#ordersModal').setAttribute('aria-hidden', 'true')
  syncScrollLock()
}

export function openCheckout() {
  if (cart.isEmpty) return openOrders()
  showCheckoutStep()
  document.querySelector('#checkoutNote').value = ''
  prefillForm()
  renderSummary()
  document.querySelector('#checkoutModal').classList.add('show')
  document.querySelector('#checkoutModal').setAttribute('aria-hidden', 'false')
  document.body.classList.add('modal-open')
  setTimeout(() => document.querySelector('#orderName').focus(), 50)
}

function closeCheckout() {
  document.querySelector('#checkoutModal').classList.remove('show')
  document.querySelector('#checkoutModal').setAttribute('aria-hidden', 'true')
  syncScrollLock()
}

export function initCheckout() {
  document.addEventListener('click', event => {
    if (event.target.closest('#openOrders')) openOrders()
    if (event.target.closest('#closeOrders') || event.target.id === 'ordersModal') closeOrders()
    if (event.target.closest('#closeCheckout') || event.target.id === 'checkoutModal') closeCheckout()
    if (event.target.closest('[data-success-close]')) {
      closeCheckout()
      document.querySelector('#menu').scrollIntoView({ behavior: 'smooth' })
    }
    if (event.target.closest('[data-success-orders]')) {
      closeCheckout()
      openOrders()
    }
    if (event.target.closest('[data-orders-close]')) {
      closeOrders()
      document.querySelector('#menu').scrollIntoView({ behavior: 'smooth' })
    }
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    if (document.querySelector('#checkoutModal').classList.contains('show')) closeCheckout()
    else if (document.querySelector('#ordersModal').classList.contains('show')) closeOrders()
  })

  document.querySelector('#checkoutForm').addEventListener('submit', event => {
    event.preventDefault()
    if (!validateForm()) return

    const now = new Date()
    const fullName = document.querySelector('#orderName').value.trim()
    const phone = document.querySelector('#orderPhone').value.trim()
    const address = document.querySelector('#orderAddress').value.trim()
    const note = document.querySelector('#checkoutNote').value.trim()
    const payment = document.querySelector('input[name="payment"]:checked').value

    const order = {
      id: createOrderId(),
      createdAt: now.toISOString(),
      estimatedAt: new Date(now.getTime() + PREP_MINUTES * 60000).toISOString(),
      status: 'confirmed',
      customer: { fullName, phone, address, note },
      payment,
      items: cart.items.map(item => ({ ...item })),
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
    }

    saveOrders([order, ...getOrders()])
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName, phone, address })
    )
    cart.clear()
    showSuccessStep(order)
  })
}