import './style.css'
import * as db from './store.js'
import * as cart from './cart.js'
import * as auth from './auth.js'
import { filterDishes } from './search.js'

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
      <a href="#my-orders">Đơn của tôi</a>
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

      <a href="/shipper.html" class="btn btn-outline btn-admin">
        Shipper
      </a>

      <button class="btn btn-primary btn-cart" data-action="open-cart">
        Giỏ hàng
        <span class="cart-badge" id="cartBadge" hidden>0</span>
      </button>
    </div>

  </div>
</header>

<main>

<section id="home" class="food-banner" aria-label="Banner CBM FOOD">
  <div class="food-banner-inner">
    <div class="food-banner-copy">
      <span class="food-banner-kicker">CBM FOOD</span>
      <h1>Đặt món ngon.<br><strong>Giao nhanh tận nơi.</strong></h1>
      <p>Món ăn nóng hổi, nhiều ưu đãi và giao hàng tận cửa mỗi ngày.</p>
      <div class="food-banner-actions">
        <a href="#menu" class="btn btn-banner-primary">Đặt món ngay</a>
        <a href="#menu" class="banner-link">Xem thực đơn →</a>
      </div>
      <div class="food-banner-trust">
        <span>⚡ Giao nhanh</span><span>🍽️ Món ngon mỗi ngày</span><span>💳 Thanh toán tiện lợi</span>
      </div>
    </div>
    <div class="food-banner-visual" aria-hidden="true">
      <div class="banner-food-circle banner-food-circle-a"></div>
      <div class="banner-food-circle banner-food-circle-b"></div>
      <div class="banner-food-card banner-food-card-main">
        <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1100&q=90" alt="" />
      </div>
      <div class="banner-food-card banner-food-card-small">
        <img src="https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=700&q=90" alt="" />
      </div>
      <div class="banner-rating">★★★★★ <strong>4.9/5</strong> <span>Đánh giá từ khách hàng</span></div>
      <div class="banner-delivery">🛵 <strong>30'</strong><span>Giao nhanh</span></div>
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

<section id="my-orders" class="my-orders">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Theo dõi đơn hàng</p>
      <h2>Đơn của tôi</h2>
      <p>Trạng thái và tiến trình các đơn bạn đã đặt, cập nhật ngay khi nhà hàng xử lý.</p>
    </div>

    <div id="myOrders" aria-live="polite"></div>
  </div>
</section>

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
      <a href="#my-orders">Đơn của tôi</a>
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
<div id="toast-root"></div>
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

const state = { category: 'all' }

/** Dải sao chỉ đọc, dùng để hiện điểm trung bình trên thẻ món. */
const starBar = (rating) => {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  const stars = Array.from(
    { length: db.RATING_MAX },
    (_, i) => `<i class="${i < full ? 'is-on' : i === full && half ? 'is-half' : ''}">★</i>`,
  ).join('')
  return `<span class="stars" role="img" aria-label="${rating} trên ${db.RATING_MAX} sao">${stars}</span>`
}

