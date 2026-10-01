import './style.css'
import * as db from './store.js'
import * as auth from './auth.js'
import * as cart from './cart.js'
import { filterDishes } from './search.js'
import {
  cartEmptyHtml,
  cartLinesHtml,
  summaryHtml,
} from './cart-view.js'

const $ = (sel) => document.querySelector(sel)
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`
const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const app = $('#app')

/* =========================
   KHUNG TRANG
========================= */

const shell = () => `
<header class="site-header">
  <div class="container header-inner">

    <a href="#home" class="brand">
      <img src="/logo.png" alt="CBM FOOD" class="brand-logo" />
      <span class="brand-name">CBM FOOD</span>
    </a>

    <nav class="main-nav" aria-label="Menu chính">
      <a href="#home" class="active">Trang chủ</a>
      <a href="#menu">Thực đơn</a>
      <a href="#about">Giới thiệu</a>
      <a href="#contact">Liên hệ</a>
    </nav>

    <div class="header-actions">
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          id="dishSearch"
          placeholder="Tìm món ăn..."
          aria-label="Tìm món ăn"
          autocomplete="off"
        />
        <button type="button" class="search-clear" id="searchClear" aria-label="Xoá từ khoá" hidden>✕</button>
      </div>

      <button class="btn btn-outline btn-login" data-auth="login">
        Đăng nhập
      </button>

      <a href="/admin.html" class="btn btn-outline btn-admin">
        Quản trị
      </a>

      <button type="button" class="btn btn-primary btn-cart" data-action="open-cart"
        aria-label="Mở giỏ hàng">
        Giỏ hàng
        <span class="cart-badge" id="cartBadge" hidden>0</span>
      </button>
    </div>

  </div>
</header>

<!-- Giỏ hàng không nằm trong dòng trang nữa: nó trượt từ phải, phủ một
     lớp mờ toàn màn hình. Lớp phủ z-index thấp hơn nên chỉ nhận cú click đóng,
     mọi cú click trong giỏ vẫn rơi vào sidebar. -->
<div id="cartOverlay" class="cart-overlay" data-action="close-cart" hidden></div>

<aside id="cart" class="cart-sidebar" role="dialog" aria-modal="true"
  aria-labelledby="cartTitle" hidden>
  <div class="cart-sidebar-head">
    <div class="cart-sidebar-title">
      <p class="eyebrow">Đơn của bạn</p>
      <h2 id="cartTitle">Giỏ hàng</h2>
    </div>
    <button type="button" class="cart-sidebar-close" data-action="close-cart"
      aria-label="Đóng giỏ hàng">&times;</button>
  </div>
  <div id="cartBody" class="cart-sidebar-body"></div>
</aside>

<main>

<section id="home" class="hero">
  <div class="container hero-grid">

    <div class="hero-content">
      <p class="eyebrow">Nhà hàng CBM FOOD</p>
      <h1>
        Ăn ngon,<br>
        giao tận nơi trong <em>30 phút</em>
      </h1>
      <p class="hero-sub">
        Thực đơn tươi ngon mỗi ngày từ những nguyên liệu sạch,
        chế biến bởi đầu bếp giàu kinh nghiệm.
      </p>
      <div class="hero-actions">
        <a href="#menu" class="btn btn-primary btn-lg">Xem thực đơn</a>
        <button class="btn btn-outline btn-lg" data-auth="register">Tạo tài khoản</button>
      </div>
    </div>

    <div class="hero-art">
      <div class="hero-card hero-card-main">
        <img
          src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=90"
          alt="Món ăn tươi ngon CBM FOOD"
        />
        <div class="hero-overlay">
          <strong>CBM FOOD</strong>
          <span>Đồ ăn ngon cho mọi nhà</span>
        </div>
      </div>
      <div class="hero-card hero-card-mini">
        <strong>4.9</strong>
        <span>Đánh giá từ 12.000+ khách hàng</span>
      </div>
      <div class="hero-card hero-card-tag">
        <strong>30'</strong>
        <span>Giao nhanh</span>
      </div>
    </div>

  </div>
</section>

