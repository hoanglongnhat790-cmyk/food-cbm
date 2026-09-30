import './style.css'
import { initCart, openCart, cart } from './cart.js'
import { initCheckout, openCheckout } from './checkout.js'
import { formatPrice } from './utils.js'

const app = document.querySelector('#app')

const dishes = [
  { id: 1, name: 'Phở bò đặc biệt', desc: 'Nước dùng ninh xương 12 tiếng, thịt bò mềm thơm.', price: 65000, image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=85' },
  { id: 4, name: 'Bún chả Hà Nội', desc: 'Chả nướng than hoa, nước mắm chua ngọt chuẩn vị.', price: 55000, image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85' },
  { id: 11, name: 'Bánh mì que CBM', desc: 'Bánh mì giòn, pate trứng, chả lụa đầy đặn.', price: 30000, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85' },
  { id: 7, name: 'Cơm tấm sườn', desc: 'Sườn nướng mật ong, bì chả trứng hấp nóng.', price: 60000, image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85' },
  { id: 5, name: 'Bún bò Huế', desc: 'Vị cay nồng đặc trưng, giò heo mềm ngon.', price: 65000, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85' },
  { id: 23, name: 'Mì Ý sốt bò', desc: 'Mì pasta dai mềm, sốt bò cà chua đậm đà.', price: 70000, image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=85' },
]

app.innerHTML = `
<header class="site-header">
  <div class="container header-inner">
    <a href="#home" class="brand"><span class="brand-mark">CBM</span><span class="brand-name">CBM FOOD</span></a>
    <nav class="main-nav" aria-label="Menu chính">
      <a href="#home" class="active">Trang chủ</a><a href="#menu">Thực đơn</a><a href="#about">Giới thiệu</a><a href="#contact">Liên hệ</a>
    </nav>
    <div class="header-actions">
      <button class="btn btn-outline btn-login" data-auth="login">Đăng nhập</button>
      <button class="btn btn-outline" id="openOrders" type="button">Đơn hàng của tôi</button>
      <button class="btn btn-primary cart-btn" id="openCart" type="button"><span>Giỏ hàng</span><span class="cart-count" id="cartCount">0</span></button>
    </div>
  </div>
</header>

<main>
<section id="home" class="hero"><div class="container hero-grid">
  <div class="hero-content"><p class="eyebrow">Nhà hàng CBM FOOD</p><h1>Đồ ăn ngon,<br>giao tận nơi trong <em>30 phút</em></h1>
  <p class="hero-sub">Thực đơn tươi ngon mỗi ngày từ những nguyên liệu sạch, chế biến bởi đầu bếp giàu kinh nghiệm. Đặt món ngay để nhận ưu đãi hấp dẫn.</p>
  <div class="hero-actions"><a href="#menu" class="btn btn-primary btn-lg">Xem thực đơn</a><button class="btn btn-outline btn-lg" data-auth="register">Tạo tài khoản</button></div></div>
  <div class="hero-art"><div class="hero-card hero-card-main"><img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=90" alt="Món ăn tươi ngon CBM FOOD"><div class="hero-overlay"><strong>CBM FOOD</strong><span>Bữa ăn ngon cho mọi nhà</span></div></div><div class="hero-card hero-card-mini"><strong>4.9</strong><span>Đánh giá từ 12.000+ khách hàng</span></div><div class="hero-card hero-card-tag"><strong>30'</strong><span>Giao nhanh</span></div></div>
</div></section>

<section class="features"><div class="container features-grid">
<div class="feature"><span class="feature-icon feature-fast">⚡</span><div><h3>Giao trong 30 phút</h3><p>Shipper riêng, đổi trả miễn phí nếu trễ hẹn.</p></div></div>
<div class="feature"><span class="feature-icon feature-leaf">🌿</span><div><h3>Nguyên liệu tươi sạch</h3><p>Chọn lọc từ nguồn cung uy tín mỗi sáng.</p></div></div>
<div class="feature"><span class="feature-icon feature-wallet">💳</span><div><h3>Giá tốt nhất</h3><p>Ưu đãi hoàn tiền, mã giảm giá mỗi tuần.</p></div></div>
</div></section>

<section id="menu" class="menu"><div class="container"><div class="section-head"><p class="eyebrow">Thực đơn hôm nay</p><h2>Món ăn được yêu thích</h2><p>Những món ăn tiêu biểu được khách hàng chọn nhiều nhất.</p></div><div class="dish-grid">
${dishes.map((d, i) => `<article class="dish"><div class="dish-art"><img src="${d.image}" alt="${d.name}" loading="lazy"><span class="dish-number">0${i + 1}</span></div><h3>${d.name}</h3><p class="dish-desc">${d.desc}</p><div class="dish-foot"><span class="price">${formatPrice(d.price)}</span><button class="btn btn-sm btn-primary order-btn" data-id="${d.id}">Đặt ngay</button></div></article>`).join('')}
</div></div></section>

<section id="about" class="about"><div class="container about-grid"><div class="about-art"><div class="about-photo"><img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=85" alt="Không gian nhà hàng"></div><div class="about-stat"><span class="about-count">12.000+</span><span class="about-label">Đơn hàng đã giao</span></div><div class="about-stat"><span class="about-count">50+</span><span class="about-label">Món ăn trong thực đơn</span></div></div><div class="about-content"><p class="eyebrow">Về chúng tôi</p><h2>Chuẩn vị truyền thống, hiện đại trong từng chi tiết</h2><p>CBM FOOD mang những món ăn thơm ngon, đậm đà đến bàn ăn của mọi gia đình. Mỗi món ăn đều được kiểm soát chất lượng từ nguyên liệu đến khâu trình bày.</p><p>Đội ngũ đầu bếp luôn đổi mới thực đơn theo mùa, đảm bảo sự đa dạng và mới mẻ cho khách hàng.</p><a href="#menu" class="btn btn-primary">Khám phá thực đơn</a></div></div></section>

<section id="contact" class="cta"><div class="container cta-box"><h2>Sẵn sàng thưởng thức món ngon?</h2><p>Đăng nhập để lưu thông tin và đặt món nhanh hơn.</p><div class="hero-actions"><button class="btn btn-light btn-lg" data-auth="login">Đăng nhập</button><button class="btn btn-outline-light btn-lg" data-auth="register">Đăng ký miễn phí</button></div></div></section>
</main>

<footer class="site-footer"><div class="container footer-grid"><div class="footer-brand"><a href="#" class="brand"><span class="brand-mark">CBM</span><span class="brand-name">CBM FOOD</span></a><p>Đồ ăn ngon, giao nhanh mỗi ngày. Cảm ơn bạn đã tin tưởng lựa chọn CBM.</p></div><nav class="footer-col"><h4>Liên kết</h4><a href="#home">Trang chủ</a><a href="#menu">Thực đơn</a><a href="#about">Giới thiệu</a><a href="#contact">Liên hệ</a></nav><div class="footer-col"><h4>Liên hệ</h4><p>123 Đường Lê Lợi, Quận 1, TP.HCM</p><p>Hotline: 1900 1234</p><p>Email: hotro@cbmfood.vn</p></div><div class="footer-col"><h4>Giờ mở cửa</h4><p>Thứ 2 - Chủ nhật</p><p>08:00 - 22:00</p></div></div><div class="container footer-bottom"><p>© 2026 CBM FOOD. All rights reserved.</p></div></footer>

<div class="modal-backdrop" id="authModal" aria-hidden="true"><div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle"><button class="modal-close" id="closeAuth" aria-label="Đóng">×</button><div class="auth-image"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85" alt="Món ăn ngon"></div><div class="auth-panel"><div class="auth-tabs"><button class="auth-tab active" data-tab="login">Đăng nhập</button><button class="auth-tab" data-tab="register">Đăng ký</button></div><p class="eyebrow">Chào mừng bạn</p><h2 id="authTitle">Đăng nhập</h2><p class="auth-subtitle">Đăng nhập để đặt món nhanh và lưu thông tin của bạn.</p><form id="authForm"><div class="form-group register-only"><label for="fullName">Họ và tên</label><input id="fullName" type="text" placeholder="Nguyễn Văn A"></div><div class="form-group"><label for="email">Email</label><input id="email" type="email" placeholder="ban@example.com" required></div><div class="form-group"><label for="password">Mật khẩu</label><div class="password-wrap"><input id="password" type="password" placeholder="Ít nhất 6 ký tự" required minlength="6"><button type="button" id="togglePassword">Hiện</button></div></div><div class="form-group register-only"><label for="confirmPassword">Nhập lại mật khẩu</label><input id="confirmPassword" type="password" placeholder="Nhập lại mật khẩu"></div><p class="form-message" id="formMessage"></p><button class="btn btn-primary auth-submit" type="submit" id="authSubmit">Đăng nhập</button></form><p class="switch-auth" id="switchAuth">Chưa có tài khoản? <button type="button" data-tab="register">Đăng ký ngay</button></p></div></div></div>

<div class="drawer-backdrop" id="cartBackdrop"></div>
<aside class="cart-drawer" id="cartDrawer" aria-hidden="true" aria-label="Giỏ hàng">
  <div class="cart-head"><div><p class="eyebrow">CBM FOOD</p><h2>Giỏ hàng</h2></div><button class="modal-close" id="closeCart" type="button" aria-label="Đóng giỏ hàng">×</button></div>
  <div class="cart-body" id="cartBody"></div>
  <div class="cart-foot" id="cartFoot" hidden>
    <div class="summary-line"><span>Tạm tính</span><strong id="cartSubtotal">0đ</strong></div>
    <div class="summary-line"><span>Phí giao hàng</span><strong id="cartShipping">0đ</strong></div>
    <div class="summary-line summary-total"><span>Tổng cộng</span><strong id="cartTotal">0đ</strong></div>
    <p class="summary-note" id="cartHint"></p>
    <button class="btn btn-primary" id="toCheckout" type="button">Xác nhận đặt hàng</button>
  </div>
</aside>

<div class="modal-backdrop" id="checkoutModal" aria-hidden="true">
  <div class="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
    <button class="modal-close" id="closeCheckout" type="button" aria-label="Đóng">×</button>
    <div class="checkout-step" id="checkoutFormStep">
      <p class="eyebrow">Bước cuối cùng</p><h2 id="checkoutTitle">Xác nhận đặt hàng</h2><p class="auth-subtitle">Kiểm tra thông tin giao hàng để bên nhà hàng chuẩn bị món ngon cho bạn.</p>
      <div class="checkout-grid">
        <form id="checkoutForm" novalidate>
          <div class="form-group"><label for="orderName">Họ và tên</label><input id="orderName" type="text" placeholder="Nguyễn Văn A" autocomplete="name"></div>
          <div class="form-group"><label for="orderPhone">Số điện thoại</label><input id="orderPhone" type="tel" placeholder="0901234567" autocomplete="tel"></div>
          <div class="form-group"><label for="orderAddress">Địa chỉ giao hàng</label><input id="orderAddress" type="text" placeholder="Số nhà, đường, phường/xã, quận/huyện" autocomplete="street-address"></div>
          <div class="form-group"><label for="checkoutNote">Ghi chú cho nhà hàng</label><textarea id="checkoutNote" placeholder="Ít cay, không hành..."></textarea></div>
          <p class="form-label">Phương thức thanh toán</p>
          <div class="pay-list">
            <label class="pay-option"><input type="radio" name="payment" value="cod" checked><span class="pay-icon">💵</span><span class="pay-text"><strong>Thanh toán khi nhận hàng</strong><small>Chuẩn bị món và giao đến tận nơi</small></span></label>
            <label class="pay-option"><input type="radio" name="payment" value="momo"><span class="pay-icon">📱</span><span class="pay-text"><strong>Ví MoMo</strong><small>Quét mã QR khi nhận món</small></span></label>
            <label class="pay-option"><input type="radio" name="payment" value="bank"><span class="pay-icon">🏦</span><span class="pay-text"><strong>Chuyển khoản ngân hàng</strong><small>Chuyển trước khi giao hàng</small></span></label>
          </div>
          <p class="form-message" id="checkoutMessage"></p>
          <button class="btn btn-primary" type="submit">Xác nhận đặt hàng</button>
        </form>
        <aside class="checkout-summary" id="checkoutSummary"></aside>
      </div>
    </div>
    <div class="checkout-step success" id="checkoutSuccess" hidden><div id="successBody"></div></div>
  </div>
</div>

<div class="modal-backdrop" id="ordersModal" aria-hidden="true">
  <div class="orders-modal" role="dialog" aria-modal="true" aria-labelledby="ordersTitle">
    <button class="modal-close" id="closeOrders" type="button" aria-label="Đóng">×</button>
    <p class="eyebrow">Lịch sử mua hàng</p><h2 id="ordersTitle">Đơn hàng của tôi</h2><p class="auth-subtitle" id="ordersTotal"></p>
    <div class="orders-list" id="ordersList"></div>
  </div>
</div>
`

const modal = document.querySelector('#authModal')
const form = document.querySelector('#authForm')
const message = document.querySelector('#formMessage')
let mode = 'login'

function setMode(nextMode) {
  mode = nextMode
  document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === mode))
  document.querySelectorAll('.register-only').forEach(el => el.classList.toggle('show', mode === 'register'))
  document.querySelector('#authTitle').textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'
  modal.querySelector('.auth-subtitle').textContent = mode === 'login' ? 'Đăng nhập để đặt món nhanh và lưu thông tin của bạn.' : 'Tạo tài khoản miễn phí để đặt món nhanh hơn.'
  document.querySelector('#authSubmit').textContent = mode === 'login' ? 'Đăng nhập' : 'Đăng ký'
  document.querySelector('#switchAuth').innerHTML = mode === 'login' ? 'Chưa có tài khoản? <button type="button" data-tab="register">Đăng ký ngay</button>' : 'Đã có tài khoản? <button type="button" data-tab="login">Đăng nhập</button>'
  message.textContent = ''
}

function openAuth(nextMode = 'login') { setMode(nextMode); modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open'); setTimeout(() => document.querySelector('#email').focus(), 50) }
function closeAuth() { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open') }

document.addEventListener('click', event => {
  const authButton = event.target.closest('[data-auth]')
  const tabButton = event.target.closest('[data-tab]')
  if (authButton) { event.preventDefault(); openAuth(authButton.dataset.auth) }
  if (tabButton) { event.preventDefault(); setMode(tabButton.dataset.tab) }
  if (event.target.closest('#closeAuth') || event.target === modal) closeAuth()
  const order = event.target.closest('.order-btn')
  if (order) {
    const dish = dishes.find(entry => entry.id === Number(order.dataset.id))
    if (!dish) return
    cart.add(dish)
    openCart()
  }
})

document.querySelector('#togglePassword').addEventListener('click', () => {
  const input = document.querySelector('#password')
  input.type = input.type === 'password' ? 'text' : 'password'
  document.querySelector('#togglePassword').textContent = input.type === 'password' ? 'Hiện' : 'Ẩn'
})

form.addEventListener('submit', event => {
  event.preventDefault()
  const email = document.querySelector('#email').value.trim()
  const password = document.querySelector('#password').value
  const name = document.querySelector('#fullName').value.trim()
  const users = JSON.parse(localStorage.getItem('cbmUsers') || '{}')
  if (mode === 'register') {
    const confirm = document.querySelector('#confirmPassword').value
    if (!name) return message.textContent = 'Vui lòng nhập họ và tên.'
    if (password !== confirm) return message.textContent = 'Mật khẩu nhập lại chưa khớp.'
    if (users[email]) return message.textContent = 'Email này đã được đăng ký.'
    users[email] = { name, password }
    localStorage.setItem('cbmUsers', JSON.stringify(users))
    setMode('login')
    message.textContent = 'Đăng ký thành công! Bạn có thể đăng nhập ngay.'
    document.querySelector('#email').value = email
  } else {
    if (!users[email] || users[email].password !== password) return message.textContent = 'Email hoặc mật khẩu chưa đúng.'
    localStorage.setItem('cbmCurrentUser', JSON.stringify(users[email]))
    message.textContent = `Xin chào ${users[email].name}! Đăng nhập thành công.`
    setTimeout(closeAuth, 800)
  }
})

document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('show')) closeAuth() })

initCart({ onCheckout: openCheckout })
initCheckout()
