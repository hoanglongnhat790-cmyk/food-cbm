import * as auth from './auth.js'
import * as cart from './cart.js'
import * as db from './store.js'
import {
  CATEGORIES,
  CATEGORY_META,
  DEFAULT_RATING,
  DISH_STATUS,
  DISH_TAGS,
  FREE_SHIPPING_THRESHOLD,
  LOCATIONS,
  MAX_QTY_PER_ITEM,
  ORDER_STATUS,
  SHOP_INFO,
  accentOf,
} from './seed.js'

const $ = (selector, scope = document) => scope.querySelector(selector)
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)]

const numberFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const money = (value) => `${numberFmt.format(Number(value) || 0)}đ`
const plural = (count, word) => `${count} ${word}`

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const timeAgo = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.round(hours / 24)} ngày trước`
}

const dom = {}

const ui = {
  activeCategory: 'all',
  keyword: '',
  sort: 'popular',
  location: SHOP_INFO.defaultLocation,
  lastFocused: null,
}

function toast(message, tone = 'brand') {
  if (!dom.toasts) return
  const node = document.createElement('div')
  node.className = `toast toast-${tone}`
  node.textContent = message
  dom.toasts.append(node)
  setTimeout(() => node.classList.add('toast-out'), 2600)
  setTimeout(() => node.remove(), 3000)
}

function lockScroll(locked) {
  document.body.classList.toggle('is-locked', locked)
}

function openLayer(node) {
  ui.lastFocused = document.activeElement
  node.hidden = false
  dom.overlay.hidden = false
  lockScroll(true)
  requestAnimationFrame(() => node.classList.add('is-open'))
}

function closeLayer(node) {
  node.classList.remove('is-open')
  const hide = () => {
    node.hidden = true
    if (!openLayers().length) {
      dom.overlay.hidden = true
      lockScroll(false)
    }
  }
  if (node.classList.contains('drawer')) {
    setTimeout(hide, 240)
  } else {
    hide()
  }
  if (ui.lastFocused instanceof HTMLElement) ui.lastFocused.focus()
}

const openLayers = () => $$('.modal:not([hidden]), .drawer:not([hidden])')

function closeAll() {
  $$('.modal:not([hidden]), .drawer:not([hidden])').forEach(closeLayer)
}

const isOpen = (node) => !node.hidden

/* ------------------------------------------------------------------ menu */

/** danh mục dùng trong dữ liệu cũ vẫn hiển thị được, không bị mất */
function allCategories() {
  const extra = db.getDishes().map((dish) => dish.category)
  return [...CATEGORIES, ...extra.filter((name) => !CATEGORIES.includes(name))]
}

function categoryCount(name) {
  return db.getDishes().filter((dish) => dish.category === name).length
}

function renderCategories() {
  const items = [
    { name: 'all', label: 'Tất cả', emoji: '🍽️', count: db.getDishes().length },
    ...allCategories().map((name) => ({
      name,
      label: name,
      emoji: CATEGORY_META[name]?.emoji ?? '🍴',
      count: categoryCount(name),
    })),
  ]

  dom.categoryRow.innerHTML = items
    .map(
      (item) => `
      <button
        type="button"
        class="category${item.name === ui.activeCategory ? ' active' : ''}"
        data-category="${escapeHtml(item.name)}"
        aria-pressed="${item.name === ui.activeCategory}"
      >
        <span class="category-circle" aria-hidden="true">${item.emoji}</span>
        <span class="category-label">${escapeHtml(item.label)}</span>
        <span class="category-count">${item.count} món</span>
      </button>`,
    )
    .join('')
}

const SORTERS = {
  popular: (a, b) => b.sold - a.sold,
  rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
}

function visibleDishes() {
  const keyword = ui.keyword.trim().toLowerCase()

  const list = db.getDishes().filter((dish) => {
    if (ui.activeCategory !== 'all' && dish.category !== ui.activeCategory) {
      return false
    }
    if (!keyword) return true
    return (
      dish.name.toLowerCase().includes(keyword) ||
      dish.description.toLowerCase().includes(keyword) ||
      dish.category.toLowerCase().includes(keyword)
    )
  })

  return list.sort(SORTERS[ui.sort] ?? SORTERS.popular)
}

function renderActiveFilters() {
  const chips = []
  if (ui.activeCategory !== 'all') {
    chips.push({
      key: 'category',
      label: CATEGORY_META[ui.activeCategory]?.label ?? ui.activeCategory,
    })
  }
  if (ui.keyword.trim()) {
    chips.push({ key: 'keyword', label: `“${ui.keyword.trim()}”` })
  }

  if (!chips.length) {
    dom.activeFilters.hidden = true
    dom.activeFilters.innerHTML = ''
    return
  }

  dom.activeFilters.hidden = false
  dom.activeFilters.innerHTML = `
    <span>Lọc theo:</span>
    ${chips
      .map(
        (chip) =>
          `<button type="button" class="filter-chip" data-clear="${chip.key}">${escapeHtml(chip.label)} <i aria-hidden="true">&times;</i></button>`,
      )
      .join('')}
    <button type="button" class="filter-clear" data-clear="all">Xoá tất cả</button>`
}

/* Ảnh hỏng thì lùi về biểu tượng, không để lỗ hổng trên thẻ món. */
function watchBrokenImages() {
  window.addEventListener(
    'error',
    (event) => {
      const node = event.target
      if (!(node instanceof HTMLImageElement)) return
      node.hidden = true
      const fallback = node.parentElement?.querySelector('.product-emoji')
      if (fallback) fallback.hidden = false
    },
    true,
  )
}

/** Ảnh món nếu có, không có thì dùng emoji trên nền gradient. */
function dishMedia(dish, { emoji = 'product-emoji', photo = 'product-photo', alt = '' } = {}) {
  return `
    <span class="${emoji}" aria-hidden="true"${dish.image ? ' hidden' : ''}>${escapeHtml(dish.emoji)}</span>
    ${
      dish.image
        ? `<img class="${photo}" src="${escapeHtml(dish.image)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
        : ''
    }`
}

