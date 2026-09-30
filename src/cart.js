import { formatPrice, escapeHtml, syncScrollLock } from './utils.js'

const STORAGE_KEY = 'cbmCart'
const DELIVERY_FEE = 15000
const FREE_DELIVERY_THRESHOLD = 200000
const MAX_QUANTITY = 99

const items = loadItems()
const listeners = new Set()

function loadItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(item => item && item.id && item.name && item.price > 0)
  } catch {
    return []
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  listeners.forEach(listener => listener())
}

export const cart = {
  get items() {
    return items
  },

  add(dish, quantity = 1) {
    const existing = items.find(item => item.id === dish.id)
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY)
    else
      items.push({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        image: dish.image,
        quantity: Math.min(quantity, MAX_QUANTITY),
      })
    persist()
  },

  updateQuantity(id, quantity) {
    if (quantity <= 0) return this.remove(id)
    const item = items.find(entry => entry.id === id)
    if (!item) return
    item.quantity = Math.min(quantity, MAX_QUANTITY)
    persist()
  },

  remove(id) {
    const index = items.findIndex(entry => entry.id === id)
    if (index === -1) return
    items.splice(index, 1)
    persist()
  },

  clear() {
    items.length = 0
    persist()
  },

  get isEmpty() {
    return items.length === 0
  },

  get count() {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  },

  get subtotal() {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  get deliveryFee() {
    if (this.isEmpty || this.subtotal >= FREE_DELIVERY_THRESHOLD) return 0
    return DELIVERY_FEE
  },

  get total() {
    return this.subtotal + this.deliveryFee
  },

  get missingForFreeDelivery() {
    return Math.max(FREE_DELIVERY_THRESHOLD - this.subtotal, 0)
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

function renderCart() {
  const body = document.querySelector('#cartBody')
  const foot = document.querySelector('#cartFoot')
  const badge = document.querySelector('#cartCount')
  if (!body || !foot || !badge) return

  badge.textContent = cart.count
  badge.classList.toggle('has-items', cart.count > 0)

  if (cart.isEmpty) {
    body.innerHTML = `
      <div class="cart-empty">
        <span class="cart-empty-icon">🍽️</span>
        <h3>Giỏ hàng đang trống</h3>
        <p>Chọn món ngon ở thực đơn để bắt đầu đơn hàng của bạn.</p>
        <button class="btn btn-outline" data-cart-browse>Đi đến thực đơn</button>
      </div>`
    foot.hidden = true
    return
  }

  foot.hidden = false
  body.innerHTML = items
    .map(
      item => `
      <div class="cart-item">
        <img class="cart-thumb" src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy">
        <div class="cart-item-body">
          <h4>${escapeHtml(item.name)}</h4>
          <span class="cart-item-price">${formatPrice(item.price)} / phần</span>
        </div>
        <div class="cart-item-foot">
          <div class="qty">
            <button type="button" data-action="dec" data-id="${item.id}" aria-label="Giảm số lượng ${escapeHtml(item.name)}">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-action="inc" data-id="${item.id}" aria-label="Tăng số lượng ${escapeHtml(item.name)}">+</button>
          </div>
          <button type="button" class="cart-remove" data-remove="${item.id}">Xoá</button>
          <strong class="cart-item-total">${formatPrice(item.price * item.quantity)}</strong>
        </div>
      </div>`
    )
    .join('')

  document.querySelector('#cartSubtotal').textContent = formatPrice(cart.subtotal)
  document.querySelector('#cartShipping').textContent = cart.deliveryFee
    ? formatPrice(cart.deliveryFee)
    : 'Miễn phí'
  document.querySelector('#cartTotal').textContent = formatPrice(cart.total)
  document.querySelector('#cartHint').textContent = cart.deliveryFee
    ? `Mua thêm ${formatPrice(cart.missingForFreeDelivery)} để được miễn phí giao hàng.`
    : 'Bạn được miễn phí giao hàng cho đơn này.'
}

export function openCart() {
  document.querySelector('#cartDrawer').classList.add('show')
  document.querySelector('#cartBackdrop').classList.add('show')
  document.querySelector('#cartDrawer').setAttribute('aria-hidden', 'false')
  document.body.classList.add('modal-open')
}

export function closeCart() {
  document.querySelector('#cartDrawer').classList.remove('show')
  document.querySelector('#cartBackdrop').classList.remove('show')
  document.querySelector('#cartDrawer').setAttribute('aria-hidden', 'true')
  syncScrollLock()
}

export function initCart({ onCheckout } = {}) {
  cart.subscribe(renderCart)
  renderCart()

  document.addEventListener('click', event => {
    if (event.target.closest('#openCart')) openCart()
    if (event.target.closest('#closeCart') || event.target.closest('#cartBackdrop')) closeCart()

    const stepper = event.target.closest('.qty [data-action]')
    if (stepper) {
      const id = Number(stepper.dataset.id)
      const item = items.find(entry => entry.id === id)
      if (item)
        cart.updateQuantity(id, item.quantity + (stepper.dataset.action === 'inc' ? 1 : -1))
      return
    }

    const removeButton = event.target.closest('[data-remove]')
    if (removeButton) return cart.remove(Number(removeButton.dataset.remove))

    if (event.target.closest('[data-cart-browse]')) {
      closeCart()
      document.querySelector('#menu').scrollIntoView({ behavior: 'smooth' })
      return
    }

    if (event.target.closest('#toCheckout')) {
      if (cart.isEmpty) return
      closeCart()
      if (onCheckout) onCheckout()
    }
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    if (document.querySelector('#cartDrawer').classList.contains('show')) closeCart()
  })
}