<section class="features">
  <div class="container features-grid">
    <div class="feature">
      <span class="feature-icon feature-fast">⚡</span>
      <div>
        <h3>Giao trong 30 phút</h3>
        <p>Shipper riêng, đóng gói nhiệt giữ nhiệt chính hãnh.</p>
      </div>
    </div>
    <div class="feature">
      <span class="feature-icon feature-leaf">🌿</span>
      <div>
        <h3>Nguyên liệu tươi sạch</h3>
        <p>Chọn lọc từ nhà cung ứ uy tín mỗi sáng.</p>
      </div>
    </div>
    <div class="feature">
      <span class="feature-icon feature-wallet">💳</span>
      <div>
        <h3>Thanh toán tiện nhất</h3>
        <p>Ứng dụng hoàn tiền, giảm giá mỗi tuần.</p>
      </div>
    </div>
  </div>
</section>

<section class="promo-banner">
  <div class="container promo-inner">
    <div class="promo-content">
      <span class="promo-badge">ƯU ĐÃI HÈM NAY</span>
      <h2>Giảm <strong>20%</strong> cho đơn hàng đầu tiên</h2>
      <p>Nhập mã <b>CBM20</b> khi đặt món. Áp dụng cho đơn từ 100.000đ.</p>
      <a href="#menu" class="btn btn-primary">Đặt món ngay</a>
    </div>
    <div class="promo-art">
      <span>20%</span>
      <small>OFF</small>
    </div>
  </div>
</section>

<section id="menu" class="menu">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Thực đơn hôm nay</p>
      <h2>Món ăn được yêu thích nhất</h2>
      <p>Những món ăn được khách hàng của chúng tôi lựa chọn nhiều nhất.</p>
    </div>

    <div class="menu-toolbar">
      <div class="category-filter" id="categoryFilter"></div>
      <p class="result-count" id="resultCount" role="status" aria-live="polite"></p>
    </div>

    <div class="dish-grid" id="dishGrid"></div>
  </div>
</section>

<!-- Giỏ hàng nằm ngay trong dòng trang: không lớp phủ, không position:fixed,
     không z-index, nên không thể bị làm mờ hay che mất cú click. -->
<section id="about" class="about">
  <div class="container about-grid">
    <div class="about-art">
      <div class="about-photo">
        <img
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85"
          alt="Không gian nhà hàng"
        />
      </div>
      <div class="about-stat">
        <span class="about-count">12.000+</span>
        <span class="about-label">Đơn hàng đã giao</span>
      </div>
      <div class="about-stat">
        <span class="about-count">${db.listDishes().length}</span>
        <span class="about-label">Món ăn trong thực đơn</span>
      </div>
    </div>
    <div class="about-content">
      <p class="eyebrow">Về chúng tôi</p>
      <h2>Chuẩn vị truyền thống, hiện đại trong từng chi tiết</h2>
      <p>
        CBM FOOD mang đến những món ăn thơm ngon, đậm đà hương vị đặc trưng
        của miền đất và cộng đồng bản địa. Mỗi món ăn đều được kiểm soát chặt
        lẽ với nguyên liệu tươi và kỹ thuật trình bày.
      </p>
      <a href="#menu" class="btn btn-primary">Khám phá thực đơn</a>
    </div>
  </div>
</section>

<section id="contact" class="cta">
  <div class="container cta-box">
    <h2>Sẵn sàng thưởng thức món ngon?</h2>
    <p>Đăng nhập để lưu thông tin và đặt món nhanh hơn.</p>
    <div class="hero-actions">
      <button class="btn btn-light btn-lg" data-auth="login">Đăng nhập</button>
      <button class="btn btn-outline-light btn-lg" data-auth="register">Đăng ký miễn phí</button>
    </div>
  </div>
</section>

</main>

<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a href="#home" class="brand">
        <img src="/logo.png" alt="CBM FOOD" class="brand-logo" />
        <span class="brand-name">CBM FOOD</span>
      </a>
      <p>Ăn ngon, giao nhanh mỗi ngày. Cùng CBM để bạn tin tưởng lựa chọn.</p>
    </div>
    <nav class="footer-col">
      <h4>Liên kết</h4>
      <a href="#home">Trang chủ</a>
      <a href="#menu">Thực đơn</a>
      <a href="#about">Giới thiệu</a>
      <a href="#contact">Liên hệ</a>
      <a href="/admin.html">Trang quản trị</a>
    </nav>
    <div class="footer-col">
      <h4>Liên hệ</h4>
      <p>123 Nguyễn Huệ, Quận 1, TP.HCM</p>
      <p>Hotline: 1900 1234</p>
      <p>Email: hotro@cbmfood.vn</p>
    </div>
    <div class="footer-col">
      <h4>Giờ mở cửa</h4>
      <p>Thứ 2 - Chủ nhật</p>
      <p>08:00 - 22:00</p>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>© 2026 CBM FOOD. All rights reserved.</p>
  </div>