function productCard(dish) {
  const status = DISH_STATUS[dish.status] ?? DISH_STATUS.available
  const soldOut = dish.status === 'unavailable'
  const inCart = cart.getItems().find((item) => item.dishId === dish.id)
  const hasDiscount = dish.originalPrice > dish.price
  const discount = hasDiscount
    ? Math.round((1 - dish.price / dish.originalPrice) * 100)
    : 0
  const rating = dish.rating || DEFAULT_RATING

  return `
    <article class="product${soldOut ? ' is-soldout' : ''}">
      <div class="product-media" style="background:${accentOf(dish.accent).css}">
        ${dishMedia(dish, { alt: dish.name })}
        ${discount ? `<span class="product-discount">-${discount}%</span>` : ''}
        <span class="product-status">${status.label}</span>
        ${inCart ? `<span class="product-incart" title="Trong giỏ">${inCart.qty}</span>` : ''}
      </div>

      <div class="product-body">
        <h3 class="product-name">${escapeHtml(dish.name)}</h3>

        <div class="product-rating">
          <svg viewBox="0 0 24 24" class="star" aria-hidden="true"><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8L12 3Z" /></svg>
          <b>${rating.toFixed(1)}</b>
          <span>(${dish.ratingCount} đánh giá)</span>
        </div>

        <p class="product-desc">${escapeHtml(dish.description)}</p>

        ${
          dish.tags.length
            ? `<div class="product-tags">${dish.tags
                .map(
                  (tag) =>
                    `<span class="tag tag-${(DISH_TAGS[tag] ?? {}).tone ?? 'new'}">${(DISH_TAGS[tag] ?? {}).label ?? tag}</span>`,
                )
                .join('')}</div>`
            : ''
        }

        <div class="product-foot">
          <div class="product-price">
            <b>${money(dish.price)}</b>
            ${hasDiscount ? `<s>${money(dish.originalPrice)}</s>` : ''}
          </div>
          <button
            type="button"
            class="add-btn"
            data-add="${dish.id}"
            ${soldOut ? 'disabled' : ''}
            aria-label="Thêm ${escapeHtml(dish.name)} vào giỏ"
          >
            ${soldOut ? '<span aria-hidden="true">—</span>' : '<span aria-hidden="true">+</span>'}
          </button>
        </div>
      </div>
    </article>`
}