const dishCard = (dish, index) => {
  const soldOut = !db.isPurchasable(dish)
  const rating = db.dishRating(dish.code)
  const vendor = db.vendorOf(dish.vendorId)
  /* "Chỉ còn N phần" chỉ hiện khi tồn kho có thật và sắp cạn; món không giới hạn
     thì không cần nhắc. */
  const lowStock = dish.stock !== null && dish.stock > 0 && dish.stock <= 5
  const art = dish.image
    ? `<img src="${escape(dish.image)}" alt="${escape(dish.name)}" loading="lazy" />`
    : `<span class="dish-emoji">${escape(dish.emoji)}</span>`
  return `
    <article class="dish" data-category="${escape(dish.category)}">
      <div class="dish-art">
        ${art}
        <span class="dish-number">${String(index + 1).padStart(2, '0')}</span>
        ${
          db.isSoldOut(dish)
            ? '<span class="dish-flag is-off">Hết hàng</span>'
            : dish.status === 'unavailable'
              ? '<span class="dish-flag is-off">Tạm ngưng</span>'
              : dish.status === 'runningOut'
                ? '<span class="dish-flag is-warn">Sắp hết</span>'
                : lowStock
                  ? `<span class="dish-flag is-warn">Còn ${dish.stock} phần</span>`
                  : ''
        }
      </div>
      <div class="dish-vendor">🏪 ${escape(vendor.name)} · <span aria-label="${vendor.rating} trên 5 sao">★★★★★</span> ${vendor.rating}</div>
      <h3>${escape(dish.name)}</h3>
      ${
        rating.count
          ? `<p class="dish-rating">${starBar(rating.average)}<span>${rating.average} · ${rating.count} đánh giá</span></p>`
          : ''
      }
      <p class="dish-desc">${escape(dish.description)}</p>
      <div class="dish-tags">
        ${dish.tags.map((t) => `<span class="dish-tag">${escape(t)}</span>`).join('')}
      </div>
      <div class="dish-foot">
        <span class="price">${money(dish.price)}</span>
        <button
          class="btn btn-sm btn-primary order-btn"
          data-add="${escape(dish.code)}"
          ${soldOut ? 'disabled' : ''}
        >${
          db.isSoldOut(dish) ? 'Hết hàng' : dish.status === 'unavailable' ? 'Tạm ngưng' : 'Đặt ngay'
        }</button>
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
   GIỎ HÀNG
========================= */

const ui = $('#ui-root')
const toastRoot = $('#toast-root')
let lastFocused = null

/* Toast nằm ở #toast-root riêng, không phải trong #ui-root. Trước đây
   append thẳng vào #ui-root nên mọi lần openCart()/openCheckout() gán lại
   innerHTML đều xoá sạch thông báo đang hiện. */
const toast = (message, tone = '') => {
  const node = document.createElement('div')
  node.className = `toast ${tone === 'err' ? 'is-err' : ''}`.trim()
  node.textContent = message
  toastRoot.append(node)
  setTimeout(() => node.remove(), 3000)
}

const renderBadge = () => {
  const badge = $('#cartBadge')
  if (!badge) return
  const total = cart.count()
  badge.textContent = String(total)
  badge.hidden = total === 0
}

/* Mọi thay đổi giỏ đều đi qua đây để huy hiệu và bảng giỏ luôn khớp. */
const refreshCart = () => renderBadge()

/** Giải mã lỗi của cart thành câu tiếng Việt để khách biết phải làm gì. */
const cartErrorMessage = (result, key) => {
  const dish = key ? db.findDish(key) : null
  const name = dish?.name ?? 'món này'
  if (result?.error === 'sold-out') return `${name} đã hết hàng`
  if (result?.error === 'over-stock') {
    return `Chỉ còn ${result.ceiling} phần ${name}, không đủ số lượng bạn chọn`
  }
  if (result?.error === 'unavailable') return `${name} đang tạm ngưng`
  if (result?.error === 'not-found') return 'Không tìm thấy món này'
  return `Không thêm được ${name}`
}

/* Lỗi voucher giữ lại để vẽ lại ngăn giỏ không mất thông báo. */
let cartErrorText = ''
let cartErrorCode = ''

const closePanels = () => {
  ui.innerHTML = ''
  document.body.style.overflow = ''
  lastFocused?.focus?.()
  lastFocused = null
}

const lineArt = (line) =>
  line.image
    ? `<img class="cart-line-art" src="${escape(line.image)}" alt="" loading="lazy" />`
    : `<span class="cart-line-art is-emoji">${escape(line.emoji ?? '🍽️')}</span>`

/**
 * Danh sách món trong giỏ.
 * `editable = false` bỏ nút +/- và ✕: dùng ở bước thanh toán, nơi bấm vào
 * chúng sẽ mở lại ngăn kéo và xoá luôn dữ liệu khách đang nhập trong form.
 */
const cartRows = ({ editable = true } = {}) =>
  cart
    .list()
    .map(
      (line) => `
      <div class="cart-line" data-key="${escape(line.key)}" data-line-id="${escape(line.lineId)}">
        ${lineArt(line)}
        <div class="cart-line-main">
          <strong>${escape(line.name)}</strong>
          <small>${money(line.price)} / món</small>
        </div>
        ${
          editable
            ? `<div class="qty">
                <button type="button" class="qty-btn" data-qty="-1" data-key="${escape(line.lineId)}" aria-label="Giảm số lượng ${escape(line.name)}">−</button>
                <span>${line.qty}</span>
                <button type="button" class="qty-btn" data-qty="1" data-key="${escape(line.lineId)}"
                  aria-label="Tăng số lượng ${escape(line.name)}"
                  ${line.qty >= line.maxQty ? 'disabled' : ''}>+</button>
              </div>`
            : `<div class="qty is-static"><span>×${line.qty}</span></div>`
        }
        <span class="cart-line-total">${money(line.price * line.qty)}</span>
        ${
          editable
            ? `<button type="button" class="cart-remove" data-remove="${escape(line.lineId)}" aria-label="Xoá ${escape(line.name)}">✕</button>`
            : ''
        }
      </div>`,
    )
    .join('')

/**
 * Ô nhập mã giảm giá.
 * Mã đang áp thì hiện nút bỏ, nếu không thì hiện ô nhập; lỗi (hết hạn, chưa
 * đủ tạm tính...) hiện ngay dưới ô thay vì toast để khách còn nhìn thấy.
 */
const voucherBox = () => {
  const applied = cart.voucher()
  if (applied) {
    return `
      <div class="voucher-box">
        <span class="voucher-tag">${escape(applied.code)} · ${escape(applied.label)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-action="voucher-remove">Bỏ mã</button>
      </div>`
  }
  return `
    <form class="voucher-box" id="voucherForm" novalidate>
      <input name="code" placeholder="Mã giảm giá" autocomplete="off"
        aria-label="Mã giảm giá" value="${escape(cartErrorCode ?? '')}" />
      <button type="submit" class="btn btn-outline btn-sm">Áp dụng</button>
    </form>
    ${cartErrorText ? `<p class="voucher-error" role="alert">${escape(cartErrorText)}</p>` : ''}`
}

/** Dòng tổng kết của giỏ/thanh toán: tạm tính, voucher, ship, tổng cộng. */
const moneySummary = () => {
  const off = cart.discount()
  return `
    <div class="cart-sum"><span>Tạm tính</span><b>${money(cart.subtotal())}</b></div>
    ${
      off
        ? `<div class="cart-sum is-off"><span>Giảm giá</span><b>−${money(off)}</b></div>`
        : ''
    }
    <div class="cart-sum"><span>Giao hàng</span><b>${
      cart.shipping() ? money(cart.shipping()) : 'Miễn phí'
    }</b></div>
    <div class="cart-sum is-total"><span>Tổng cộng</span><b>${money(cart.total())}</b></div>`
}

const shipProgress = () => {
  const sub = cart.subtotal()
  if (sub <= 0) return ''
  const pct = Math.min(100, Math.round((sub / db.FREE_SHIP_FROM) * 100))
  const missing = cart.missingForFreeShip()
  return `
    <div class="ship-progress">
      <div class="ship-bar"><span style="width:${pct}%"></span></div>
      <p class="ship-text">${
        missing > 0
          ? `Mua thêm <b>${money(missing)}</b> để được miễn phí giao`
          : '🎉 Đơn hàng này được <b>miễn phí giao</b>'
      }</p>
    </div>`
}

/** Chỉ vẽ lại ngăn giỏ, giữ nguyên lastFocused và vị trí cuộn đang có. */
const renderCartPanel = () => {
  const drawer = ui.querySelector('.cart-drawer')
  if (!drawer) return
  const body = drawer.querySelector('.cart-body')
  const scroll = body.scrollTop
  const lines = cart.list()

  drawer.querySelector('.cart-head h2').innerHTML = `Giỏ hàng ${
    lines.length ? `<small>${cart.count()} món</small>` : ''
  }`

  body.innerHTML = lines.length ? cartRows() : ''
  body.scrollTop = scroll

  drawer.querySelector('.cart-foot').innerHTML = `
    ${shipProgress()}
    ${
      lines.length
        ? `${voucherBox()}
           ${moneySummary()}
           <button type="button" class="btn btn-primary btn-block" data-action="checkout">Thanh toán</button>
           <button type="button" class="btn btn-ghost btn-block" data-action="clear-cart">Xoá giỏ</button>`
        : `<p class="cart-empty">Giỏ hàng đang trống.</p>
           <button type="button" class="btn btn-primary btn-block" data-action="browse-menu">Xem thực đơn</button>`
    }`
}

const openToppingSheet = (code) => {
  const dish = db.findDish(code)
  if (!dish) return toast('Không tìm thấy món', 'err')
  lastFocused = document.activeElement
  ui.innerHTML = `
    <div class="modal-backdrop-cart" data-close="1">
      <div class="sheet topping-sheet" role="dialog" aria-modal="true" aria-label="Chọn topping">
        <header class="sheet-head">
          <div><h2>Tuỳ chọn món</h2><small>${escape(dish.name)} · ${money(dish.price)}</small></div>
          <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
        </header>
        <form id="toppingForm" data-dish-code="${escape(code)}">
          <div class="sheet-body">
            <p class="muted">Chọn thêm topping hoặc đồ ăn kèm:</p>
            <div class="topping-grid">
              ${db.TOPPINGS.map((t) => `
                <label class="topping-option">
                  <input type="checkbox" name="topping" value="${escape(t.id)}" />
                  <span class="topping-emoji">${escape(t.emoji)}</span>
                  <span><b>${escape(t.name)}</b><small>+${money(t.price)}</small></span>
                </label>`).join('')}
            </div>
            <label class="field"><span>Ghi chú món</span><textarea name="itemNote" placeholder="Ít cay, không hành..."></textarea></label>
          </div>
          <div class="sheet-foot">
            <button type="submit" class="btn btn-primary btn-block">Thêm vào giỏ</button>
            <button type="button" class="btn btn-ghost btn-block" data-close="1">Bỏ qua topping</button>
          </div>
        </form>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

const openCart = () => {
  if (!ui.querySelector('.cart-drawer')) lastFocused = document.activeElement
  const lines = cart.list()
  ui.innerHTML = `
    <div class="drawer-backdrop" data-close="1"></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="Giỏ hàng">
      <header class="cart-head">
        <h2>Giỏ hàng ${lines.length ? `<small>${cart.count()} món</small>` : ''}</h2>
        <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
      </header>
      <div class="cart-body">
        ${lines.length ? cartRows() : ''}
      </div>
      <footer class="cart-foot"></footer>
    </aside>`
  renderCartPanel()
  document.body.style.overflow = 'hidden'
}

import addressDatabase from 'vietnam-address-database'

/*
 * Địa chỉ được đóng gói ngay trong app thay vì gọi API bên ngoài.
 * Dữ liệu theo cơ cấu 34 tỉnh/thành + 3.321 phường/xã sau 01/07/2025.
 * Nhờ vậy checkout vẫn hoạt động khi API ngoài lỗi hoặc mạng chặn domain.
 */
const addressTables = Array.isArray(addressDatabase) ? addressDatabase : []
const provinceTable = addressTables.find((table) => table?.type === 'table' && table?.name === 'provinces')
const wardTable = addressTables.find((table) => table?.type === 'table' && table?.name === 'wards')

const normalizeAddressData = () => {
  const provinces = (provinceTable?.data ?? []).map((item) => ({
    code: String(item.province_code || item.code || item.id),
    name: String(item.short_name || item.name || ''),
  })).filter((item) => item.code && item.name)

  const wardsByProvince = new Map()
  for (const item of wardTable?.data ?? []) {
    const provinceCode = String(item.province_code || '')
    if (!provinceCode) continue
    if (!wardsByProvince.has(provinceCode)) wardsByProvince.set(provinceCode, [])
    wardsByProvince.get(provinceCode).push({
      code: String(item.ward_code || item.code || item.id),
      name: String(item.name || ''),
    })
  }
  return { provinces, wardsByProvince }
}

const addressData = normalizeAddressData()

const loadAddressProvinces = async () => addressData.provinces
const loadAddressWards = async (provinceCode) => {
  const code = String(provinceCode || '')
  return code ? (addressData.wardsByProvince.get(code) ?? []) : []
}

const optionList = (items, placeholder, selectedName = '') => {
  const options = [`<option value="">${escape(placeholder)}</option>`]
  for (const item of items) {
    const selected = String(item.name) === String(selectedName) ? ' selected' : ''
    options.push(`<option value="${escape(item.code)}"${selected}>${escape(item.name)}</option>`)
  }
  return options.join('')
}

const addressText = (parts = {}) => [parts.detail, parts.ward, parts.province].filter(Boolean).join(', ')

const addressSelects = () => `
  <div class="address-grid address-grid-2">
    <label class="field"><span>Tỉnh/Thành *</span><select name="province" required><option value="">Đang tải tỉnh/thành...</option></select></label>
    <label class="field"><span>Phường/Xã *</span><select name="ward" required disabled><option value="">Chọn tỉnh/thành trước</option></select></label>
  </div>
  <p class="address-helper">Chọn Tỉnh/Thành → hệ thống tự tải danh sách Phường/Xã theo địa chỉ hành chính mới.</p>`

const hydrateAddressSelects = async (selected = {}) => {
  const form = ui.querySelector('#checkoutForm')
  if (!form) return
  const provinceSelect = form.elements.province
  const wardSelect = form.elements.ward
  try {
    const provinces = await loadAddressProvinces()
    provinceSelect.innerHTML = optionList(provinces, 'Chọn Tỉnh/Thành', selected.province)
    const province = provinces.find((item) => String(item.name) === String(selected.province))
    if (!province) {
      wardSelect.innerHTML = '<option value="">Chọn tỉnh/thành trước</option>'
      wardSelect.disabled = true
      return
    }
    provinceSelect.value = String(province.code)
    const wards = await loadAddressWards(province.code)
    wardSelect.innerHTML = optionList(wards, 'Chọn Phường/Xã', selected.ward)
    wardSelect.disabled = false
    const ward = wards.find((item) => String(item.name) === String(selected.ward))
    if (ward) wardSelect.value = String(ward.code)
  } catch (error) {
    console.error('[CBM FOOD] Không tải được dữ liệu địa chỉ:', error)
    provinceSelect.innerHTML = '<option value="">Không tải được dữ liệu</option>'
    wardSelect.innerHTML = '<option value="">Vui lòng thử lại</option>'
    wardSelect.disabled = true
    const box = ui.querySelector('#checkoutError')
    if (box) { box.textContent = 'Không tải được danh sách Tỉnh/Thành và Phường/Xã. Hãy kiểm tra kết nối mạng rồi mở lại cửa sổ thanh toán.'; box.hidden = false }
  }
}

const addressSelectNames = async (form) => {
  const provinceCode = String(form.elements.province?.value || '')
  const wardCode = String(form.elements.ward?.value || '')
  const provinces = await loadAddressProvinces()
  const province = provinces.find((item) => String(item.code) === provinceCode)
  const wards = await loadAddressWards(provinceCode)
  const ward = wards.find((item) => String(item.code) === wardCode)
  return { province: province?.name ?? '', district: '', ward: ward?.name ?? '' }
}

const paymentInfoHtml = (method = 'cod') => {
  if (method === 'cod') return '<div class="payment-info is-cod">💵 <b>Thanh toán khi nhận hàng</b><span>Trả tiền mặt cho shipper khi nhận đủ món.</span></div>'
  const info = method === 'momo' ? db.PAYMENT_INFO.momo : db.PAYMENT_INFO.bank
  return `<div class="payment-info">
    <div class="payment-copy"><b>${method === 'momo' ? 'Ví MoMo' : 'Chuyển khoản ngân hàng'}</b><span>${method === 'momo' ? `Số MoMo: ${escape(info.phone)}` : `${escape(info.bankName)} · STK ${escape(info.accountNumber)}`}</span><span>Chủ TK: ${escape(info.accountName)}</span><span>${escape(info.note)}</span></div>
    <img src="${escape(info.qrImage)}" alt="QR thanh toán ${method === 'momo' ? 'MoMo' : 'ngân hàng'}" class="payment-qr" />
  </div>`
}

const openCheckout = () => {
  const user = auth.getUser()
  const lines = cart.list()
  if (!lines.length) return toast('Giỏ hàng đang trống', 'err')
  lastFocused = document.activeElement
  const saved = db.listAddresses()
  const selected = db.defaultAddress()
  const selectedAddress = selected ? addressText(selected) : ''
  ui.innerHTML = `
    <div class="modal-backdrop-cart" data-close="1">
      <div class="sheet checkout-sheet" role="dialog" aria-modal="true" aria-label="Thanh toán">
        <header class="sheet-head">
          <h2>Thông tin giao hàng</h2>
          <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
        </header>
        <form id="checkoutForm" novalidate>
          <div class="sheet-body">
            ${saved.length ? `<div class="saved-addresses"><div class="field-label">Địa chỉ đã lưu</div>${saved.map((a) => `<button type="button" class="saved-address ${selected?.id === a.id ? 'is-active' : ''}" data-action="use-address" data-address-id="${escape(a.id)}"><b>${escape(a.label)}</b><span>${escape(a.receiver)} · ${escape(a.phone)}</span><small>${escape(addressText(a))}</small></button>`).join('')}</div>` : ''}
            <label class="field"><span>Người nhận *</span><input name="name" value="${escape(selected?.receiver ?? user?.name ?? '')}" required /></label>
            <label class="field"><span>Số điện thoại *</span><input name="phone" value="${escape(selected?.phone ?? user?.phone ?? '')}" inputmode="numeric" required /></label>
            <label class="field"><span>Địa chỉ giao hàng *</span><textarea name="detail" required placeholder="Nhập đầy đủ địa chỉ: số nhà, đường, phường/xã, tỉnh/thành...">${escape(selected?.detail || selectedAddress || '')}</textarea></label>
            <input type="hidden" name="address" value="${escape(selectedAddress)}" />
            <label class="save-address-check"><input type="checkbox" name="saveAddress" ${selected ? 'checked' : ''}/> Lưu địa chỉ này cho lần sau</label>
            <div class="checkout-choice">
              <span class="field-label">Hình thức nhận hàng</span>
              <label class="choice"><input type="radio" name="deliveryMethod" value="delivery" checked /> 🛵 Giao tận nơi</label>
              <label class="choice"><input type="radio" name="deliveryMethod" value="pickup" /> 🏪 Tự đến lấy</label>
            </div>
            <div class="checkout-choice">
              <span class="field-label">Thanh toán</span>
              <label class="choice"><input type="radio" name="paymentMethod" value="cod" checked /> 💵 Thanh toán khi nhận</label>
              <label class="choice"><input type="radio" name="paymentMethod" value="bank" /> 🏦 Chuyển khoản</label>
              <label class="choice"><input type="radio" name="paymentMethod" value="momo" /> 🩷 MoMo</label>
            </div>
            <div id="paymentInfo">${paymentInfoHtml('cod')}</div>
            <label class="field"><span>Ghi chú</span><textarea name="note" placeholder="Ví dụ: gọi trước khi giao..."></textarea></label>
            <div class="sheet-lines">${cartRows({ editable: false })}</div>
            <p class="form-error" id="checkoutError" role="alert" hidden></p>
            ${voucherBox()}
            ${moneySummary()}
          </div>
          <div class="sheet-foot">
            <button type="submit" class="btn btn-primary btn-block">Đặt món</button>
            <button type="button" class="btn btn-ghost btn-block" data-action="back-to-cart">Về giỏ hàng</button>
          </div>
        </form>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

/** Ép vẽ lại: dùng khi đổi tài khoản hoặc có thao tác, không phải khi quét. */
const forceRefreshMyOrders = () => {
  lastOrdersSignature = null
  refreshMyOrders()
}

const showSuccess = (order) => {
  lastFocused = document.activeElement
  const paymentLabel = order.paymentMethod === 'momo' ? 'MoMo' : order.paymentMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt khi nhận'
  const deliveryLabel = order.deliveryMethod === 'pickup' ? 'Tự đến lấy' : 'Giao tận nơi'
  ui.innerHTML = `
    <div class="modal-backdrop-cart" data-close="1">
      <div class="sheet is-success order-confirm-sheet" role="dialog" aria-modal="true">
        <div class="success-mark">✓</div>
        <p class="eyebrow">Đặt hàng thành công</p>
        <h2>CBM FOOD đã nhận đơn!</h2>
        <p class="confirm-code">Mã đơn <b>${escape(order.code)}</b></p>
        <div class="confirm-status"><span class="success-dot"></span> Đang chờ nhà hàng xác nhận</div>
        <div class="confirm-summary">
          <div><span>Hình thức</span><b>${deliveryLabel}</b></div>
          <div><span>Thanh toán</span><b>${paymentLabel}</b></div>
          <div><span>Số món</span><b>${order.items.reduce((sum, i) => sum + i.qty, 0)}</b></div>
          <div><span>Tổng cộng</span><b>${money(order.total)}</b></div>
        </div>
        <div class="confirm-items">
          ${order.items.map((item) => `<div><span>${escape(item.name)} × ${item.qty}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}
        </div>
        <p class="muted">Bạn có thể theo dõi tiến trình giao hàng trong mục <b>Đơn của tôi</b>.</p>
        <button type="button" class="btn btn-primary btn-block" data-close="1">Xem đơn của tôi</button>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}
const openAuth = (mode = 'login') => {
  lastFocused = document.activeElement
  const user = auth.getUser()
  if (user && mode === 'login') {
    ui.innerHTML = `
      <div class="modal-backdrop-cart" data-close="1">
        <div class="sheet" role="dialog" aria-modal="true">
          <header class="sheet-head"><h2>Tài khoản</h2>
            <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
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
    <div class="modal-backdrop-cart" data-close="1">
      <div class="sheet" role="dialog" aria-modal="true">
        <header class="sheet-head"><h2>${mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
          <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
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
  forceRefreshMyOrders()
}

/* =========================
   ĐƠN CỦA TÔI
   ========================= */

const ordersBox = () => $('#myOrders')

/** Các mốc hiển thị theo thứ tự; đơn đã huỷ không đi theo dải này. */
const ORDER_TRACK = ['pending', 'confirmed', 'delivering', 'completed']

const timeText = (at) =>
  new Date(at).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const statusPill = (status) => {
  const meta = db.ORDER_STATUS[status] ?? { label: status, tone: 'off' }
  return `<span class="order-pill is-${escape(meta.tone)}">${escape(meta.label)}</span>`
}

/**
 * Dải tiến trình của một đơn.
 * Mốc nào đã đi qua đều đọc được giờ từ `history` nên không phải suy đoán.
 */
const orderTrack = (order) => {
  if (order.status === 'cancelled') {
    const at = [...(order.history ?? [])].reverse().find((h) => h.status === 'cancelled')?.at
    return `<p class="order-cancelled">Đơn đã được huỷ${at ? ` lúc ${timeText(at)}` : ''}.</p>`
  }

  const reached = new Map((order.history ?? []).map((h) => [h.status, h.at]))
  return `
    <ol class="order-track">
      ${ORDER_TRACK.map((step, index) => {
        const meta = db.ORDER_STATUS[step]
        const at = reached.get(step)
        const isNow = order.status === step
        const done = reached.has(step) && !isNow
        const eta = isNow && step === 'delivering' ? 'đang trên đường' : ''
        return `
          <li class="order-step${isNow ? ' is-current' : done ? ' is-done' : ''}">
            <span class="order-dot" aria-hidden="true"></span>
            <strong>${escape(meta.label)}</strong>
            <small>${at ? timeText(at) : eta}</small>
          </li>`
      }).join('')}
    </ol>`
}

/**
 * Khối đánh giá của một đơn đã giao xong.
 * Mỗi món một dòng: chưa chấm thì có nút, đã chấm thì hiện sao kèm nút
 * sửa / khoá. Khách tự mở khoá để sửa lại được.
 */
const orderReviewBlock = (order, user) => {
  if (!db.canRateOrder(order.status)) return ''
  const rows = order.items
    .map((item) => {
      const review = db.findReview({ orderId: order.id, dishKey: item.key, userId: user.id })
      const done = review.rating != null
      return `
        <div class="review-row${done ? ' is-done' : ''}" data-code="${escape(item.key)}">
          <span class="review-name">${escape(item.name)}</span>
          ${
            done
              ? `${starBar(review.rating)}
                 ${review.comment ? `<p class="review-comment">${escape(review.comment)}</p>` : ''}
                 ${
                   review.hidden
                     ? '<small class="review-flag">Đang bị ẩn</small>'
                     : ''
                 }
                 <div class="review-tools">
                   <button type="button" class="btn btn-ghost btn-sm" data-action="review-edit"
                     data-code="${escape(item.key)}" ${review.locked ? 'disabled' : ''}>Sửa</button>
                   <button type="button" class="btn btn-ghost btn-sm" data-action="review-lock"
                     data-code="${escape(item.key)}" data-locked="${review.locked ? '1' : '0'}">
                     ${review.locked ? 'Mở khoá' : 'Khoá'}
                   </button>
                 </div>`
              : `<button type="button" class="btn btn-outline btn-sm" data-action="review-new"
                   data-code="${escape(item.key)}">Chấm sao</button>`
          }
        </div>`
    })
    .join('')
  const rated = order.items.filter(
    (i) => db.findReview({ orderId: order.id, dishKey: i.key, userId: user.id }).rating != null,
  ).length
  return `
    <section class="review-box" data-order="${escape(order.code)}">
      <header class="review-head">
        <strong>Đánh giá món</strong>
        <small>${rated}/${order.items.length} món đã chấm</small>
      </header>
      ${rows}
    </section>`
}

const myOrderCard = (order) => {
  const user = auth.getUser()
  return `
  <article class="my-order" data-code="${escape(order.code)}">
    <header class="my-order-head">
      <div>
        <strong class="my-order-code">${escape(order.code)}</strong>
        <small class="my-order-time">Đặt lúc ${timeText(order.createdAt)}</small>
      </div>
      ${statusPill(order.status)}
    </header>

    <ul class="my-order-items">
      ${order.items
        .map(
          (item) => `<li>
            <span>${escape(item.name)} × ${item.qty}</span>
            <b>${money(item.price * item.qty)}</b>
          </li>`,
        )
        .join('')}
    </ul>

    <dl class="my-order-sum">
      <div><dt>Tạm tính</dt><dd>${money(order.subtotal)}</dd></div>
      ${order.discount ? `<div class="is-off"><dt>Giảm giá ${escape(order.voucher?.code ?? '')}</dt><dd>−${money(order.discount)}</dd></div>` : ''}
      <div><dt>Giao hàng</dt><dd>${order.shipping ? money(order.shipping) : 'Miễn phí'}</dd></div>
      <div class="is-total"><dt>Tổng cộng</dt><dd>${money(order.total)}</dd></div>
    </dl>

    ${order.note ? `<p class="my-order-note">Ghi chú: ${escape(order.note)}</p>` : ''}
    <p class="my-order-addr">Giao tới: ${escape(order.customer.address)}</p>
    <div class="my-order-meta">
      <span>${order.deliveryMethod === 'pickup' ? '🏪 Tự đến lấy' : '🛵 Giao tận nơi'}</span>
      <span>${order.paymentMethod === 'momo' ? '🩷 MoMo' : order.paymentMethod === 'bank' ? '💳 Chuyển khoản' : '💵 Thanh toán khi nhận'}</span>
      ${order.paymentStatus === 'paid' ? '<span>✅ Đã thanh toán</span>' : ''}
    </div>
    ${order.deliveryProof?.photo ? `<div class="delivery-proof"><b>Ảnh giao hàng</b><img src="${escape(order.deliveryProof.photo)}" alt="Ảnh shipper giao hàng" />${order.shipper?.name ? `<small>Shipper: ${escape(order.shipper.name)}</small>` : ''}</div>` : ''}

    ${orderTrack(order)}
    ${order.status === 'delivering' ? `<div class="my-order-actions"><button type="button" class="btn btn-primary btn-sm" data-action="confirm-received" data-code="${escape(order.code)}">✅ Tôi đã nhận đơn hàng</button></div>` : ''}
    ${order.status === 'completed' && order.receivedByCustomer ? `<p class="received-note">✅ Khách đã xác nhận đã nhận hàng${order.receivedAt ? ` lúc ${timeText(order.receivedAt)}` : ''}.</p>` : ''}

    ${user ? orderReviewBlock(order, user) : ''}

    ${
      db.canCancelOrder(order.status)
        ? `<div class="my-order-actions">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              data-action="cancel-order"
              data-code="${escape(order.code)}"
            >Huỷ đơn</button>
          </div>`
        : ''
    }
  </article>`
}

const renderMyOrders = () => {
  const box = ordersBox()
  if (!box) return
  const user = auth.getUser()

  if (!user) {
    /* Đơn chỉ gắn với tài khoản, nên khách chưa đăng nhập không có gì để xem.
        Nói rõ điều đó thay vì hiện danh sách trống. */
    box.innerHTML = `
      <div class="order-gate">
        <h3>Đăng nhập để xem đơn hàng</h3>
        <p>
          Đơn chỉ gắn với tài khoản của bạn. Hãy đăng nhập để theo dõi trạng thái
          và huỷ đơn khi cần.
        </p>
        <div class="order-gate-actions">
          <button class="btn btn-primary" data-auth="login">Đăng nhập</button>
          <button class="btn btn-outline" data-auth="register">Tạo tài khoản</button>
        </div>
      </div>`
    return
  }

  const orders = db.listOrdersByUser(user.id)
  /* Đơn đang giao vẫn chưa xong nên vẫn phải tính vào "đang xử lý"; chỉ khi
     hoàn thành hoặc bị huỷ mới thoát khỏi bước này. */
  const dangXuLy = orders.filter((o) =>
    ['pending', 'confirmed', 'delivering'].includes(o.status),
  ).length
  box.innerHTML = orders.length
    ? `<p class="my-orders-count">${orders.length} đơn hàng · ${dangXuLy} đang xử lý</p>
       <div class="my-orders-list">${orders.map(myOrderCard).join('')}</div>`
    : `<div class="order-empty">
        <span class="order-empty-icon">🧾</span>
        <h3>Bạn chưa có đơn hàng nào</h3>
        <p>Chọn món ngon và bấm "Đặt ngay" để đơn đầu tiên xuất hiện ở đây.</p>
        <a href="#menu" class="btn btn-primary">Xem thực đơn</a>
      </div>`
}

/** Chỉ vẽ lại khi dữ liệu thật sự đổi, tránh nhảy layout mỗi lần quét. */
const myOrdersSignature = () => {
  const user = auth.getUser()
  if (!user) return 'guest'
  return JSON.stringify(
    db.listOrdersByUser(user.id).map((o) => [o.code, o.status, (o.history ?? []).length]),
  )
}
let lastOrdersSignature = null

const refreshMyOrders = () => {
  const signature = myOrdersSignature()
  if (signature === lastOrdersSignature) return
  lastOrdersSignature = signature
  renderMyOrders()
}

const askCancelOrder = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn hàng', 'err')
  if (!db.canCancelOrder(order.status)) {
    return toast(`Đơn ${order.code} không còn ở bước chờ xác nhận`, 'err')
  }
  lastFocused = document.activeElement
  ui.innerHTML = `
    <div class="modal-backdrop-cart" data-close="1">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Huỷ đơn">
        <header class="sheet-head">
          <h2>Huỷ đơn ${escape(order.code)}?</h2>
          <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
        </header>
        <div class="sheet-body">
          <p>
            Tổng <b>${money(order.total)}</b> · ${order.items.reduce((sum, i) => sum + i.qty, 0)} món.
            Chỉ huỷ được khi nhà hàng chưa xác nhận. Đơn đã huỷ không thể mở lại.
          </p>
        </div>
        <div class="sheet-foot">
          <button type="button" class="btn btn-ghost btn-block" data-close="1">Giữ lại</button>
          <button
            type="button"
            class="btn btn-primary btn-block"
            data-action="cancel-order-confirm"
            data-code="${escape(order.code)}"
          >Huỷ đơn</button>
        </div>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

const cancelOrder = (code) => {
  const result = db.cancelOrder(code, auth.getUser()?.id ?? null)
  closePanels()
  if (result.error) return toast(result.error, 'err')
  lastOrdersSignature = null
  refreshMyOrders()
  return toast(`Đã huỷ đơn ${result.code}`)
}

/* =========================
   ĐÁNH GIÁ MÓN
   ========================= */

/** Món đang được chấm: giữ trong biến để nút sao biết đang sửa món nào. */
let ratingTarget = null

const openReviewSheet = (orderCode, dishKey) => {
  const user = auth.getUser()
  if (!user) return toast('Hãy đăng nhập để đánh giá', 'err')
  const order = db.findOrder(orderCode)
  const line = order?.items.find((i) => i.key === dishKey)
  if (!order || !line) return toast('Không tìm thấy món trong đơn', 'err')
  if (!db.canRateOrder(order.status)) {
    return toast('Chỉ đánh giá được sau khi đơn giao thành công', 'err')
  }

  const review = db.findReview({ orderId: order.id, dishKey, userId: user.id })
  if (review.locked) return toast('Đánh giá đã khoá, hãy mở khoá trước', 'err')

  const picked = review.rating ?? db.RATING_MAX
  ratingTarget = { orderCode, dishKey, rating: picked }

  lastFocused = document.activeElement
  ui.innerHTML = `
    <div class="modal-backdrop-cart" data-close="1">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Đánh giá món">
        <header class="sheet-head">
          <h2>${review.rating != null ? 'Sửa đánh giá' : 'Đánh giá món'}</h2>
          <button type="button" class="icon-btn" data-close="1" aria-label="Đóng">✕</button>
        </header>
        <div class="sheet-body">
          <p class="review-dish"><b>${escape(line.name)}</b><small>Đơn ${escape(order.code)}</small></p>
          <div class="star-picker" role="radiogroup" aria-label="Chấm sao">
            ${Array.from(
              { length: db.RATING_MAX },
              (_, i) => `
              <button type="button" class="star-btn${i < picked ? ' is-on' : ''}"
                data-action="review-pick" data-star="${i + 1}" role="radio"
                aria-checked="${i + 1 === picked}" aria-label="${i + 1} sao"
                tabindex="${i + 1 === picked ? '0' : '-1'}">${i < picked ? '★' : '☆'}</button>`,
            ).join('')}
            <small class="star-note" data-role="star-note">${picked}/${db.RATING_MAX} sao</small>
          </div>
          <label class="field">
            <span>Nhận xét (không bắt buộc)</span>
            <textarea name="comment" rows="3" maxlength="300"
              placeholder="Món có đúng ý không?">${escape(review.comment ?? '')}</textarea>
          </label>
          <p class="form-error" id="reviewError" role="alert" hidden></p>
        </div>
        <div class="sheet-foot">
          <button type="button" class="btn btn-ghost btn-block" data-close="1">Đóng</button>
          <button type="button" class="btn btn-primary btn-block" data-action="review-save"
            data-code="${escape(dishKey)}">Lưu đánh giá</button>
        </div>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
  /* Đưa tiêu điểm vào nút sao đang chọn: bàn phím chấm được ngay sau khi mở. */
  ui.querySelector('.star-btn.is-on')?.focus?.()
}

const paintStars = (value) => {
  const buttons = [...ui.querySelectorAll('.star-btn')]
  buttons.forEach((btn, i) => {
    const on = i < value
    btn.classList.toggle('is-on', on)
    btn.setAttribute('aria-checked', String(i + 1 === value))
    btn.textContent = on ? '★' : '☆'
  })
  const note = ui.querySelector('[data-role="star-note"]')
  if (note) note.textContent = `${value}/${db.RATING_MAX} sao`
  if (ratingTarget) ratingTarget.rating = value
}

const submitReview = (dishKey) => {
  const user = auth.getUser()
  const comment = ui.querySelector('.sheet textarea[name="comment"]')?.value ?? ''
  const error = ui.querySelector('#reviewError')
  if (!ratingTarget) {
    closePanels()
    return
  }
  const result = db.saveReview({
    orderId: db.findOrder(ratingTarget.orderCode)?.id,
    dishKey,
    rating: ratingTarget.rating,
    comment,
    userId: user?.id ?? null,
  })
  if (result.error) {
    if (error) {
      error.textContent = result.error
      error.hidden = false
    } else {
      toast(result.error, 'err')
    }
    return
  }
  closePanels()
  lastOrdersSignature = null
  refreshMyOrders()
  renderDishes()
  return toast('Đã lưu đánh giá')
}

const toggleReviewLock = (orderCode, dishKey, locked) => {
  const user = auth.getUser()
  const order = db.findOrder(orderCode)
  const result = db.setReviewLock({
    orderId: order?.id,
    dishKey,
    locked,
    userId: user?.id ?? null,
  })
  if (result.error) return toast(result.error, 'err')
  lastOrdersSignature = null
  refreshMyOrders()
  return toast(locked ? 'Đã khoá đánh giá' : 'Đã mở khoá, có thể sửa')
}

/* =========================
   SỰ KIỆN
========================= */

document.addEventListener('click', async (event) => {
  const target = event.target
  /* Bấm vào lớp phủ nền (không phải hộp/ngăn bên trong) thì đóng.
     Các sheet thanh toán và đăng nhập đặt data-close ngay trên lớp phủ nền
     nên bắt buộc phải kiểm tra mục tiêu bấm có phải chính lớp phủ hay không. */
  if (target.classList.contains('drawer-backdrop')) return closePanels()
  if (target.classList.contains('modal-backdrop-cart')) return closePanels()

  if (target.closest('#searchClear')) {
    event.preventDefault()
    state.query = ''
    searchInput.value = ''
    renderDishes()
    searchInput.focus()
    return undefined
  }

  const addBtn = target.closest('[data-add]')
  if (addBtn) {
    return openToppingSheet(addBtn.dataset.add)
  }

  const addDirectBtn = target.closest('[data-add-direct]')
  if (addDirectBtn) {
    const result = cart.add(addDirectBtn.dataset.addDirect, 1)
    if (result.error) return toast(cartErrorMessage(result, addBtn.dataset.add), 'err')
    refreshCart()
    return toast('Đã thêm vào giỏ')
  }

  const qtyBtn = target.closest('[data-qty]')
  if (qtyBtn) {
    const line = cart.list().find((l) => l.lineId === qtyBtn.dataset.key)
    if (!line) return undefined
    const result = cart.setQty(qtyBtn.dataset.key, line.qty + Number(qtyBtn.dataset.qty))
    if (result?.error) return toast(cartErrorMessage(result, qtyBtn.dataset.key), 'err')
    refreshCart()
    /* renderCartPanel thay vì openCart để không mất tiêu điểm focus
       và không giật ngăn kéo mỗi lần bấm +/-. */
    return renderCartPanel()
  }

  const removeBtn = target.closest('[data-remove]')
  if (removeBtn) {
    cart.remove(removeBtn.dataset.remove)
    refreshCart()
    return renderCartPanel()
  }

  const authBtn = target.closest('[data-auth]')
  if (authBtn) {
    event.preventDefault()
    return openAuth(authBtn.dataset.auth)
  }

  const actionBtn = target.closest('[data-action]')
  if (actionBtn) {
    const action = actionBtn.dataset.action
    if (action === 'open-cart') return openCart()
    if (action === 'checkout') return openCheckout()
    if (action === 'back-to-cart') return openCart()
    if (action === 'clear-cart') {
      cart.clear()
      cartErrorText = ''
      cartErrorCode = ''
      refreshCart()
      return openCart()
    }
    if (action === 'voucher-remove') {
      cart.removeVoucher()
      cartErrorText = ''
      cartErrorCode = ''
      if (ui.querySelector('.cart-drawer')) return renderCartPanel()
      return openCheckout()
    }
    if (action === 'browse-menu') {
      closePanels()
      document.querySelector('#menu')?.scrollIntoView({ behavior: 'smooth' })
      return undefined
    }
    if (action === 'use-address') {
      const address = db.listAddresses().find((a) => a.id === actionBtn.dataset.addressId)
      const form = ui.querySelector('#checkoutForm')
      if (!address || !form) return undefined
      form.elements.name.value = address.receiver
      form.elements.phone.value = address.phone
      form.elements.detail.value = address.detail || addressText(address)
      form.elements.address.value = form.elements.detail.value
      ui.querySelectorAll('.saved-address').forEach((b) => b.classList.toggle('is-active', b.dataset.addressId === address.id))
      return undefined
    }
    if (action === 'confirm-received') {
      const result = db.confirmOrderReceived(actionBtn.dataset.code, auth.getUser()?.id ?? null)
      if (result.error) return toast(result.error, 'err')
      forceRefreshMyOrders()
      return toast(`Đã xác nhận nhận đơn ${result.order.code}`)
    }
    if (action === 'logout') {
      auth.logout()
      syncLoginButton()
      closePanels()
      return toast('Đã đăng xuất')
    }
    if (action === 'reset-filter') return resetFilter()
    if (action === 'cancel-order') return askCancelOrder(actionBtn.dataset.code)
    if (action === 'cancel-order-confirm') return cancelOrder(actionBtn.dataset.code)
    if (action === 'review-pick') return paintStars(Number(actionBtn.dataset.star))
    if (action === 'review-save') return submitReview(actionBtn.dataset.code)
    if (action === 'review-new') {
      return openReviewSheet(actionBtn.closest('.review-box')?.dataset.order, actionBtn.dataset.code)
    }
    if (action === 'review-edit') {
      return openReviewSheet(actionBtn.closest('.review-box')?.dataset.order, actionBtn.dataset.code)
    }
    if (action === 'review-lock') {
      return toggleReviewLock(
        actionBtn.closest('.review-box')?.dataset.order,
        actionBtn.dataset.code,
        actionBtn.dataset.locked !== '1',
      )
    }
  }

  /* Chỉ đóng khi bấm TRÚC TIẾP vào phần tử mang data-close (nút ✕, nút
     "Đóng", lớp phủ nền). Không dùng closest(): lớp phủ của hộp thoại cũng mang
     data-close, nên closest() khớp cả mọi thứ bên trong — bấm nút "Đặt món"
     sẽ đóng hộp trước, sự kiện submit không kịp chạy và không đơn nào được
     tạo. */
  if (target.dataset.close !== undefined) return closePanels()

  const categoryBtn = target.closest('.category-btn')
  if (categoryBtn) {
    state.category = categoryBtn.dataset.category
    return renderDishes()
  }

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

ui.addEventListener('change', async (event) => {
  if (event.target.name === 'paymentMethod') {
    const box = ui.querySelector('#paymentInfo')
    if (box) box.innerHTML = paymentInfoHtml(event.target.value)
    return
  }
  if (event.target.name === 'province') {
    const form = event.target.form
    const wardSelect = form?.elements.ward
    if (!wardSelect) return
    wardSelect.disabled = true
    wardSelect.innerHTML = '<option value="">Đang tải phường/xã...</option>'
    try {
      const wards = await loadAddressWards(event.target.value)
      wardSelect.innerHTML = optionList(wards, 'Chọn Phường/Xã')
      wardSelect.disabled = false
    } catch (error) {
      console.error('[CBM FOOD] Không tải được phường/xã:', error)
      wardSelect.innerHTML = '<option value="">Không tải được</option>'
    }
  }
})

ui.addEventListener('submit', async (event) => {
  if (event.target.id === 'toppingForm') {
    event.preventDefault()
    const data = new FormData(event.target)
    const toppings = data.getAll('topping').map(String)
    const code = ui.querySelector('.topping-sheet')?.querySelector('[name="topping"]')?.closest('form')?.dataset?.code
    /* code được gắn lại từ dataset trên form nếu có; fallback đọc từ nút ẩn. */
    const dishCode = event.target.dataset.dishCode || code
    if (!dishCode) return toast('Không xác định được món', 'err')
    const result = cart.add(dishCode, 1, toppings)
    if (result.error) return toast(cartErrorMessage(result, dishCode), 'err')
    refreshCart()
    closePanels()
    return toast('Đã thêm món và topping vào giỏ')
  }

  if (event.target.id === 'voucherForm') {
    event.preventDefault()
    const code = String(new FormData(event.target).get('code') ?? '')
    const result = cart.applyVoucher(code, {
      userId: auth.getUser()?.id ?? null,
      phone: String(new FormData(event.target).get('phone') ?? '') || undefined,
    })
    if (result.error) {
      cartErrorText = result.error
      cartErrorCode = code
      if (ui.querySelector('.cart-drawer')) return renderCartPanel()
      /* Ở bước thanh toán, vẽ lại cả sheet để lỗi nằm đúng chỗ. */
      lastFocused = document.activeElement
      return openCheckout()
    }
    cartErrorText = ''
    cartErrorCode = ''
    if (ui.querySelector('.cart-drawer')) return renderCartPanel()
    return openCheckout()
  }

  if (event.target.id === 'checkoutForm') {
    event.preventDefault()
    const data = new FormData(event.target)
    const box = $('#checkoutError')
    const phone = String(data.get('phone') ?? '')
    /* Địa chỉ được nhập tự do, không còn phụ thuộc dữ liệu Tỉnh/Thành hay API địa chỉ. */
    const detail = String(data.get('detail') ?? '').trim()
    const parts = { province: '', district: '', ward: '', detail }
    const address = detail
    event.target.elements.address.value = address
    if (String(data.get('saveAddress') ?? '') === 'on') {
      const savedAddress = db.saveAddress({
        receiver: String(data.get('name') ?? ''), phone, ...parts, detail: parts.detail, isDefault: true,
      })
      if (savedAddress.error) { box.textContent = savedAddress.error; box.hidden = false; return }
    }
    const result = db.createOrder({
      items: cart.list().map((line) => ({ key: line.key, qty: line.qty, toppings: line.toppings?.map((t) => t.id) ?? [] })),
      customer: {
        name: String(data.get('name') ?? ''),
        phone,
        address,
        addressParts: parts,
      },
      note: String(data.get('note') ?? ''),
      userId: auth.getUser()?.id ?? null,
      voucherCode: cart.voucher()?.code ?? '',
      paymentMethod: String(data.get('paymentMethod') ?? 'cod'),
      paymentChannel: String(data.get('paymentMethod') ?? 'bank'),
      deliveryMethod: String(data.get('deliveryMethod') ?? 'delivery'),
    })
    if (result.error) {
      box.textContent = result.error
      box.hidden = false
      /* Mã có thể vừa hết lượt ở tab khác; bỏ khỏi giỏ để khách sửa tiếp
         thay vì bấm "Đặt món" hoài ra cùng một lỗi. */
      if (/Mã .*(hết|hạn|lượt|ngừng)/.test(result.error)) {
        cart.removeVoucher()
        cartErrorText = result.error
      }
      return
    }
    cart.clear()
    cartErrorText = ''
    cartErrorCode = ''
    refreshCart()
    /* Đơn mới phải xuất hiện ngay trong "Đơn của tôi" mà không cần tải lại.
       Đồng thời vẽ lại thực đơn: món vừa bán hết phải khoá nút ngay, không
       để khách bấm "Đặt ngay" rồi mới nhận lỗi. */
    renderDishes()
    forceRefreshMyOrders()
    showSuccess(result.order)
    return
  }

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
  if (ui.innerHTML) {
    closePanels()
    return
  }
  if (state.query) {
    resetFilter()
    searchInput.focus()
  }
})

/* =========================
   KHỞI ĐỘNG
========================= */

async function startShop() {
  auth.useScope('shop')
  try {
    await auth.init()
    /* Dọn giỏ TRƯỚC khi vẽ huy hiệu: nếu không, món đã bị admin xoá hoặc
       ngưng bán vẫn còn trong huy hiệu ở lần tải trang đầu tiên. */
    cart.syncWithMenu()
    renderCategories()
    renderDishes()
    refreshCart()
    syncLoginButton()
  } catch (error) {
    console.error('[CBM FOOD] Khởi tạo thất bại:', error)
    dishGrid.innerHTML = '<p class="muted">Không tải được thực đơn. Vui lòng kiểm tra console.</p>'
  }
}

/* Quản trị có thể sửa/ngưng/xoá món ở tab khác; đồng bộ lại giỏ để giỏ và
   huy hiệu không giữ món không còn bán. Trạng thái đơn cũng được đổi ở tab
   khác nên "Đơn của tôi" phải cập nhật theo. */
window.addEventListener('storage', (event) => {
  if (event.key === 'cbmfood.orders') {
    db.reloadFromStorage()
    refreshMyOrders()
    return
  }
  /* Đăng nhập/đăng xuất ở tab khác phải có hiệu lực ở đây, nếu không trang
     vẫn giữ tên khách cũ và vẫn hiện đơn của người vừa đăng xuất. Chỉ nghe
     phiên của trang bán hàng — phiên quản trị là của tab admin, không liên
     quan tới khách đang mua. */
  if (event.key === 'cbmfood.session.shop') {
    syncLoginButton()
    return
  }
  if (event.key === 'cbmfood.reviews') {
    /* Điểm trên thẻ món và phần đánh giá trong đơn đều lấy từ kho này. */
    db.reloadFromStorage()
    renderDishes()
    lastOrdersSignature = null
    refreshMyOrders()
    return
  }
  if (event.key !== 'cbmfood.dishes') return
  db.reloadFromStorage()
  renderCategories()
  renderDishes()
  cart.syncWithMenu()
  refreshCart()
  if (ui.querySelector('.cart-drawer')) renderCartPanel()
})

/*
 * Sự kiện `storage` chỉ nổ ra ở TÁB KHÁC, không nổ ra trong chính tab đang
 * giao diện (mà cũng không nổ ra khi quản trị và khách dùng chung một cửa
 * sổ). Nên thêm nhịp quét định kỳ: chỉ vẽ lại khi dữ liệu thật sự đổi,
 * và bỏ qua khi tab đang ẩn.
 */
setInterval(() => {
  if (document.visibilityState !== 'visible') return
  db.reloadFromStorage()
  refreshMyOrders()
}, 5000)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return
  db.reloadFromStorage()
  refreshMyOrders()
})

startShop()