</footer>

<div id="ui-root"></div>
`

app.innerHTML = shell()

/* =========================
   THỰC ĐƠN
========================= */

const dishGrid = $('#dishGrid')
const filterBox = $('#categoryFilter')
const searchInput = $('#dishSearch')
const searchClear = $('#searchClear')
const resultCount = $('#resultCount')

const state = { category: 'all', cartOpen: false, checkout: false }

const dishCard = (dish, index) => {
  const soldOut = dish.status === 'unavailable'
  const art = dish.image
    ? `<img src="${escape(dish.image)}" alt="${escape(dish.name)}" loading="lazy" />`
    : `<span class="dish-emoji">${escape(dish.emoji)}</span>`
  return `
    <article class="dish" data-category="${escape(dish.category)}">
      <div class="dish-art">
        ${art}
        <span class="dish-number">${String(index + 1).padStart(2, '0')}</span>
        ${
          soldOut
            ? '<span class="dish-flag is-off">Tạm ngưng</span>'
            : dish.status === 'runningOut'
              ? '<span class="dish-flag is-warn">Sắp hết</span>'
              : ''
        }
      </div>
      <h3>${escape(dish.name)}</h3>
      <p class="dish-desc">${escape(dish.description)}</p>
      <div class="dish-tags">
        ${dish.tags.map((t) => `<span class="dish-tag">${escape(t)}</span>`).join('')}
      </div>
      <div class="dish-foot">
        <span class="price">${money(dish.price)}</span>
        <button type="button" class="btn btn-sm btn-primary order-btn"
          data-add="${escape(dish.code)}" ${soldOut ? 'disabled' : ''}>
          ${soldOut ? 'Tạm ngưng' : 'Đặt ngay'}
        </button>
      </div>
    </article>`
}

const renderCategories = () => {
  filterBox.innerHTML = [
    '<button class="category-btn active" data-category="all">Tất cả</button>',
    ...db.CATEGORIES.map(
      (cat) =>
        `<button class="category-btn" data-category="${escape(cat.id)}">${escape(cat.name)}</button>`,
    ),
  ].join('')
}

const dishName = (id) => db.CATEGORIES.find((c) => c.id === id)?.name ?? ''

const renderDishes = () => {
  const all = db.listDishes()
  const rows = filterDishes(
    all,
    { category: state.category, query: state.query },
    db.CATEGORIES,
  )

  dishGrid.innerHTML = rows.length
    ? rows.map(dishCard).join('')
    : `<p class="muted empty-state">
         Không tìm thấy món nào${state.query.trim() ? ` cho "<b>${escape(state.query)}</b>"` : ''}.
         <button type="button" class="btn btn-ghost btn-sm" data-action="reset-filter">Xem tất cả</button>
       </p>`

  filterBox.querySelectorAll('.category-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === state.category)
  })

  const scope = state.category === 'all' ? 'món' : dishName(state.category)
  resultCount.textContent = `Hiển thị ${rows.length}/${all.length} ${scope}`
  resultCount.classList.toggle('is-empty', rows.length === 0)
  searchClear.hidden = !state.query
}

const resetFilter = () => {
  state.query = ''
  state.category = 'all'
  searchInput.value = ''
  renderDishes()
}

/* =========================
   GIAO DIỆN PHỦ
========================= */

const ui = $('#ui-root')
let lastFocused = null

/* Toast nằm ngoài #ui-root để không bị xoá mỗi lần vẽ lại giỏ hoặc hộp thoại. */
const toastHost = document.createElement('div')
toastHost.className = 'toast-host'
document.body.append(toastHost)

const toast = (message, tone = '') => {
  const node = document.createElement('div')
  node.className = `toast ${tone === 'err' ? 'is-err' : ''}`.trim()
  node.textContent = message
  toastHost.append(node)
  setTimeout(() => node.remove(), 3000)
}

const closePanels = () => {
  ui.innerHTML = ''
  syncScrollLock()
  lastFocused?.focus?.()
  lastFocused = null
}

const renderBadge = () => {
  const badge = $('#cartBadge')
  const total = cart.count()
  badge.textContent = String(total)
  badge.hidden = total === 0
}

/* =========================
   GIỎ HÀNG
   Giỏ là một hộp thoại trượt từ phải kèm lớp phủ mờ. Lớp phủ nằm dưới
   sidebar nên nhấn vào vùng tối sẽ đóng giỏ, còn mọi thao tác trong giỏ
   không bị chặn.
========================= */

const cartPanel = $('#cart')
const cartOverlay = $('#cartOverlay')
const cartBody = $('#cartBody')
let cartReturnFocus = null

/* Khóa cuộn trang khi hộp thoại đang mở. Cả đăng nhập và giỏ đều dùng
   chung một trạng thái để không mở hai thứ cùng lúc. */
const syncScrollLock = () => {
  const locked = state.cartOpen || Boolean(ui.innerHTML)
  document.body.style.overflow = locked ? 'hidden' : ''
}

const checkoutFormHtml = () => {
  const user = auth.getUser()
  return `
    <form id="checkoutForm" class="cart-form" novalidate>
      <h3 class="cart-form-title">Thông tin giao hàng</h3>
      <label class="field">
        <span>Người nhận *</span>
        <input name="name" value="${escape(user?.name ?? '')}" required />
      </label>
      <label class="field">
        <span>Số điện thoại *</span>
        <input name="phone" value="${escape(user?.phone ?? '')}" inputmode="numeric" required />
      </label>
      <label class="field">
        <span>Địa chỉ *</span>
        <textarea name="address" required></textarea>
      </label>
      <label class="field">
        <span>Ghi chú</span>
        <textarea name="note"></textarea>
      </label>
      <p class="form-error" id="checkoutError" role="alert" hidden></p>
      <div class="cart-form-actions">
        <button type="submit" class="btn btn-primary">Đặt món</button>
        <button type="button" class="btn btn-ghost" data-action="cancel-checkout">Quay lại giỏ</button>
      </div>
    </form>`
}

const renderCart = () => {
  const lines = cart.list()
  const sub = cart.subtotal()
  const ship = cart.shipping(sub)

  if (!lines.length) {
    cartBody.innerHTML = `
      ${cartEmptyHtml()}
      <div class="cart-actions is-center">
        <button type="button" class="btn btn-primary" data-action="browse-menu">Xem thực đơn</button>
      </div>`
    return
  }

  const summaryBlock = summaryHtml({ subtotal: sub, shipping: ship, total: sub + ship })

  cartBody.innerHTML = state.checkout
    ? `<div class="cart-review">
         <h3 class="cart-review-title">Đơn của bạn</h3>
         ${cartLinesHtml(lines, { editable: false })}
         <div class="cart-review-total">${summaryBlock}</div>
       </div>
       ${checkoutFormHtml()}`
    : `${cartLinesHtml(lines, { maxQty: cart.MAX_QTY })}
       <div class="cart-summary">
         ${summaryBlock}
         <p class="cart-hint">Tối đa ${cart.MAX_QTY} phần cho mỗi món.</p>
         <div class="cart-actions">
           <button type="button" class="btn btn-primary" data-action="checkout">Thanh toán</button>
           <button type="button" class="btn btn-ghost" data-action="clear-cart">Xoá giỏ</button>
         </div>
       </div>`
}

const showCart = () => {
  cartReturnFocus = document.activeElement
  cartOverlay.hidden = false
  cartPanel.hidden = false
  state.cartOpen = true
  state.checkout = false
  syncScrollLock()
  renderCart()
  cartBody.scrollTop = 0
  cartPanel.querySelector('.cart-sidebar-close')?.focus()
}

const hideCart = ({ restoreFocus = true } = {}) => {
  if (!state.cartOpen) return
  cartOverlay.hidden = true
  cartPanel.hidden = true
  state.cartOpen = false
  state.checkout = false
  syncScrollLock()
  if (restoreFocus) cartReturnFocus?.focus?.()
  cartReturnFocus = null
}

const openCheckout = () => {
  if (!cart.list().length) return toast('Giỏ hàng đang trống', 'err')
  state.checkout = true
  renderCart()
}

const openAuth = (mode = 'login') => {
  lastFocused = document.activeElement
  const user = auth.getUser()
  if (user && mode === 'login') {
    ui.innerHTML = `
      <div class="sheet-backdrop" data-close>
        <div class="sheet" role="dialog" aria-modal="true">
          <header class="sheet-head"><h2>Tài khoản</h2>
            <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
          </header>
          <div class="sheet-body">
            <p>Đang đăng nhập với <b>${escape(user.name)}</b> (${escape(user.email)}).</p>
            ${
              user.role === 'admin'
                ? '<a class="btn btn-primary btn-block" href="/admin.html">Vào trang quản trị</a>'
                : ''
            }
            <button type="button" class="btn btn-ghost btn-block" data-action="logout">Đăng xuất</button>
          </div>
        </div>
      </div>`
    return
  }

  ui.innerHTML = `
    <div class="sheet-backdrop" data-close>
      <div class="sheet" role="dialog" aria-modal="true">
        <header class="sheet-head>
          <h2>${mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
        </header>
        <form id="authForm" novalidate>
          <div class="sheet-body">
            ${
              mode === 'register'
                ? `<label class="field"><span>Họ và tên *</span><input name="name" required /></label>`
                : ''
            }
            <label class="field"><span>Email *</span><input name="email" type="email" required /></label>
            <label class="field"><span>Mật khẩu *</span><input name="password" type="password" minlength="6" required /></label>
            ${
              mode === 'register'
                ? `<label class="field"><span>Nhập lại mật khẩu *</span><input name="confirm" type="password" minlength="6" required /></label>
                   <label class="field"><span>Số điện thoại</span><input name="phone" inputmode="numeric" /></label>`
                : ''
            }
            <p class="form-error" id="authError" role="alert" hidden></p>
            <button type="submit" class="btn btn-primary btn-block">${
              mode === 'login' ? 'Đăng nhập' : 'Đăng ký'
            }</button>
            <button type="button" class="btn btn-ghost btn-block" data-auth="${
              mode === 'login' ? 'register' : 'login'
            }">${mode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}</button>
          </div>
        </form>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