function renderMenu() {
  const dishes = visibleDishes()
  const all = db.getDishes()
  const total = all.reduce((sum, dish) => sum + dish.sold, 0)

  dom.heroDishCount.textContent = all.length
  dom.menuSummary.textContent = ui.keyword.trim()
    ? `Tìm thấy ${dishes.length} món cho “${ui.keyword.trim()}”.`
    : `${all.length} món đang sẵn sàng · ${numberFmt.format(total)} lượt bán từ trước đến nay`

  if (!dishes.length) {
    dom.menuGrid.innerHTML = `
      <div class="empty-state">
        <p>Không tìm thấy món nào phù hợp.</p>
        <button type="button" class="btn btn-outline" data-clear="all">Xoá bộ lọc</button>
      </div>`
    return
  }

  dom.menuGrid.innerHTML = dishes.map(productCard).join('')
}

function addToCart(dishId) {
  const dish = db.getDish(dishId)
  if (!dish) {
    toast('Không tìm thấy món này nữa.', 'danger')
    renderMenu()
    return
  }

  const result = cart.add(dishId)
  if (!result.ok) {
    toast(
      result.reason === 'unavailable'
        ? `“${dish.name}” đang tạm ngưng.`
        : 'Không tìm thấy món này nữa.',
      'danger',
    )
    renderMenu()
    return
  }

  if (result.qty >= MAX_QTY_PER_ITEM) {
    toast(`Tối đa ${MAX_QTY_PER_ITEM} phần cho mỗi món.`, 'warn')
  } else {
    toast(`Đã thêm “${dish.name}” vào giỏ.`, 'success')
  }
  renderMenu()
}

/* ------------------------------------------------------------------ cart */

function renderCartBadge() {
  const count = cart.count()
  dom.cartCount.textContent = count
  dom.cartCount.hidden = count === 0
}

function renderCart() {
  const lines = cart.detailed()
  const totals = cart.totals()

  renderCartBadge()

  if (!lines.length) {
    dom.cartBody.innerHTML = `
      <div class="cart-empty">
        <span aria-hidden="true">🛒</span>
        <p>Giỏ hàng đang trống.</p>
        <button type="button" class="btn btn-primary" data-goto-menu>Khám phá thực đơn</button>
      </div>`
    dom.cartTotals.innerHTML = ''
    dom.cartProgress.innerHTML = ''
    dom.cartClear.disabled = true
    dom.cartCheckout.disabled = true
    return
  }

  dom.cartBody.innerHTML = lines
    .map(
      (line) => `
      <div class="cart-line">
        <span class="cart-thumb" style="background:${accentOf(line.dish.accent).css}">${dishMedia(line.dish, {
          emoji: 'cart-thumb-emoji',
          photo: 'cart-thumb-photo',
        })}</span>
        <div class="cart-line-info">
          <strong>${escapeHtml(line.dish.name)}</strong>
          <span class="cart-line-price">${money(line.dish.price)}</span>
          ${
            line.available
              ? ''
              : '<span class="cart-line-warn">Món đang tạm ngưng, hãy bỏ khỏi giỏ.</span>'
          }
        </div>
        <div class="qty">
          <button type="button" data-step="-1" data-id="${line.dish.id}" aria-label="Giảm số lượng">&minus;</button>
          <input type="number" min="0" max="${MAX_QTY_PER_ITEM}" value="${line.qty}" data-qty="${line.dish.id}" aria-label="Số lượng ${escapeHtml(line.dish.name)}" />
          <button type="button" data-step="1" data-id="${line.dish.id}" aria-label="Tăng số lượng">+</button>
        </div>
        <strong class="cart-line-total">${money(line.lineTotal)}</strong>
        <button type="button" class="icon-btn" data-remove="${line.dish.id}" aria-label="Xoá ${escapeHtml(line.dish.name)}">&times;</button>
      </div>`,
    )
    .join('')

  dom.cartProgress.innerHTML =
    totals.shipping === 0
      ? `<p class="free-shipping">Bạn được miễn phí giao hàng cho đơn này.</p>`
      : `<p>Mua thêm <b>${money(totals.missingShipping)}</b> để được miễn phí giao hàng từ ${money(FREE_SHIPPING_THRESHOLD)}.</p>
         <div class="progress"><span style="width:${Math.min(100, Math.round((totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100))}%"></span></div>`

  dom.cartTotals.innerHTML = `
    <div><dt>Tạm tính (${plural(totals.count, 'món')})</dt><dd>${money(totals.subtotal)}</dd></div>
    <div><dt>Phí giao hàng</dt><dd>${totals.shipping === 0 ? 'Miễn phí' : money(totals.shipping)}</dd></div>
    <div class="grand"><dt>Tổng cộng</dt><dd>${money(totals.grand)}</dd></div>`

  dom.cartClear.disabled = false
  dom.cartCheckout.disabled = totals.missingForCheckout > 0

  if (totals.missingForCheckout > 0) {
    dom.cartCheckout.title = `Còn ${plural(totals.missingForCheckout, 'món')} đang tạm ngưng.`
  } else {
    dom.cartCheckout.removeAttribute('title')
  }

  $$('[data-step]', dom.cartBody).forEach((button) => {
    button.addEventListener('click', () => {
      const qty = cart.getItems().find((item) => item.dishId === button.dataset.id)?.qty ?? 0
      changeQty(button.dataset.id, qty + Number(button.dataset.step))
    })
  })

  $$('[data-qty]', dom.cartBody).forEach((input) => {
    input.addEventListener('change', () => changeQty(input.dataset.qty, input.value))
  })

  $$('[data-remove]', dom.cartBody).forEach((button) => {
    button.addEventListener('click', () => {
      cart.remove(button.dataset.remove)
      renderMenu()
      renderCart()
    })
  })
}

