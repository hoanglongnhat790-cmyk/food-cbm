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

const STATUS_FLOW = ['pending', 'delivering', 'completed']

const STATUS_LABELS = {
  pending: {
    label: 'Chờ xác nhận',
    action: 'Bắt đầu giao hàng',
    hint: 'Nhà hàng đang xác nhận đơn của bạn',
  },
  delivering: {
    label: 'Đang giao',
    action: 'Đã giao xong',
    hint: 'Shipper đang trên đường giao món',
  },
  completed: {
    label: 'Hoàn thành',
    action: '',
    hint: 'Cảm ơn bạn đã ủng hộ CBM FOOD',
  },
}

const LEGACY_STATUS_MAP = { confirmed: 'pending', preparing: 'delivering' }

function createOrderId() {
  const random = Math.floor(Math.random() * 1000)
  return `CBM${Date.now().toString().slice(-6)}${random}`
}

function normalizeStatus(status) {
  if (STATUS_FLOW.includes(status)) return status
  return LEGACY_STATUS_MAP[status] || 'pending'
}

export function getOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(order => order && typeof order === 'object')
      .map(order => ({ ...order, status: normalizeStatus(order.status) }))
  } catch {
    return []
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

export function getNextStatus(status) {
  const index = STATUS_FLOW.indexOf(normalizeStatus(status))
  return index >= 0 && index < STATUS_FLOW.length - 1 ? STATUS_FLOW[index + 1] : null
}

function updateOrderStatus(id, status) {
  const orders = getOrders()
  const order = orders.find(entry => entry.id === id)
  if (!order) return false
  order.status = normalizeStatus(status)
  order.statusUpdatedAt = new Date().toISOString()
  saveOrders(orders)
  return true
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
  document.querySelector('#checkoutFormStep').hidden = true
  document.querySelector('#checkoutSuccess').hidden = false
  document.querySelector('#successBody').innerHTML = `
    <span class="success-icon">✓</span>
    <h2>Đặt hàng thành công</h2>
    <p class="success-sub">Cảm ơn ${escapeHtml(order.customer.fullName)}! Đơn ${escapeHtml(order.id)} đang chờ nhà hàng xác nhận.</p>
    <span class="success-code">${escapeHtml(order.id)}</span>
    <div class="success-grid">
      <div class="success-card"><span>Giao đến</span><strong>${escapeHtml(order.customer.address)}</strong></div>
      <div class="success-card"><span>Liên hệ</span><strong>${escapeHtml(order.customer.phone)}</strong></div>
      <div class="success-card"><span>Thanh toán</span><strong>${escapeHtml(PAYMENT_METHODS[order.payment].label)}</strong></div>
    </div>
    <ol class="order-timeline">
      ${STATUS_FLOW.map((step, index) => {
        const state = index === 0 ? 'done' : index === 1 ? 'active' : ''
        const detail =
          index === 0
            ? `${formatTime(new Date(order.createdAt))} · ${formatPrice(order.total)}`
            : index === 1
              ? `Dự kiến giao lúc ${formatTime(new Date(order.estimatedAt))}`
              : STATUS_LABELS[step].hint
        return `<li class="${state}"><span>${state === 'done' ? '✓' : index + 1}</span><div><strong>${STATUS_LABELS[step].label}</strong><small>${detail}</small></div></li>`
      }).join('')}
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

function renderStatusTrack(status) {
  const current = STATUS_FLOW.indexOf(status)
  return `<ol class="status-track">${STATUS_FLOW.map((step, index) => {
    const state = index < current ? 'done' : index === current ? 'active' : ''
    return `<li class="${state}"><span>${index < current ? '✓' : index + 1}</span><small>${STATUS_LABELS[step].label}</small></li>`
  }).join('')}</ol>`
}

function renderStatusActions(order) {
  const { action, hint } = STATUS_LABELS[order.status]
  if (order.status === 'completed')
    return `<div class="order-card-actions"><span class="status-note">${hint}</span></div>`
  return `<div class="order-card-actions"><button type="button" class="btn btn-sm btn-outline" data-order-advance="${escapeHtml(order.id)}">${action}</button></div>`
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
          <span class="status-badge ${order.status}">${STATUS_LABELS[order.status].label}</span>
        </div>
        <p class="order-date">${formatDateTime(order.createdAt)} · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} món</p>
        ${renderStatusTrack(order.status)}
        <ul>
          ${order.items.map(item => `<li><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${formatPrice(item.price * item.quantity)}</strong></li>`).join('')}
        </ul>
        <div class="order-card-foot"><span>Giao đến ${escapeHtml(order.customer.address)}</span><strong>${formatPrice(order.total)}</strong></div>
        ${renderStatusActions(order)}
      </article>`
    )
    .join('')

  const countOf = status => orders.filter(order => order.status === status).length
  document.querySelector('#ordersTotal').textContent = `Tổng ${orders.length} đơn hàng · ${countOf('pending')} chờ xác nhận · ${countOf('delivering')} đang giao · ${countOf('completed')} hoàn thành`
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

    const advanceButton = event.target.closest('[data-order-advance]')
    if (advanceButton) {
      const id = advanceButton.dataset.orderAdvance
      const order = getOrders().find(entry => entry.id === id)
      const next = order && getNextStatus(order.status)
      if (next && updateOrderStatus(id, next)) renderOrders()
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
      status: 'pending',
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