const showAuthError = (message) => {
  const box = $('#authError')
  if (!box) return
  box.textContent = message
  box.hidden = !message
}

const syncLoginButton = () => {
  const user = auth.getUser()
  document.querySelectorAll('.btn-login').forEach((btn) => {
    btn.textContent = user ? user.name.split(' ')[0] : 'Đăng nhập'
  })
}

/* =========================
   SỰ KIỆN
========================= */

document.addEventListener('click', (event) => {
  if (event.target.closest('#searchClear')) {
    event.preventDefault()
    state.query = ''
    searchInput.value = ''
    renderDishes()
    searchInput.focus()
    return undefined
  }



  const addBtn = event.target.closest('[data-add]')
  if (addBtn) {
    const key = addBtn.dataset.add
    const result = cart.add(key, 1)
    if (result.error) return toast(result.error, 'err')
    renderBadge()
    if (state.cartOpen) renderCart()
    return toast(result.atMax ? `Tối đa ${cart.MAX_QTY} phần cho mỗi món` : `Đã thêm ${db.dishNameOf(key)}`)
  }

  const qtyBtn = event.target.closest('[data-qty]')
  if (qtyBtn) {
    const key = qtyBtn.dataset.key
    const result = cart.changeQty(key, Number(qtyBtn.dataset.qty))
    if (result.error) return toast(result.error, 'err')
    renderBadge()
    renderCart()
    if (result.removed) return toast(`Đã bỏ ${result.name}`)
    if (result.atMax) return toast(`Tối đa ${cart.MAX_QTY} phần cho mỗi món`)
    return undefined
  }

  const removeBtn = event.target.closest('[data-remove]')
  if (removeBtn) {
    cart.remove(removeBtn.dataset.remove)
    renderBadge()
    renderCart()
    return undefined
  }

  const authBtn = event.target.closest('[data-auth]')
  if (authBtn) {
    event.preventDefault()
    return openAuth(authBtn.dataset.auth)
  }

  const actionBtn = event.target.closest('[data-action]')
  if (actionBtn) {
    const action = actionBtn.dataset.action

    if (action === 'open-cart') {
      if (state.cartOpen) return hideCart()
      return showCart()
    }
    if (action === 'close-cart') return hideCart()
    if (action === 'checkout') return openCheckout()
    if (action === 'cancel-checkout') {
      state.checkout = false
      renderCart()
      return undefined
    }
    if (action === 'clear-cart') {
      cart.clear()
      renderBadge()
      renderCart()
      return toast('Đã xoá toàn bộ giỏ hàng')
    }
    if (action === 'browse-menu') {
      hideCart({ restoreFocus: false })
      document.querySelector('#menu')?.scrollIntoView({ behavior: 'smooth' })
      return undefined
    }
    if (action === 'logout') {
      auth.logout()
      syncLoginButton()
      closePanels()
      return toast('Đã đăng xuất')
    }
  }

  if (event.target.closest('[data-close]')) return closePanels()

  const categoryBtn = event.target.closest('.category-btn')
  if (categoryBtn) {
    state.category = categoryBtn.dataset.category
    return renderDishes()
  }

  if (event.target.closest('[data-action="reset-filter"]')) return resetFilter()

  return undefined
})