function changeQty(dishId, next) {
  const result = cart.setQty(dishId, next)
  if (!result.ok && result.reason === 'unavailable') {
    toast('Món này đang tạm ngưng, không thể đặt.', 'danger')
  }
  renderMenu()
  renderCart()
}

function openCart() {
  renderCart()
  if (!isOpen(dom.cartDrawer)) openLayer(dom.cartDrawer)
}

/* -------------------------------------------------------------- checkout */

function openCheckout() {
  if (!cart.count()) {
    toast('Giỏ hàng đang trống.', 'warn')
    return
  }

  const totals = cart.totals()
  if (totals.missingForCheckout > 0) {
    toast('Hãy bỏ món đang tạm ngưng khỏi giỏ.', 'danger')
    return
  }

  dom.checkoutSummary.innerHTML = `
    <div class="checkout-head">
      <strong>${plural(totals.count, 'món')}</strong>
      <span>Tạm tính <b>${money(totals.subtotal)}</b> + giao hàng <b>${totals.shipping === 0 ? 'miễn phí' : money(totals.shipping)}</b></span>
    </div>
    <ul>
      ${cart
        .detailed()
        .map(
          (line) =>
            `<li><span>${line.qty}× ${escapeHtml(line.dish.name)}</span><b>${money(line.lineTotal)}</b></li>`,
        )
        .join('')}
    </ul>
    <div class="checkout-grand">Tổng thanh toán <b>${money(totals.grand)}</b></div>`

  const user = auth.getUser()
  if (user) {
    dom.checkoutForm.customer.value = user.name
    if (user.phone) dom.checkoutForm.phone.value = user.phone
  }

  dom.checkoutError.hidden = true
  closeLayer(dom.cartDrawer)
  openLayer(dom.checkoutModal)
  dom.checkoutForm.customer.focus()
}

function showFormError(form, message) {
  const box = $('.form-error', form)
  box.textContent = message
  box.hidden = false
}

function clearFormError(form) {
  const box = $('.form-error', form)
  box.hidden = true
  box.textContent = ''
}

function submitCheckout(event) {
  event.preventDefault()
  clearFormError(dom.checkoutForm)

  const payload = cart.checkoutPayload()
  if (!payload) {
    showFormError(dom.checkoutForm, 'Giỏ hàng đang trống.')
    return
  }

  const form = new FormData(dom.checkoutForm)
  const user = auth.getUser()

  try {
    const order = db.createOrder({
      customer: form.get('customer'),
      phone: form.get('phone'),
      address: form.get('address'),
      note: form.get('note'),
      payment: form.get('payment'),
      items: payload.items,
      shipping: payload.shipping,
      userId: user?.id ?? null,
    })

    cart.clear()
    renderMenu()
    renderCart()

    dom.checkoutForm.reset()
    closeLayer(dom.checkoutModal)

    dom.successCode.textContent = `Mã đơn ${order.id}`
    dom.successDetail.textContent = `${plural(
      order.items.reduce((sum, item) => sum + item.qty, 0),
      'món',
    )} · ${money(
      order.items.reduce((sum, item) => sum + item.price * item.qty, 0) + order.shipping,
    )} · ${timeAgo(order.createdAt)}`
    openLayer(dom.successModal)
  } catch (error) {
    showFormError(dom.checkoutForm, error.message)
  }
}

/* ------------------------------------------------------------------ auth */

function renderAccount() {
  const user = auth.getUser()
  const signedIn = Boolean(user)

  dom.tabs.hidden = signedIn
  dom.accountPanel.hidden = !signedIn

  if (!signedIn) {
    dom.accountLabel.textContent = 'Đăng nhập'
    dom.authModal.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.hidden = panel.id !== 'login-form'
    })
    $$('.tab', dom.tabs).forEach((tab) =>
      tab.classList.toggle('active', tab.dataset.tab === 'login'),
    )
    renderMyOrders()
    return
  }

  dom.accountLabel.textContent = user.name.split(' ').slice(-1)[0]
  dom.accountAvatar.textContent = user.name.trim().charAt(0).toUpperCase() || 'C'
  dom.accountName.textContent = user.name
  dom.accountEmail.textContent = user.email
  dom.accountRole.hidden = user.role !== 'admin'
  dom.adminLink.hidden = user.role !== 'admin'
  dom.profileForm.name.value = user.name
  dom.profileForm.phone.value = user.phone ?? ''

  dom.authModal.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = true
  })
  renderMyOrders()
}

function renderMyOrders() {
  const user = auth.getUser()
  if (!user) {
    dom.myOrders.innerHTML = ''
    return
  }

  const mine = db.getOrders().filter((order) => order.userId === user.id).slice(0, 3)

  if (!mine.length) {
    dom.myOrders.innerHTML = '<p class="muted">Bạn chưa có đơn hàng nào.</p>'
    return
  }

  dom.myOrders.innerHTML = `
    <h4>Đơn gần đây</h4>
    ${mine
      .map((order) => {
        const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending
        const total = order.items.reduce(
          (sum, item) => sum + item.price * item.qty,
          order.shipping,
        )
        return `
          <div class="my-order">
            <strong>${order.id}</strong>
            <span class="badge badge-${status.tone}">${status.label}</span>
            <span class="muted">${plural(
              order.items.reduce((sum, item) => sum + item.qty, 0),
              'món',
            )} · ${money(total)}</span>
            <span class="muted">${timeAgo(order.createdAt)}</span>
          </div>`
      })
      .join('')}`
}

function openAuth(tab = 'login') {
  clearFormError(dom.loginForm)
  clearFormError(dom.registerForm)
  renderAccount()

  if (!auth.getUser()) {
    dom.authTitle.textContent = tab === 'register' ? 'Đăng ký tài khoản' : 'Đăng nhập'
    $$('.tab', dom.tabs).forEach((item) =>
      item.classList.toggle('active', item.dataset.tab === tab),
    )
    dom.loginForm.hidden = tab !== 'login'
    dom.registerForm.hidden = tab !== 'register'
  } else {
    dom.authTitle.textContent = 'Tài khoản của tôi'
  }

  openLayer(dom.authModal)
}
async function submitLogin(event) {
  event.preventDefault()
  const form = new FormData(dom.loginForm)
  clearFormError(dom.loginForm)

  const button = $('button[type="submit"]', dom.loginForm)
  button.disabled = true
  button.textContent = 'Đang kiểm tra...'

  try {
    const user = await auth.login({
      email: form.get('email'),
      password: form.get('password'),
    })
    dom.loginForm.reset()
    closeLayer(dom.authModal)
    toast(`Chào ${user.name}!`, 'success')
  } catch (error) {
    showFormError(dom.loginForm, error.message)
  } finally {
    button.disabled = false
    button.textContent = 'Đăng nhập'
  }
}