searchInput.addEventListener('input', () => {
  state.query = searchInput.value
  renderDishes()
})

const afterLogin = (user) => {
  toast(`Chào ${user.name}`)
  syncLoginButton()
  closePanels()
  /* Tài khoản quản trị vào thẳng trang admin, khách ở lại trang bán hàng. */
  const landing = auth.landingFor(user)
  if (landing) window.location.href = landing
}

/* Form thanh toán nằm trong sidebar giỏ nên nghe ở cartBody. */
cartBody.addEventListener('submit', (event) => {
  if (event.target.id !== 'checkoutForm') return
  event.preventDefault()
  const data = new FormData(event.target)
  const box = $('#checkoutError')
  const result = db.createOrder({
    customer: {
      name: String(data.get('name') ?? ''),
      phone: String(data.get('phone') ?? ''),
      address: String(data.get('address') ?? ''),
    },
    note: String(data.get('note') ?? ''),
    userId: auth.getUser()?.id ?? null,
    items: cart.list(),
  })
  if (result.error) {
    box.textContent = result.error
    box.hidden = false
    return
  }
  cart.clear()
  renderBadge()
  state.checkout = false
  cartBody.innerHTML = `
    <div class="cart-done">
      <div class="success-mark" aria-hidden="true">✓</div>
      <h3>Đặt món thành công</h3>
      <p>Mã đơn <b>${escape(result.order.code)}</b></p>
      <p class="muted">Tổng thanh toán ${money(result.order.total)}</p>
      <button type="button" class="btn btn-primary" data-action="close-cart">Đóng</button>
    </div>`
  cartBody.scrollTop = 0
})