async function submitRegister(event) {
  event.preventDefault()
  const form = new FormData(dom.registerForm)
  clearFormError(dom.registerForm)

  const button = $('button[type="submit"]', dom.registerForm)
  button.disabled = true
  button.textContent = 'Đang tạo...'

  try {
    const user = await auth.register({
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      password: form.get('password'),
      confirm: form.get('confirm'),
    })
    dom.registerForm.reset()
    closeLayer(dom.authModal)
    toast(`Đăng ký thành công. Chào ${user.name}!`, 'success')
  } catch (error) {
    showFormError(dom.registerForm, error.message)
  } finally {
    button.disabled = false
    button.textContent = 'Tạo tài khoản'
  }
}

function submitProfile(event) {
  event.preventDefault()
  const form = new FormData(dom.profileForm)
  clearFormError(dom.profileForm)

  try {
    const user = auth.updateProfile({
      name: form.get('name'),
      phone: form.get('phone'),
    })
    toast('Đã cập nhật hồ sơ.', 'success')
    renderAccount()
    void user
  } catch (error) {
    showFormError(dom.profileForm, error.message)
  }
}

function logout() {
  auth.logout()
  closeLayer(dom.authModal)
  toast('Đã đăng xuất.', 'brand')
  renderMenu()
}

/* ------------------------------------------------------------------ init */

function cacheDom() {
  Object.assign(dom, {
    locationBtn: $('#location-btn'),
    locationMenu: $('#location-menu'),
    locationLabel: $('#location-label'),
    search: $('#header-search'),
    searchClear: $('#search-clear'),
    categoryRow: $('#category-row'),
    sortTabs: $('#sort-tabs'),
    menuSummary: $('#menu-summary'),
    activeFilters: $('#active-filters'),
    menuGrid: $('#menu-grid'),
    heroDishCount: $('#hero-dish-count'),
    cartBtn: $('#cart-btn'),
    cartClose: $('#cart-close'),
    cartCount: $('#cart-count'),
    cartDrawer: $('#cart-drawer'),
    cartBody: $('#cart-body'),
    cartTotals: $('#cart-totals'),
    cartProgress: $('#cart-progress'),
    cartClear: $('#cart-clear'),
    cartCheckout: $('#cart-checkout'),
    checkoutModal: $('#checkout-modal'),
    checkoutForm: $('#checkout-form'),
    checkoutSummary: $('#checkout-summary'),
    checkoutError: $('#checkout-error'),
    accountBtn: $('#account-btn'),
    accountLabel: $('#account-label'),
    authModal: $('#auth-modal'),
    authTitle: $('#auth-title'),
    authHint: $('#auth-hint'),
    tabs: $('#auth-tabs'),
    loginForm: $('#login-form'),
    registerForm: $('#register-form'),
    accountPanel: $('#account-panel'),
    accountAvatar: $('#account-avatar'),
    accountName: $('#account-name'),
    accountEmail: $('#account-email'),
    accountRole: $('#account-role'),
    adminLink: $('#admin-link'),
    profileForm: $('#profile-form'),
    myOrders: $('#my-orders'),
    logoutBtn: $('#logout-btn'),
    successModal: $('#success-modal'),
    successCode: $('#success-code'),
    successDetail: $('#success-detail'),
    overlay: $('#overlay'),
    toasts: $('#toasts'),
  })
}

function renderLocation() {
  dom.locationLabel.textContent = ui.location
  dom.locationMenu.innerHTML = LOCATIONS.map(
    (name) => `
      <button type="button" class="location-item" role="option"
        aria-selected="${name === ui.location}" data-location="${escapeHtml(name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
        <span>${escapeHtml(name)}</span>
        ${name === ui.location ? '<i aria-hidden="true">✓</i>' : ''}
      </button>`,
  ).join('')
}

function toggleLocationMenu(force) {
  const open = force ?? dom.locationMenu.hidden
  dom.locationMenu.hidden = !open
  dom.locationBtn.setAttribute('aria-expanded', String(open))
}