ui.addEventListener('submit', async (event) => {
  if (event.target.id === 'authForm') {
    event.preventDefault()
    const data = new FormData(event.target)
    showAuthError('')
    const password = String(data.get('password') ?? '')
    const email = String(data.get('email') ?? '')

    if (event.target.querySelector('[name="confirm"]')) {
      if (password !== String(data.get('confirm') ?? '')) {
        showAuthError('Mật khẩu nhập lại không khớp')
        return
      }
      const result = await auth.register({
        name: String(data.get('name') ?? ''),
        email,
        password,
        phone: String(data.get('phone') ?? ''),
      })
      if (result.error) return showAuthError(result.error)
      const loginResult = await auth.login({ email, password })
      if (loginResult.error) return showAuthError(loginResult.error)
      return afterLogin(loginResult.user)
    }

    const result = await auth.login({ email, password })
    if (result.error) return showAuthError(result.error)
    return afterLogin(result.user)
  }
})

document.addEventListener('keydown', (event) => {
  /* Gõ trực tiếp vào ô tìm kiếm mà không cần click chuột. */
  if (
    event.key === '/' &&
    !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')
  ) {
    event.preventDefault()
    searchInput.focus()
    searchInput.select()
    return
  }

  if (event.key !== 'Escape') return
  if (state.cartOpen) {
    hideCart()
    return
  }
  if (ui.innerHTML) {
    closePanels()
    return
  }
  if (state.query) {
    resetFilter()
    searchInput.focus()
  }
})

/* Giỏ là hộp thoại modal nên Tab phải giữ bên trong nó, không chạy ra
   nút bấm phía sau lớp phủ. */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || !state.cartOpen) return
  const focusable = [...cartPanel.querySelectorAll('button:not([disabled]), input, textarea, a[href]')]
    .filter((el) => el.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
})

/* =========================
   KHỞI ĐỘNG
========================= */

async function startShop() {
  try {
    await auth.init()
    renderCategories()
    renderDishes()
    renderBadge()
    syncLoginButton()
    cart.syncWithMenu()
    renderBadge()
    if (state.cartOpen) renderCart()
  } catch (error) {
    console.error('[CBM FOOD] Khởi tạo thất bại:', error)
    dishGrid.innerHTML = '<p class="muted">Không tải được thực đơn. Vui lòng kiểm tra console.</p>'
  }
}

startShop()