function bindEvents() {
  watchBrokenImages()

  /* Nút thêm giỏ dùng chung cho thẻ món và banner khuyến mãi. */
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add]')
    if (button && !button.disabled) addToCart(button.dataset.add)
  })

  dom.locationBtn.addEventListener('click', () => toggleLocationMenu())
  dom.locationMenu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-location]')
    if (!item) return
    ui.location = item.dataset.location
    renderLocation()
    toggleLocationMenu(false)
    toast(`Giao đến ${ui.location}.`, 'brand')
  })

  dom.search.addEventListener('input', (event) => {
    ui.keyword = event.target.value
    dom.searchClear.hidden = !ui.keyword
    renderActiveFilters()
    renderMenu()
  })

  dom.searchClear.addEventListener('click', () => {
    dom.search.value = ''
    ui.keyword = ''
    dom.searchClear.hidden = true
    renderActiveFilters()
    renderMenu()
  })

  dom.categoryRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]')
    if (!button) return
    ui.activeCategory = button.dataset.category
    renderCategories()
    renderActiveFilters()
    renderMenu()
  })

  dom.sortTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sort]')
    if (!button) return
    ui.sort = button.dataset.sort
    $$('[data-sort]', dom.sortTabs).forEach((item) => {
      const on = item === button
      item.classList.toggle('active', on)
      item.setAttribute('aria-pressed', String(on))
    })
    renderMenu()
  })

  const clearFilter = (key) => {
    if (key === 'category' || key === 'all') ui.activeCategory = 'all'
    if (key === 'keyword' || key === 'all') {
      ui.keyword = ''
      dom.search.value = ''
      dom.searchClear.hidden = true
    }
    renderCategories()
    renderActiveFilters()
    renderMenu()
  }

  dom.activeFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-clear]')
    if (button) clearFilter(button.dataset.clear)
  })

  /* Nút "Xoá bộ lọc" nằm trong thẻ rỗng của lưới món. */
  dom.menuGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-clear]')
    if (button) clearFilter(button.dataset.clear)
  })

  dom.cartBtn.addEventListener('click', openCart)
  dom.cartClose.addEventListener('click', () => closeLayer(dom.cartDrawer))
  dom.accountBtn.addEventListener('click', () => openAuth('login'))
  dom.overlay.addEventListener('click', closeAll)

  dom.cartBody.addEventListener('click', (event) => {
    if (event.target.closest('[data-goto-menu]')) {
      closeLayer(dom.cartDrawer)
      $('#menu').scrollIntoView({ behavior: 'smooth' })
    }
  })

  dom.cartClear.addEventListener('click', () => {
    cart.clear()
    renderMenu()
    renderCart()
    toast('Đã xoá giỏ hàng.', 'brand')
  })

  dom.cartCheckout.addEventListener('click', openCheckout)
  dom.checkoutForm.addEventListener('submit', submitCheckout)

  $$('[data-close]', document).forEach((button) =>
    button.addEventListener('click', () => closeLayer(button.closest('.modal'))),
  )

  dom.tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]')
    if (!tab) return
    dom.loginForm.hidden = tab.dataset.tab !== 'login'
    dom.registerForm.hidden = tab.dataset.tab !== 'register'
    $$('.tab', dom.tabs).forEach((item) => item.classList.toggle('active', item === tab))
  })

  dom.loginForm.addEventListener('submit', submitLogin)
  dom.registerForm.addEventListener('submit', submitRegister)
  dom.profileForm.addEventListener('submit', submitProfile)
  dom.logoutBtn.addEventListener('click', logout)

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAll()
      toggleLocationMenu(false)
    }
  })
}

export async function startShop() {
  cacheDom()
  bindEvents()

  /* Vẽ cửa hàng trước, không phụ thuộc vào phiên đăng nhập. */
  renderLocation()
  renderCategories()
  renderActiveFilters()
  renderMenu()
  renderCart()
  renderAccount()

  try {
    await auth.init()
  } catch (error) {
    console.error('[CBM FOOD] Không khởi tạo được phiên đăng nhập:', error)
    dom.authHint.hidden = false
    dom.authHint.textContent =
      'Trình duyệt đang chạy không hỗ trợ mã hoá an toàn, nên tính năng tài khoản tạm thời không dùng được. ' +
      'Bạn vẫn có thể đặt món bình thường. Hãy mở bằng "npm run dev" (localhost) hoặc HTTPS.'
  }

  renderAccount()

  db.subscribe(() => {
    renderCategories()
    renderMenu()
  })
  cart.subscribe(renderCart)
  auth.subscribe(renderAccount)
}
