import './admin.css'
import * as db from './store.js'
import * as auth from './auth.js'
import * as gameConfig from './game-config.js'
import { matchesQuery, normalizeQuery } from './search.js'

const $ = (sel) => document.querySelector(sel)
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`
const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const el = {
  gate: $('#auth-gate'),
  gateForm: $('#gate-form'),
  gateError: $('#gate-error'),
  shell: $('#admin-shell'),
  nav: document.querySelectorAll('[data-nav]'),
  views: document.querySelectorAll('.view'),
  title: $('#page-title'),
  sub: $('#page-sub'),
  avatar: $('#admin-avatar'),
  name: $('#admin-name'),
  email: $('#admin-email'),
  logout: $('#admin-logout'),
  statGrid: $('#stat-grid'),
  recentOrders: $('#recent-orders'),
  topDishes: $('#top-dishes'),
  orderStatusStats: $('#order-status-stats'),
  inventorySummary: $('#inventory-summary'),
  revenueReport: $('#revenue-report'),
  vendorReport: $('#vendor-report'),
  shipBoard: $('#ship-board'),
  shipSummary: $('#ship-summary'),
  shipperList: $('#shipper-list'),
  shipperSummary: $('#shipper-summary'),
  dishList: $('#dish-list'),
  dishSummary: $('#dish-summary'),
  dishSearch: $('#dish-search'),
  dishCategory: $('#dish-category'),
  dishStatus: $('#dish-status'),
  orderList: $('#order-list'),
  orderSummary: $('#order-summary'),
  orderSearch: $('#order-search'),
  orderChips: $('#order-chips'),
  voucherList: $('#voucher-list'),
  voucherSummary: $('#voucher-summary'),
  voucherSearch: $('#voucher-search'),
  gameAdminBody: $('#game-admin-body'),
  gameAdminSummary: $('#game-admin-summary'),
  modalRoot: $('#modal-root'),
  toastRoot: $('#toast-root'),
}

const PAGES = {
  dashboard: { title: 'Tổng quan', sub: 'Sức khoẻ cửa hàng hôm nay.' },
  dishes: { title: 'Món ăn', sub: 'Thêm, sửa, xoá món trong thực đơn.' },
  orders: { title: 'Đơn hàng', sub: 'Theo dõi và cập nhật trạng thái đơn.' },
  vouchers: { title: 'Voucher', sub: 'Mã giảm giá cho khách.' },
  games: { title: 'Quản lý Mini Game', sub: 'Bật/tắt game, cấu hình phần thưởng, câu hỏi và theo dõi lịch sử thật.' },
  ship: { title: 'Điều phối ship', sub: 'Theo dõi đơn đang giao và chuyển trạng thái giao hàng.' },
}

const state = {
  dishQuery: '',
  dishCategory: 'all',
  dishStatus: 'all',
  orderQuery: '',
  orderStatus: 'all',
  voucherQuery: '',
  gameTab: 'overview',
  gameRewardGame: 'all',
  gameHistoryQuery: '',
  gameHistoryStatus: 'all',
  gameHistoryGame: 'all',
  editing: null,
  editingVoucher: null,
  editingGameReward: null,
  editingGameQuestion: null,
  emoji: '',
  imagePreviewUrl: '',
}

let lastFocused = null

export const toast = (message, tone = '') => {
  const node = document.createElement('div')
  node.className = `toast ${tone === 'err' ? 'is-err' : ''}`.trim()
  node.textContent = message
  el.toastRoot.append(node)
  setTimeout(() => node.remove(), 3200)
}

const showGateError = (message) => {
  if (!message) {
    el.gateError.hidden = true
    return
  }
  el.gateError.textContent = message
  el.gateError.hidden = false
}

const showGate = () => {
  el.shell.hidden = true
  el.gate.hidden = false
  showGateError('')
  el.gateForm.reset()
}

const showAdmin = (user) => {
  el.gate.hidden = true
  el.shell.hidden = false
  el.avatar.textContent = user.name.trim().charAt(0).toUpperCase()
  el.name.textContent = user.name
  el.email.textContent = user.email
}

const syncGuard = () => {
  const user = auth.getUser()
  if (!auth.canAccessAdmin()) {
    showGate()
    return false
  }
  showAdmin(user)
  return true
}

const deny = () => {
  if (!auth.canAccessAdmin()) {
    showGate(auth.getUser())
    toast('Bạn không có quyền quản trị', 'err')
    return true
  }
  return false
}

/* ---------------- render ---------------- */

const renderStats = () => {
  const s = db.stats()
  el.statGrid.innerHTML = [
    { label: 'Món trong thực đơn', value: s.dishCount },
    { label: 'Đơn hàng', value: s.orderCount },
    { label: 'Đơn chờ xác nhận', value: s.pendingCount },
    { label: 'Doanh thu hoàn thành', value: money(s.revenue) },
    { label: 'Phần món đã bán', value: s.sold },
  ]
    .map(
      (card) => `
      <article class="stat">
        <small>${escape(card.label)}</small>
        <strong>${escape(card.value)}</strong>
      </article>`,
    )
    .join('')

  el.recentOrders.innerHTML = s.orderCount
    ? db
        .listOrders()
        .slice(0, 6)
        .map(
          (o) => `
      <div class="mini-row">
        <span>${escape(o.code)} · ${escape(o.customer.name)}</span>
        <small>${escape(db.ORDER_STATUS[o.status]?.label ?? o.status)}</small>
      </div>`,
        )
        .join('')
    : '<p class="muted">Chưa có đơn nào.</p>'

  el.topDishes.innerHTML = s.top.length
    ? s.top
        .map(
          (d) => `
      <div class="mini-row">
        <span>${escape(d.name)}</span>
        <small>${d.sold} phần</small>
      </div>`,
        )
        .join('')
    : '<p class="muted">Chưa có dữ liệu bán hàng.</p>'

  el.orderStatusStats.innerHTML = Object.entries(db.ORDER_STATUS)
    .map(([id, meta]) => `
      <div class="stat-progress">
        <div><span>${escape(meta.label)}</span><b>${s.statusCounts[id] ?? 0}</b></div>
        <span class="progress-track"><i style="width:${s.orderCount ? Math.round(((s.statusCounts[id] ?? 0) / s.orderCount) * 100) : 0}%"></i></span>
      </div>
    `).join('')

  el.inventorySummary.innerHTML = `
    <div class="mini-row"><span>Tổng món</span><b>${s.dishCount}</b></div>
    <div class="mini-row"><span>Nguyên liệu khác nhau</span><b>${s.ingredientCount}</b></div>
    <div class="mini-row"><span>Món sắp hết</span><b>${s.lowStock.length}</b></div>
    <div class="mini-row"><span>Món hết hàng</span><b>${s.soldOutCount}</b></div>
    <div class="mini-row"><span>Doanh thu hôm nay</span><b>${money(s.todayRevenue)}</b></div>
  `
  if (el.revenueReport) {
    const now = new Date()
    const period = el.revenueReport.dataset.period || 'day'
    const value = el.revenueReport.dataset.value || (period === 'day' ? now.toISOString().slice(0,10) : period === 'month' ? now.toISOString().slice(0,7) : String(now.getFullYear()))
    const date = period === 'year' ? new Date(Number(value), 0, 1) : period === 'month' ? new Date(`${value}-01T00:00:00`) : new Date(`${value}T00:00:00`)
    const report = db.revenueReport({ period, date })
    const max = Math.max(1, ...report.rows.map(r => r.revenue))
    el.revenueReport.innerHTML = `
      <div class="revenue-toolbar">
        <div class="report-periods">
          ${[['day','Theo ngày'],['month','Theo tháng'],['year','Theo năm']].map(([id,label]) => `<button type="button" class="report-period ${period===id?'is-active':''}" data-action="revenue-period" data-period="${id}">${label}</button>`).join('')}
        </div>
        <input id="revenue-date" type="${period==='year'?'number':period==='month'?'month':'date'}" value="${escape(value)}" min="2020" max="2100" />
      </div>
      <div class="revenue-summary"><div><small>${escape(report.label)}</small><strong>${money(report.revenue)}</strong></div><div><small>Số đơn hoàn thành</small><strong>${report.orders}</strong></div></div>
      <div class="revenue-bars">${report.rows.map(r => `<div class="revenue-row"><span>${escape(r.label)}</span><div class="revenue-track"><i style="width:${Math.round((r.revenue/max)*100)}%"></i></div><b>${money(r.revenue)}</b></div>`).join('')}</div>`
    el.revenueReport.dataset.period = period
    el.revenueReport.dataset.value = value
  }
  if (el.vendorReport) {
    el.vendorReport.innerHTML = db.vendorStats().map(v => `<div class="vendor-report-row"><div><strong>🏪 ${escape(v.name)}</strong><small>★ ${v.rating} · ${v.reviewCount.toLocaleString('vi-VN')} đánh giá · ${v.dishCount} món</small></div><b>${money(v.revenue)}</b></div>`).join('')
  }
}

const dishCard = (dish) => {
  const status = db.DISH_STATUS[dish.status] ?? db.DISH_STATUS.available
  const art = dish.image
    ? `<img src="${escape(dish.image)}" alt="${escape(dish.name)}" loading="lazy" />`
    : `<span>${escape(dish.emoji)}</span>`
  return `
    <article class="dish-card" data-code="${escape(dish.code)}">
      <div class="dish-art">${art}</div>
      <div class="dish-body">
        <div class="dish-title">
          <h3>${escape(dish.name)}</h3>
          <span class="dish-code">${escape(dish.code)}</span>
        </div>
        <div class="dish-vendor-admin">🏪 ${escape(dish.vendorName || 'CBM FOOD')} · ★ ${db.vendorOf(dish.vendorId).rating}</div>
        <p class="dish-desc">${escape(dish.description) || 'Chưa có mô tả.'}</p>
        <p class="dish-ingredients"><b>Nguyên liệu:</b> ${
          dish.ingredients?.length ? escape(dish.ingredients.slice(0, 4).join(', ')) : 'Chưa khai báo'
        }${dish.ingredients?.length > 4 ? '…' : ''}</p>
        <div class="dish-tags">
          <span class="tag ${status.tone === 'off' ? 'is-off' : status.tone === 'warn' ? 'is-warn' : ''}">${escape(status.label)}</span>
          ${dish.tags.map((t) => `<span class="tag">${escape(t)}</span>`).join('')}
        </div>
        <div class="dish-foot">
          <span class="price">${money(dish.price)}</span>
          <div class="row-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-action="dish-detail" data-code="${escape(dish.code)}">Chi tiết</button>
            <button type="button" class="icon-btn" data-action="dish-edit" data-code="${escape(dish.code)}" title="Sửa">✎</button>
            <button type="button" class="icon-btn is-danger" data-action="dish-delete" data-code="${escape(dish.code)}" title="Xoá">🗑</button>
          </div>
        </div>
      </div>
    </article>`
}

const renderDishes = () => {
  const all = db.listDishes()
  el.dishSummary.textContent = `${all.length} món · ${all.filter((d) => d.status === 'available').length} đang bán`

  const rows = all.filter((dish) => {
    if (state.dishCategory !== 'all' && dish.category !== state.dishCategory) return false
    if (state.dishStatus !== 'all' && dish.status !== state.dishStatus) return false
    /* matchesQuery bỏ dấu tiếng Việt: gõ "pho bo" vẫn ra "Phở Bò",
       giống trang bán hàng. Trước đây admin dùng includes() thẳng nên
       phải gõ đúng dấu mới tìm được. */
    return matchesQuery(dish, state.dishQuery, db.CATEGORIES)
  })

  el.dishList.innerHTML = rows.length
    ? rows.map(dishCard).join('')
    : '<p class="muted">Không có món nào khớp bộ lọc.</p>'
}

const statusBadge = (status) => {
  const meta = db.ORDER_STATUS[status] ?? { label: status, tone: 'off' }
  return `<span class="badge is-${meta.tone}">${escape(meta.label)}</span>`
}

const orderCard = (order) => {
  const options = db.nextOrderStatuses(order.status)
  const actions = options
    .map((next) => {
      const meta = db.ORDER_STATUS[next]
      return `<button type="button" class="chip" data-action="order-status" data-code="${escape(
        order.code,
      )}" data-status="${next}">${escape(meta.label)}</button>`
    })
    .join('')
  const deliveryWait = order.status === 'delivering'
    ? '<small class="muted">📷 Chờ shipper gửi ảnh và xác nhận giao hàng.</small>'
    : ''
  const reviews = db.listReviewsByOrder(order.id)
  return `
    <article class="order-card" data-code="${escape(order.code)}">
      <div class="order-top">
        <strong>${escape(order.code)}</strong>
        ${statusBadge(order.status)}
      </div>
      <div class="kv">
        <span>Khách: <b>${escape(order.customer.name)}</b></span>
        <span>SĐT: <b>${escape(order.customer.phone)}</b></span>
        <span>Địa chỉ: <b>${escape(order.customer.address)}</b></span>
        <span>Shipper: <b>${escape(order.shipper?.name || 'Chưa nhận đơn')}</b></span>
        <span>Thời điểm: <b>${new Date(order.createdAt).toLocaleString('vi-VN')}</b></span>
      </div>
      <div class="line-items">
        ${order.items
          .map(
            (l) => `<div class="line-item"><span>${escape(l.name)} × ${l.qty}</span><span>${money(
              l.price * l.qty,
            )}</span></div>`,
          )
          .join('')}
      </div>
      <div class="totals">
        <span>Tạm tính: ${money(order.subtotal)}</span>
        <span>Giao hàng: ${order.shipping ? money(order.shipping) : 'Miễn phí'}</span>
        <span class="is-total">Tổng: ${money(order.total)}</span>
        ${order.note ? `<span>Ghi chú: ${escape(order.note)}</span>` : ''}
      </div>
      ${
        order.returnRequest?.status === 'requested'
          ? `<div class="admin-return is-requested">↩️ Khách yêu cầu hoàn hàng · Lý do: ${escape(order.returnRequest.reason || '')}${order.returnRequest.note ? ` · ${escape(order.returnRequest.note)}` : ''}</div>`
          : ''
      }
      ${
        order.returnInfo
          ? `<div class="admin-return">↩️ Đã hoàn hàng · Lý do: ${escape(order.returnInfo.reason || '')} · ${order.returnInfo.distanceKm || 0} km · Phí hoàn ${money(order.returnInfo.fee || 0)}</div>`
          : ''
      }
      <div class="status-actions">${
        actions || '<small class="muted">Đơn đã kết thúc, không cần thao tác.</small>'
      } ${deliveryWait}</div>
      <div class="row-actions">
        <button type="button" class="btn btn-sm btn-ghost" data-action="order-detail" data-code="${escape(order.code)}">Xem chi tiết khách hàng</button>
      </div>
      ${
        reviews.length
          ? `<div class="admin-reviews">
              <strong>Đánh giá (${reviews.length})</strong>
              ${reviews
                .map(
                  (r) => `
                <div class="admin-review${r.hidden ? ' is-hidden' : ''}" data-id="${escape(r.id)}">
                  <span class="admin-review-dish">${escape(db.dishNameOf(r.dishKey) || r.dishKey)}</span>
                  <span class="stars">${'★'.repeat(r.rating)}<i>${'★'.repeat(
                    db.RATING_MAX - r.rating,
                  )}</i></span>
                  ${r.comment ? `<em>${escape(r.comment)}</em>` : ''}
                  <button type="button" class="chip" data-action="review-hide"
                    data-id="${escape(r.id)}" data-hidden="${r.hidden ? '1' : '0'}">
                    ${r.hidden ? 'Hiện lại' : 'Ẩn'}
                  </button>
                </div>`,
                )
                .join('')}
            </div>`
          : ''
      }
    </article>`
}

const renderShipperTeam = () => {
  if (!el.shipperList) return
  const team = db.shipperStats()
  if (el.shipperSummary) el.shipperSummary.textContent = `${team.length} tài khoản shipper`
  el.shipperList.innerHTML = team.length
    ? team.map((s) => `
      <div class="mini-row shipper-admin-row">
        <span><b>🚴 ${escape(s.name)}</b><small>${escape(s.phone || s.email)}</small></span>
        <span><b>${s.total} đơn</b><small>Đang giao ${s.delivering} · Đã giao ${s.completed}</small></span>
      </div>`).join('')
    : '<p class="muted">Chưa có tài khoản shipper.</p>'
}

const renderShip = () => {
  renderShipperTeam()
  // Admin chỉ theo dõi. Trạng thái giao/hoàn thành do shipper cập nhật.
  const orders = db.listOrders().filter((o) =>
    ['pending', 'confirmed', 'delivering', 'completed'].includes(o.status) && o.deliveryMethod === 'delivery',
  )
  const delivering = orders.filter((o) => o.status === 'delivering').length
  const completed = orders.filter((o) => o.status === 'completed').length
  el.shipSummary.textContent = `${orders.length} đơn giao hàng · ${delivering} đang giao · ${completed} đã giao`

  el.shipBoard.innerHTML = orders.length
    ? orders.map((order) => {
        const waiting = order.status === 'delivering' && !order.deliveryProof?.photo
        return `<article class="ship-card">
          <div class="ship-card-head">
            <div><strong>${escape(order.code)}</strong><small>${escape(order.customer.name)}</small></div>
            ${statusBadge(order.status)}
          </div>
          <p>📍 ${escape(order.customer.address)}</p>
          <p>☎ ${escape(order.customer.phone)}</p>
          <p>🚴 Shipper: <b>${escape(order.shipper?.name || 'Chưa có shipper')}</b>${order.shipper?.phone ? ` · ${escape(order.shipper.phone)}` : ''}</p>
          <div class="ship-items">${order.items.map((i) => `<span>${escape(i.name)} × ${i.qty}</span>`).join('')}</div>
          ${order.deliveryProof?.photo ? `<div class="ship-proof-mini"><img src="${escape(order.deliveryProof.photo)}" alt="Ảnh giao hàng do shipper gửi" /><div><b>📷 Shipper đã gửi ảnh giao hàng</b><small>${order.deliveryProof.at ? new Date(order.deliveryProof.at).toLocaleString('vi-VN') : ''}</small></div></div>` : ''}
          ${order.deliveryProof?.note ? `<div class="ship-proof-note"><b>💬 Ghi chú shipper:</b> ${escape(order.deliveryProof.note)}</div>` : ''}
          ${waiting ? '<div class="ship-waiting">⏳ Đang chờ shipper gửi thông tin giao hàng...</div>' : ''}
          <div class="ship-card-foot">
            <b>${money(order.total)}</b>
            <div class="row-actions">
              <button type="button" class="btn btn-sm btn-ghost" data-action="order-detail" data-code="${escape(order.code)}">Chi tiết</button>
            </div>
          </div>
        </article>`
      }).join('')
    : '<div class="panel"><div class="panel-body"><p class="muted">Không có đơn giao hàng.</p></div></div>'
}

const renderOrders = () => {
  const all = db.listOrders()
  el.orderSummary.textContent = `${all.length} đơn · ${db.listOrdersByStatus('pending').length} chờ xác nhận`

  el.orderChips.innerHTML = [
    { id: 'all', label: 'Tất cả' },
    ...Object.entries(db.ORDER_STATUS).map(([id, meta]) => ({ id, label: meta.label })),
  ]
    .map(
      (chip) =>
        `<button type="button" class="chip ${state.orderStatus === chip.id ? 'is-active' : ''}" data-action="order-filter" data-status="${escape(
          chip.id,
        )}">${escape(chip.label)}</button>`,
    )
    .join('')

  /* Tách từ khoá + bỏ dấu để "tran thi" hay "DH2026" đều ra đúng kết quả. */
  const words = normalizeQuery(state.orderQuery).split(' ').filter(Boolean)
  const rows = all.filter((order) => {
    if (state.orderStatus !== 'all' && order.status !== state.orderStatus) return false
    if (!words.length) return true
    const haystack = normalizeQuery(
      `${order.code} ${order.customer.name} ${order.customer.phone}`,
    )
    return words.every((word) => haystack.includes(word))
  })

  el.orderList.innerHTML = rows.length
    ? rows.map(orderCard).join('')
    : '<p class="muted">Không có đơn nào khớp bộ lọc.</p>'
}

const fillCategoryOptions = () => {
  const current = el.dishCategory.value
  el.dishCategory.innerHTML = [
    '<option value="all">Tất cả danh mục</option>',
    ...db.CATEGORIES.map((c) => `<option value="${escape(c.id)}">${escape(c.name)}</option>`),
  ].join('')
  el.dishCategory.value = current
}

const render = () => {
  const hash = location.hash.replace('#/', '') || 'dashboard'
  const page = PAGES[hash] ? hash : 'dashboard'
  el.title.textContent = PAGES[page].title
  el.sub.textContent = PAGES[page].sub
  el.nav.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === page))
  el.views.forEach((view) => {
    view.hidden = view.dataset.view !== page
  })
  if (page === 'dashboard') renderStats()
  if (page === 'dishes') renderDishes()
  if (page === 'orders') renderOrders()
  if (page === 'ship') renderShip()
  if (page === 'vouchers') renderVouchers()
  if (page === 'games') renderGamesAdmin()
}

/* ---------------- voucher ---------------- */

/** Ngày -> giá trị cho ô `datetime-local` (giờ địa phương, không lệch UTC). */
const toLocalInput = (ts) => {
  if (!ts) return ''
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

const fromLocalInput = (value) => {
  const n = new Date(String(value ?? '')).getTime()
  return Number.isFinite(n) ? n : 0
}

const voucherStatusBadge = (voucher) => {
  const now = Date.now()
  if (!voucher.active) return { label: 'Đã tắt', tone: 'off' }
  if (voucher.expiresAt && now > voucher.expiresAt) return { label: 'Hết hạn', tone: 'off' }
  if (voucher.startsAt && now < voucher.startsAt) return { label: 'Chưa tới hạn', tone: 'warn' }
  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
    return { label: 'Hết lượt', tone: 'off' }
  }
  return { label: 'Đang chạy', tone: 'ok' }
}

const renderVouchers = () => {
  const all = db.listVouchers()
  const words = normalizeQuery(state.voucherQuery).split(' ').filter(Boolean)
  const rows = all.filter((voucher) => {
    if (!words.length) return true
    return words.every((w) => normalizeQuery(voucher.code).includes(w))
  })

  el.voucherSummary.textContent = `${all.length} mã · ${all.filter((v) => v.active).length} đang bật`

  el.voucherList.innerHTML = rows.length
    ? rows.map((voucher) => {
        const badge = voucherStatusBadge(voucher)
        const used = voucher.usageLimit > 0 ? `${voucher.usedCount}/${voucher.usageLimit}` : `${voucher.usedCount} lượt`
        return `
      <article class="voucher-card${voucher.active ? '' : ' is-off'}" data-code="${escape(voucher.code)}">
        <div class="voucher-main">
          <strong class="voucher-code">${escape(voucher.code)}</strong>
          <span class="badge is-${badge.tone}">${escape(badge.label)}</span>
          <span class="voucher-benefit">${escape(db.voucherLabel(voucher))}</span>
        </div>
        <div class="voucher-facts">
          <span>Đã dùng: <b>${escape(used)}</b></span>
          ${
            voucher.minOrder
              ? `<span>Đơn tối thiểu: <b>${escape(money(voucher.minOrder))}</b></span>`
              : ''
          }
          ${voucher.maxDiscount ? `<span>Giảm tối đa: <b>${escape(money(voucher.maxDiscount))}</b></span>` : ''}
          ${voucher.perUserLimit ? `<span>Tối đa/khách: <b>${voucher.perUserLimit} lần</b></span>` : ''}
          ${
            voucher.expiresAt
              ? `<span>Hết hạn: <b>${escape(new Date(voucher.expiresAt).toLocaleString('vi-VN'))}</b></span>`
              : '<span>Không hạn</span>'
          }
        </div>
        <div class="row-actions">
          <button type="button" class="icon-btn" data-action="voucher-edit" data-code="${escape(
            voucher.code,
          )}" title="Sửa">✎</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="voucher-toggle"
            data-code="${escape(voucher.code)}" data-active="${voucher.active ? '1' : '0'}">
            ${voucher.active ? 'Tắt' : 'Bật'}
          </button>
          <button type="button" class="icon-btn is-danger" data-action="voucher-delete"
            data-code="${escape(voucher.code)}" title="Xoá">🗑</button>
        </div>
      </article>`
      })
    : '<p class="muted">Không có voucher nào khớp bộ lọc.</p>'
}

/* ---------------- mini game admin ---------------- */

const GAME_ADMIN_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'config', label: 'Cấu hình' },
  { id: 'rewards', label: 'Phần thưởng' },
  { id: 'questions', label: 'Câu hỏi' },
  { id: 'history', label: 'Lịch sử' },
]

const gameTypeText = (type) => gameConfig.REWARD_TYPE_LABELS[type ?? 'none'] ?? 'Không trúng thưởng'

const gameTierText = (reward) => {
  if (reward.game === 'memory') return gameConfig.TIER_LABELS.memory[reward.tier] ?? `Bậc ${reward.tier}`
  if (reward.game === 'quiz') return gameConfig.TIER_LABELS.quiz[reward.tier] ?? reward.tier
  return 'Mọi lượt'
}

const gameBadge = (game) =>
  `<span class="game-pill">${gameConfig.GAME_ICONS[game] ?? '🎮'} ${escape(gameConfig.GAME_LABELS[game] ?? game)}</span>`

const gameHistoryStatusOptions = () => [
  { id: 'all', label: 'Tất cả trạng thái' },
  ...Object.entries(gameConfig.VOUCHER_STATUS_META).map(([id, meta]) => ({ id, label: meta.label })),
]

const renderGameOverview = () => {
  const config = gameConfig.getGameConfig()
  const stats = gameConfig.gameStats()
  const statCards = [
    { label: 'Lượt chơi đã ghi nhận', value: stats.plays },
    { label: 'Lượt nhận thưởng', value: stats.claims },
    { label: 'Tổng voucher đã phát', value: stats.vouchersIssued },
    { label: 'Voucher còn hạn', value: stats.live },
    { label: 'Voucher đã sử dụng', value: stats.used },
    { label: 'Voucher hết hạn', value: stats.expired },
    { label: 'Nhận thưởng hôm nay', value: stats.todayClaims },
    { label: 'Tỉ lệ nhận thưởng / lượt chơi', value: `${Math.round(stats.winRate * 100)}%` },
  ]

  const gameCards = gameConfig.GAME_IDS.map((id) => {
    const rules = config.games[id]
    const byGame = stats.byGame[id] ?? { claims: 0, live: 0, used: 0, expired: 0 }
    const rewards = gameConfig.listRewards(id)
    const activeRewards = rewards.filter((reward) => reward.active).length
    const ruleText =
      id === 'scratch'
        ? `Ngưỡng cào ${rules.threshold}%`
        : id === 'memory'
          ? `${rules.pairs} cặp thẻ mỗi bàn`
          : `${rules.questionCount} câu/lượt · ${config.quizQuestions.length} câu trong bank`
    return `
      <article class="game-admin-card${rules.enabled ? '' : ' is-off'}">
        <div class="game-admin-card-top">
          <span class="game-admin-icon">${gameConfig.GAME_ICONS[id]}</span>
          <div>
            <h3>${escape(gameConfig.GAME_LABELS[id])}</h3>
            <small>${escape(ruleText)}</small>
          </div>
          <span class="badge ${rules.enabled ? 'is-ok' : 'is-off'}">${rules.enabled ? 'Đang bật' : 'Đang tắt'}</span>
        </div>
        <div class="game-admin-facts">
          <span>Phần thưởng: <b>${activeRewards}/${rewards.length} đang bật</b></span>
          <span>Voucher phát ra: <b>${byGame.claims}</b></span>
          <span>Còn hạn: <b>${byGame.live}</b> · Đã dùng: <b>${byGame.used}</b> · Hết hạn: <b>${byGame.expired}</b></span>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-sm ${rules.enabled ? 'btn-ghost' : 'btn-primary'}"
            data-action="game-toggle" data-game="${id}" data-enabled="${rules.enabled ? '1' : '0'}">
            ${rules.enabled ? 'Tắt game' : 'Bật game'}
          </button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="game-admin-tab" data-tab="config">Sửa cấu hình</button>
        </div>
      </article>`
  }).join('')

  return `
    <section class="panel game-global-panel">
      <header class="panel-head">
        <div>
          <h2>Trạng thái toàn bộ mini game</h2>
          <small class="muted">Tắt toàn bộ sẽ chặn khách bắt đầu mọi game, kể cả game đang bật riêng.</small>
        </div>
        <span class="badge ${config.enabled ? 'is-ok' : 'is-off'}">${config.enabled ? 'Đang bật' : 'Đang tắt'}</span>
      </header>
      <div class="panel-body game-global-body">
        <div class="game-global-note">
          <b>${config.enabled ? 'Khách có thể chơi các game đang bật.' : 'Khách đang thấy thông báo mini game tạm đóng.'}</b>
          <small>${config.claimLimitPerDay} lượt nhận thưởng/ngày · voucher có hạn ${config.voucherTtlDays} ngày.</small>
        </div>
        <button type="button" class="btn ${config.enabled ? 'btn-ghost' : 'btn-primary'}"
          data-action="game-global-toggle" data-enabled="${config.enabled ? '1' : '0'}">
          ${config.enabled ? 'Tắt toàn bộ game' : 'Bật toàn bộ game'}
        </button>
      </div>
    </section>

    <div class="stat-grid">
      ${statCards.map((card) => `
        <article class="stat">
          <small>${escape(card.label)}</small>
          <strong>${escape(card.value)}</strong>
        </article>`).join('')}
    </div>

    <div class="game-admin-grid">${gameCards}</div>

    <section class="panel">
      <div class="panel-body">
        <p class="game-storage-note"><b>💾 Nơi lưu dữ liệu:</b> cấu hình <code>cbmfood.gameConfig</code>, lịch sử <code>cbmfood.gameRewards</code>, lượt chơi <code>cbmfood.gamePlays</code>.
        Dữ liệu nằm trong localStorage của từng trình duyệt. Hai tab cùng trình duyệt đồng bộ qua sự kiện <code>storage</code>;
        khác trình duyệt/máy hoặc chế độ ẩn danh sẽ có cấu hình và lịch sử riêng — cần backend để đồng bộ nhiều máy.</p>
      </div>
    </section>`
}

const renderGameConfigTab = () => {
  const config = gameConfig.getGameConfig()
  return `
    <form id="game-config-form" class="game-config-form" novalidate>
      <section class="panel">
        <header class="panel-head"><h2>Cấu hình chung</h2></header>
        <div class="form-grid">
          <label class="field">
            <span>Trạng thái toàn bộ game *</span>
            <select name="enabled">
              <option value="1" ${config.enabled ? 'selected' : ''}>Đang bật</option>
              <option value="0" ${config.enabled ? '' : 'selected'}>Tạm tắt toàn bộ</option>
            </select>
          </label>
          <label class="field">
            <span>Số lượt nhận thưởng mỗi ngày *</span>
            <input name="claimLimitPerDay" type="number" min="0" max="100" step="1" value="${config.claimLimitPerDay}" required />
            <small class="field-hint">0 = tạm không cho nhận thưởng; mặc định 5.</small>
          </label>
          <label class="field">
            <span>Hạn sử dụng voucher (ngày) *</span>
            <input name="voucherTtlDays" type="number" min="1" max="365" step="1" value="${config.voucherTtlDays}" required />
            <small class="field-hint">Tính từ lúc khách nhận thưởng.</small>
          </label>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Quy tắc từng game</h2></header>
        <div class="form-grid">
          <label class="field">
            <span>🃏 Cào thẻ may mắn</span>
            <select name="scratchEnabled">
              <option value="1" ${config.games.scratch.enabled ? 'selected' : ''}>Đang bật</option>
              <option value="0" ${config.games.scratch.enabled ? '' : 'selected'}>Tạm tắt</option>
            </select>
          </label>
          <label class="field">
            <span>Ngưỡng cào để mở thưởng (%) *</span>
            <input name="scratchThreshold" type="number" min="5" max="100" step="1" value="${config.games.scratch.threshold}" required />
            <small class="field-hint">Cào đủ tỉ lệ này mới lộ quà.</small>
          </label>
          <label class="field">
            <span>🔄 Lật thẻ tìm cặp</span>
            <select name="memoryEnabled">
              <option value="1" ${config.games.memory.enabled ? 'selected' : ''}>Đang bật</option>
              <option value="0" ${config.games.memory.enabled ? '' : 'selected'}>Tạm tắt</option>
            </select>
          </label>
          <label class="field">
            <span>Số cặp thẻ mỗi bàn *</span>
            <input name="memoryPairs" type="number" min="2" max="12" step="1" value="${config.games.memory.pairs}" required />
            <small class="field-hint">Cần thực đơn có ít nhất số cặp này.</small>
          </label>
          <label class="field">
            <span>🧠 Đố vui ẩm thực</span>
            <select name="quizEnabled">
              <option value="1" ${config.games.quiz.enabled ? 'selected' : ''}>Đang bật</option>
              <option value="0" ${config.games.quiz.enabled ? '' : 'selected'}>Tạm tắt</option>
            </select>
          </label>
          <label class="field">
            <span>Số câu hỏi mỗi lượt *</span>
            <input name="quizQuestionCount" type="number" min="1" max="50" step="1" value="${config.games.quiz.questionCount}" required />
            <small class="field-hint">Bank hiện có ${config.quizQuestions.length} câu; nếu đặt nhiều hơn sẽ dùng hết số câu hiện có.</small>
          </label>
        </div>
      </section>

      <div class="game-form-actions">
        <button type="submit" class="btn btn-primary">Lưu cấu hình</button>
      </div>
    </form>`
}

const renderGameRewardsTab = () => {
  const rewards = gameConfig.listRewards(state.gameRewardGame === 'all' ? null : state.gameRewardGame)
  const config = gameConfig.getGameConfig()
  return `
    <header class="view-head game-tab-head">
      <div>
        <h2>Danh sách phần thưởng</h2>
        <p class="muted">${rewards.length} phần thưởng · ${rewards.filter((reward) => reward.active).length} đang bật. Phần thưởng tắt sẽ không được bốc.</p>
      </div>
      <button type="button" class="btn btn-primary" data-action="game-reward-new">+ Thêm phần thưởng</button>
    </header>
    <div class="chip-row">
      ${[{ id: 'all', label: 'Tất cả game' }, ...gameConfig.GAME_IDS.map((id) => ({ id, label: gameConfig.GAME_LABELS[id] }))]
        .map((item) => `<button type="button" class="chip ${state.gameRewardGame === item.id ? 'is-active' : ''}"
          data-action="game-reward-filter" data-game="${item.id}">${escape(item.label)}</button>`).join('')}
    </div>
    <div class="game-reward-list">
      ${rewards.length ? rewards.map((reward) => `
        <article class="game-reward-row${reward.active ? '' : ' is-off'}">
          <div class="game-reward-main">
            <strong>${escape(reward.label)}</strong>
            ${gameBadge(reward.game)}
            <span class="badge is-info">${escape(gameTierText(reward))}</span>
            <span class="badge ${reward.active ? 'is-ok' : 'is-off'}">${reward.active ? 'Đang bật' : 'Đang tắt'}</span>
          </div>
          <div class="game-reward-facts">
            <span>Loại: <b>${escape(gameTypeText(reward.type))}</b></span>
            ${reward.type === 'percent' ? `<span>Giá trị: <b>${reward.value}%</b></span>` : ''}
            ${reward.type === 'fixed' ? `<span>Giá trị: <b>${money(reward.value)}</b></span>` : ''}
            <span>Trọng số: <b>${reward.weight}</b></span>
            ${reward.minOrder ? `<span>Đơn tối thiểu: <b>${money(reward.minOrder)}</b></span>` : ''}
            ${reward.maxDiscount ? `<span>Giảm tối đa: <b>${money(reward.maxDiscount)}</b></span>` : ''}
            <span>Tỉ lệ ước tính: <b>${(() => {
              const pool = gameConfig.listRewards(reward.game, { includeInactive: false })
              const total = pool.reduce((sum, item) => sum + item.weight, 0)
              return total > 0 ? `${Math.round((reward.weight / total) * 100)}%` : '—'
            })()}</b></span>
          </div>
          <div class="row-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-action="game-reward-toggle"
              data-id="${escape(reward.id)}" data-active="${reward.active ? '1' : '0'}">${reward.active ? 'Tắt' : 'Bật'}</button>
            <button type="button" class="icon-btn" data-action="game-reward-edit" data-id="${escape(reward.id)}" title="Sửa">✎</button>
            <button type="button" class="icon-btn is-danger" data-action="game-reward-delete" data-id="${escape(reward.id)}" title="Xoá">🗑</button>
          </div>
        </article>`).join('') : '<p class="muted">Chưa có phần thưởng nào. Bấm “Thêm phần thưởng” để tạo.</p>'}
    </div>
    <p class="game-storage-note"><b>Tổng quan cấu hình:</b> ${config.claimLimitPerDay} lượt/ngày, voucher hạn ${config.voucherTtlDays} ngày. Phần thưởng “Không trúng thưởng” vẫn có trọng số để giữ tỉ lệ hợp lý.</p>`
}

const renderGameQuestionsTab = () => {
  const questions = gameConfig.listQuizQuestions()
  const config = gameConfig.getGameConfig()
  return `
    <header class="view-head game-tab-head">
      <div>
        <h2>Bank câu hỏi đố vui</h2>
        <p class="muted">${questions.length} câu · mỗi lượt dùng ${config.games.quiz.questionCount} câu ngẫu nhiên.</p>
      </div>
      <button type="button" class="btn btn-primary" data-action="game-question-new">+ Thêm câu hỏi</button>
    </header>
    <div class="game-question-list">
      ${questions.length ? questions.map((question, index) => `
        <article class="game-question-card">
          <div class="game-question-head">
            <span class="game-question-index">Câu ${index + 1}</span>
            <p>${escape(question.prompt)}</p>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-action="game-question-edit" data-id="${escape(question.id)}" title="Sửa">✎</button>
              <button type="button" class="icon-btn is-danger" data-action="game-question-delete" data-id="${escape(question.id)}" title="Xoá">🗑</button>
            </div>
          </div>
          <ul class="game-question-options">
            ${question.options.map((option, i) => `<li class="${i === question.answer ? 'is-correct' : ''}">${i === question.answer ? '✓' : '·'} ${escape(option)}</li>`).join('')}
          </ul>
        </article>`).join('') : '<p class="muted">Bank đang trống. Hãy thêm câu hỏi để khách có thể chơi đố vui.</p>'}
    </div>
    <p class="game-storage-note">Câu hỏi lưu cùng cấu hình <code>cbmfood.gameConfig</code>. Không cho lưu câu thiếu nội dung, ít hơn 2 đáp án, đáp án trùng hoặc chưa chọn đáp án đúng.</p>`
}

const renderGameHistoryResults = () => {
  const holder = el.gameAdminBody?.querySelector('#game-history-results')
  if (!holder) return
  holder.innerHTML = renderGameHistoryResultsHtml()
}

const renderGameHistoryTab = () => {
  const stats = gameConfig.gameStats()
  return `
    <div class="stat-grid">
      ${[
        { label: 'Lượt nhận thưởng', value: stats.claims },
        { label: 'Tổng voucher đã phát', value: stats.vouchersIssued },
        { label: 'Còn hạn', value: stats.live },
        { label: 'Đã sử dụng', value: stats.used },
        { label: 'Hết hạn', value: stats.expired },
        { label: 'Đã tắt / đã xoá', value: stats.inactive + stats.deleted },
      ].map((card) => `<article class="stat"><small>${escape(card.label)}</small><strong>${card.value}</strong></article>`).join('')}
    </div>
    <div class="toolbar">
      <input type="search" id="game-history-search" value="${escape(state.gameHistoryQuery)}"
        placeholder="Tìm theo mã voucher, tên phần thưởng..." autocomplete="off" />
      <select id="game-history-status" aria-label="Trạng thái voucher">
        ${gameHistoryStatusOptions().map((option) => `<option value="${escape(option.id)}" ${state.gameHistoryStatus === option.id ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}
      </select>
      <select id="game-history-game" aria-label="Game">
        <option value="all">Tất cả game</option>
        ${[...gameConfig.GAME_IDS, 'unknown'].map((id) => `<option value="${id}" ${state.gameHistoryGame === id ? 'selected' : ''}>${escape(gameConfig.GAME_LABELS[id])}</option>`).join('')}
      </select>
    </div>
    <div id="game-history-results">${renderGameHistoryResultsHtml()}</div>
    <p class="game-storage-note">Lịch sử đọc trực tiếp từ <code>cbmfood.gameRewards</code>; trạng thái voucher lấy từ kho voucher thật nên phản ánh đúng mã còn hạn, đã dùng, hết hạn hoặc đã bị xoá.</p>`
}

const renderGameHistoryResultsHtml = () => {
  const records = gameConfig.listGameHistory({
    query: state.gameHistoryQuery,
    status: state.gameHistoryStatus,
    game: state.gameHistoryGame,
  })
  if (!records.length) return '<p class="muted">Không có lịch sử nào khớp bộ lọc.</p>'
  return `<div class="game-history-table-wrap">
    <table class="game-history-table">
      <thead><tr><th>Mã voucher</th><th>Game</th><th>Phần thưởng</th><th>Thời gian nhận</th><th>Trạng thái</th></tr></thead>
      <tbody>
        ${records.map((record) => `
          <tr>
            <td><code>${escape(record.code)}</code></td>
            <td>${escape(record.gameLabel)}</td>
            <td>${escape(record.label)}</td>
            <td>${new Date(Number(record.at) || 0).toLocaleString('vi-VN')}</td>
            <td><span class="badge is-${escape(record.statusTone)}">${escape(record.statusLabel)}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

const renderGamesAdmin = () => {
  if (!el.gameAdminBody) return
  const stats = gameConfig.gameStats()
  const config = gameConfig.getGameConfig()
  if (el.gameAdminSummary) {
    el.gameAdminSummary.textContent = `${stats.plays} lượt chơi · ${stats.claims} lượt nhận thưởng · ${stats.live} voucher còn hạn · ${config.enabled ? 'game đang bật' : 'game đang tắt'}`
  }
  document.querySelectorAll('.game-admin-tab').forEach((tab) => {
    const active = tab.dataset.tab === state.gameTab
    tab.classList.toggle('is-active', active)
    tab.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  if (state.gameTab === 'overview') el.gameAdminBody.innerHTML = renderGameOverview()
  else if (state.gameTab === 'config') el.gameAdminBody.innerHTML = renderGameConfigTab()
  else if (state.gameTab === 'rewards') el.gameAdminBody.innerHTML = renderGameRewardsTab()
  else if (state.gameTab === 'questions') el.gameAdminBody.innerHTML = renderGameQuestionsTab()
  else el.gameAdminBody.innerHTML = renderGameHistoryTab()
}

const rewardTierOptions = (game, selected = '') => {
  if (game === 'memory') {
    return ['3', '2', '1'].map((tier) =>
      `<option value="${tier}" ${String(selected) === tier ? 'selected' : ''}>${gameConfig.TIER_LABELS.memory[tier]}</option>`).join('')
  }
  if (game === 'quiz') {
    return ['perfect', 'good', 'pass'].map((tier) =>
      `<option value="${tier}" ${String(selected) === tier ? 'selected' : ''}>${gameConfig.TIER_LABELS.quiz[tier]}</option>`).join('')
  }
  return '<option value="">Mọi lượt chơi</option>'
}

const gameRewardForm = (reward) => {
  const game = reward?.game ?? 'scratch'
  return `
    <form id="game-reward-form" novalidate>
      <div class="form-grid">
        <label class="field">
          <span>Game áp dụng *</span>
          <select name="game" data-role="reward-game">
            ${gameConfig.GAME_IDS.map((id) => `<option value="${id}" ${game === id ? 'selected' : ''}>${escape(gameConfig.GAME_LABELS[id])}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Bậc áp dụng *</span>
          <select name="tier" data-role="reward-tier">${rewardTierOptions(game, reward?.tier)}</select>
          <small class="field-hint">Cào thẻ dùng mọi lượt; lật thẻ theo sao; đố vui theo mức điểm.</small>
        </label>
        <label class="field">
          <span>Loại phần thưởng *</span>
          <select name="type" data-role="reward-type">
            ${Object.entries(gameConfig.REWARD_TYPE_LABELS).map(([id, label]) => {
              const value = id === 'none' ? 'none' : id
              return `<option value="${value}" ${(reward?.type ?? 'none') === value ? 'selected' : ''}>${escape(label)}</option>`
            }).join('')}
          </select>
        </label>
        <label class="field">
          <span>Tên phần thưởng *</span>
          <input name="label" value="${escape(reward?.label ?? '')}" maxlength="80" placeholder="VD: Giảm 10%" required />
        </label>
        <label class="field">
          <span>Giá trị quà</span>
          <input name="value" type="number" min="0" step="1000" value="${escape(reward?.type && reward.type !== 'freeship' ? reward.value : '')}" placeholder="Ví dụ 10 hoặc 20000" />
          <small class="field-hint" data-role="reward-value-hint">Giảm % nhập 1–100; giảm tiền nhập số tiền; miễn phí ship/không trúng bỏ trống.</small>
        </label>
        <label class="field">
          <span>Trọng số trúng thưởng *</span>
          <input name="weight" type="number" min="1" step="1" value="${escape(reward?.weight ?? 10)}" required />
          <small class="field-hint">Càng lớn càng dễ trúng.</small>
        </label>
        <label class="field">
          <span>Đơn hàng tối thiểu (đ)</span>
          <input name="minOrder" type="number" min="0" step="1000" value="${escape(reward?.minOrder ?? '')}" placeholder="Không yêu cầu" />
        </label>
        <label class="field">
          <span>Mức giảm tối đa (đ)</span>
          <input name="maxDiscount" type="number" min="0" step="1000" value="${escape(reward?.maxDiscount ?? '')}" placeholder="Không giới hạn" />
          <small class="field-hint">Chỉ dùng cho giảm %.</small>
        </label>
        <label class="field">
          <span>Trạng thái</span>
          <select name="active">
            <option value="1" ${reward?.active !== false ? 'selected' : ''}>Đang bật</option>
            <option value="0" ${reward?.active === false ? 'selected' : ''}>Đang tắt</option>
          </select>
        </label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
        <button type="submit" class="btn btn-primary">${reward ? 'Lưu thay đổi' : 'Thêm phần thưởng'}</button>
      </div>
    </form>`
}

const openGameRewardModal = (reward) => {
  lastFocused = document.activeElement
  state.editingGameReward = reward
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${reward ? 'Sửa phần thưởng' : 'Thêm phần thưởng'}">
        <header class="modal-head">
          <h2>${reward ? 'Sửa phần thưởng' : 'Thêm phần thưởng'}</h2>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">✕</button>
        </header>
        ${gameRewardForm(reward)}
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
  el.modalRoot.querySelector('[name="label"]')?.focus()
}

const quizOptionRows = (question) => {
  const options = question?.options?.length ? question.options : ['', '', '', '']
  return options.map((option, index) => `
    <div class="quiz-option-row" data-option-row>
      <input type="radio" name="answer" value="${index}" ${question ? (question.answer === index ? 'checked' : '') : index === 0 ? 'checked' : ''} aria-label="Đáp án đúng" />
      <input type="text" name="option" value="${escape(option)}" maxlength="200" placeholder="Đáp án ${index + 1}" />
      <button type="button" class="icon-btn is-danger" data-action="game-question-remove-option" title="Xoá đáp án" ${options.length <= 2 ? 'disabled' : ''}>✕</button>
    </div>`).join('')
}

const gameQuestionForm = (question) => `
  <form id="game-question-form" novalidate>
    <div class="form-grid">
      <label class="field span-2">
        <span>Nội dung câu hỏi *</span>
        <textarea name="prompt" maxlength="500" required placeholder="VD: Phở là đặc sản của vùng nào?">${escape(question?.prompt ?? '')}</textarea>
      </label>
      <div class="field span-2">
        <span>Đáp án và đáp án đúng *</span>
        <div id="quiz-option-editor" class="quiz-option-editor">
          ${quizOptionRows(question)}
        </div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="game-question-add-option">+ Thêm đáp án</button>
        <small class="field-hint">Chọn nút tròn bên trái đáp án đúng. Tối đa 6 đáp án, tối thiểu 2.</small>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
      <button type="submit" class="btn btn-primary">${question ? 'Lưu thay đổi' : 'Thêm câu hỏi'}</button>
    </div>
  </form>`

const openGameQuestionModal = (question) => {
  lastFocused = document.activeElement
  state.editingGameQuestion = question
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${question ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}">
        <header class="modal-head">
          <h2>${question ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</h2>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">✕</button>
        </header>
        ${gameQuestionForm(question)}
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
  el.modalRoot.querySelector('[name="prompt"]')?.focus()
}

const openGameConfirm = ({ title, message, action, id, label = 'Xác nhận' }) => {
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <header class="modal-head"><h2>${escape(title)}</h2></header>
        <div class="form-grid"><p>${message}</p></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
          <button type="button" class="btn btn-primary" data-action="${escape(action)}" data-id="${escape(id ?? '')}">${escape(label)}</button>
        </div>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

const openGameResetConfirm = () => openGameConfirm({
  title: 'Khôi phục cấu hình mặc định',
  message: 'Bạn có chắc muốn khôi phục toàn bộ cấu hình mini game về mặc định? <b>Lịch sử nhận thưởng và voucher đã phát sẽ được giữ nguyên.</b>',
  action: 'game-config-reset-confirm',
  label: 'Khôi phục mặc định',
})

const submitGameConfig = (form) => {
  const data = new FormData(form)
  const bool = (name) => String(data.get(name) ?? '1') === '1'
  const result = gameConfig.saveGameConfig({
    enabled: bool('enabled'),
    claimLimitPerDay: Number(data.get('claimLimitPerDay')),
    voucherTtlDays: Number(data.get('voucherTtlDays')),
    games: {
      scratch: { enabled: bool('scratchEnabled'), threshold: Number(data.get('scratchThreshold')) },
      memory: { enabled: bool('memoryEnabled'), pairs: Number(data.get('memoryPairs')) },
      quiz: { enabled: bool('quizEnabled'), questionCount: Number(data.get('quizQuestionCount')) },
    },
  })
  if (result.error) return toast(result.error, 'err')
  toast('Đã lưu cấu hình mini game')
  return renderGamesAdmin()
}

const submitGameReward = (form) => {
  const reward = state.editingGameReward
  const data = new FormData(form)
  const type = String(data.get('type') ?? 'none')
  const num = (name) => {
    const raw = String(data.get(name) ?? '').trim()
    return raw === '' ? 0 : Number(raw)
  }
  const payload = {
    game: String(data.get('game') ?? 'scratch'),
    tier: String(data.get('tier') ?? ''),
    type: type === 'none' ? 'none' : type,
    label: String(data.get('label') ?? '').trim(),
    value: type === 'percent' || type === 'fixed' ? num('value') : 0,
    weight: num('weight'),
    minOrder: num('minOrder'),
    maxDiscount: type === 'percent' ? num('maxDiscount') : 0,
    active: String(data.get('active') ?? '1') === '1',
  }
  const result = reward
    ? gameConfig.updateReward(reward.id, payload)
    : gameConfig.createReward(payload)
  if (result.error) return toast(result.error, 'err')
  toast(reward ? 'Đã cập nhật phần thưởng' : 'Đã thêm phần thưởng')
  closeModal()
  return renderGamesAdmin()
}

const submitGameQuestion = (form) => {
  const question = state.editingGameQuestion
  const data = new FormData(form)
  const inputs = [...form.querySelectorAll('[name="option"]')]
  const rawOptions = inputs.map((input) => input.value.trim())
  const selectedRaw = Number(form.querySelector('[name="answer"]:checked')?.value)
  if (!Number.isInteger(selectedRaw) || selectedRaw < 0 || selectedRaw >= rawOptions.length) {
    return toast('Vui lòng chọn một đáp án đúng', 'err')
  }
  if (!rawOptions[selectedRaw]) return toast('Đáp án đúng không được để trống', 'err')
  const kept = rawOptions.map((option, index) => ({ option, index })).filter((item) => item.option)
  const answer = kept.findIndex((item) => item.index === selectedRaw)
  const payload = {
    prompt: String(data.get('prompt') ?? '').trim(),
    options: kept.map((item) => item.option),
    answer,
  }
  const result = question
    ? gameConfig.updateQuizQuestion(question.id, payload)
    : gameConfig.createQuizQuestion(payload)
  if (result.error) return toast(result.error, 'err')
  toast(question ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi')
  closeModal()
  return renderGamesAdmin()
}


const closeModal = () => {
  el.modalRoot.innerHTML = ''
  document.body.style.overflow = ''
  state.editing = null
  state.editingVoucher = null
  state.editingGameReward = null
  state.editingGameQuestion = null
  state.imagePreviewUrl = ''
  lastFocused?.focus?.()
  lastFocused = null
}

const dishForm = (dish) => `
  <form id="dish-form" novalidate>
    <div class="form-grid">
      <label class="field span-2">
        <span>Tên món ăn *</span>
        <input name="name" value="${escape(dish?.name ?? '')}" required />
      </label>
      <label class="field span-2">
        <span>Mô tả</span>
        <textarea name="description">${escape(dish?.description ?? '')}</textarea>
      </label>
      <div class="field span-2">
        <span>Biểu tượng khi không có ảnh</span>
        <div class="emoji-grid">
          ${db.EMOJIS.map(
            (e) =>
              `<button type="button" class="emoji-opt ${
                state.emoji === e ? 'is-active' : ''
              }" data-action="pick-emoji" data-emoji="${escape(e)}">${escape(e)}</button>`,
          ).join('')}
        </div>
      </div>
      <label class="field">
        <span>Danh mục *</span>
        <select name="category">
          ${db.CATEGORIES.map(
            (c) =>
              `<option value="${escape(c.id)}" ${
                dish?.category === c.id ? 'selected' : ''
              }>${escape(c.name)}</option>`,
          ).join('')}
        </select>
      </label>
      <label class="field">
        <span>Đơn vị / cửa hàng *</span>
        <select name="vendorId">
          ${db.listVendors().map((v) => `<option value="${escape(v.id)}" ${(dish?.vendorId ?? 'cbm-food') === v.id ? 'selected' : ''}>${escape(v.name)} · ★ ${v.rating}</option>`).join('')}
        </select>
        <small class="field-hint">Mỗi món có thể thuộc một đơn vị bán riêng.</small>
      </label>
      <label class="field">
        <span>Giá bán (đ) *</span>
        <input name="price" type="number" min="0" step="1000" value="${escape(dish?.price ?? 0)}" required />
      </label>
      <label class="field">
        <span>Giá gốc (đ)</span>
        <input name="originalPrice" type="number" min="0" step="1000" value="${escape(dish?.originalPrice ?? '')}" />
      </label>
      <label class="field">
        <span>Trạng thái</span>
        <select name="status">
          ${Object.entries(db.DISH_STATUS)
            .map(
              ([id, meta]) =>
                `<option value="${escape(id)}" ${dish?.status === id ? 'selected' : ''}>${escape(
                  meta.label,
                )}</option>`,
            )
            .join('')}
        </select>
      </label>
      <label class="field span-2">
        <span>Số lượng tồn (để trống = không giới hạn)</span>
        <input name="stock" type="number" min="0" step="1" value="${escape(dish?.stock ?? '')}"
          placeholder="Không giới hạn" />
        <small class="field-hint">Khách đặt tối đa bằng số này; về 0 thì món tự ẩn khỏi cửa hàng.</small>
      </label>
      <label class="field span-2">
        <span>Nguyên liệu</span>
        <textarea name="ingredients" rows="4" placeholder="Mỗi nguyên liệu một dòng hoặc ngăn cách bằng dấu phẩy">${escape(
          dish?.ingredients?.join('\n') ?? '',
        )}</textarea>
        <small class="field-hint">Ví dụ: Thịt bò, Bánh phở, Hành, Gừng, Quế, Hồi.</small>
      </label>
      <label class="field span-2">
        <span>Ảnh món ăn</span>
        <input name="imageFile" type="file" accept="image/*" />
        <small class="field-hint">Chọn ảnh từ máy tính/điện thoại. Hệ thống tự nén ảnh để lưu vào dữ liệu app, không cần nhập URL.</small>
        <div class="dish-image-preview" id="dish-image-preview">${dish?.image ? `<img src="${escape(dish.image)}" alt="Ảnh hiện tại" />` : '<span>Chưa có ảnh món</span>'}</div>
      </label>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
      <button type="submit" class="btn btn-primary">${dish ? 'Lưu thay đổi' : 'Thêm món'}</button>
    </div>
  </form>`

const openDishModal = (dish) => {
  lastFocused = document.activeElement
  state.editing = dish
  state.emoji = dish?.emoji ?? db.EMOJIS[0]
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${
        dish ? 'Sửa món ăn' : 'Thêm món ăn'
      }">
        <header class="modal-head">
          <h2>${dish ? 'Sửa món ăn' : 'Thêm món ăn'}</h2>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">✕</button>
        </header>
        ${dishForm(dish)}
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
  el.modalRoot.querySelector('[name="name"]')?.focus()
}

const openOrderDetail = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn hàng', 'err')
  const customer = order.customer ?? {}
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal order-detail-modal" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div><h2>Chi tiết đơn ${escape(order.code)}</h2><small class="muted">${escape(db.ORDER_STATUS[order.status]?.label ?? order.status)}</small></div>
          <button type="button" class="icon-btn" data-action="close-modal">✕</button>
        </header>
        <div class="order-detail-grid">
          <section class="detail-box">
            <h3>Thông tin khách hàng</h3>
            <p><b>Họ tên:</b> ${escape(customer.name)}</p>
            <p><b>Số điện thoại:</b> ${escape(customer.phone)}</p>
            <p><b>Địa chỉ:</b> ${escape(customer.address)}</p>
            <p><b>Ghi chú:</b> ${escape(order.note || 'Không có')}</p>
          </section>
          <section class="detail-box">
            <h3>Món đã đặt</h3>
            ${order.items.map((item) => {
              const dish = db.findDish(item.key)
              return `<div class="detail-line"><span>${escape(item.name)} × ${item.qty}</span><b>${money(item.price * item.qty)}</b>
                ${dish?.ingredients?.length ? `<small>Nguyên liệu: ${escape(dish.ingredients.join(', '))}</small>` : ''}</div>`
            }).join('')}
          </section>
          <section class="detail-box">
            <h3>Thanh toán</h3>
            <p>Tạm tính: <b>${money(order.subtotal)}</b></p>
            <p>Giảm giá: <b>−${money(order.discount)}</b></p>
            <p>Phí giao hàng: <b>${order.shipping ? money(order.shipping) : 'Miễn phí'}</b></p>
            <p>Phương thức: <b>${order.paymentMethod === 'momo' ? 'MoMo' : order.paymentMethod === 'bank' ? 'Chuyển khoản' : 'Thanh toán khi nhận'}</b></p>
            <p>Trạng thái thanh toán: <b>${order.paymentStatus === 'paid' ? 'Đã thanh toán' : order.paymentStatus === 'pending' ? 'Chờ thanh toán' : 'Chưa thanh toán'}</b></p>
            <p class="detail-total">Tổng: ${money(order.total)}</p>
            ${order.deliveryProof?.photo ? `<div class="delivery-proof"><b>📷 Thông tin shipper gửi về</b><img src="${escape(order.deliveryProof.photo)}" alt="Ảnh giao hàng do shipper gửi" /><small>Shipper: ${escape(order.shipper?.name || 'Không rõ')}${order.shipper?.phone ? ` · ${escape(order.shipper.phone)}` : ''}</small>${order.deliveryProof.at ? `<small>Thời gian: ${new Date(order.deliveryProof.at).toLocaleString('vi-VN')}</small>` : ''}${order.deliveryProof.note ? `<p>Ghi chú: ${escape(order.deliveryProof.note)}</p>` : ''}</div>` : '<p class="muted">Chưa có thông tin giao hàng từ shipper.</p>'}
          </section>
          <section class="detail-box">
            <h3>Lịch sử đơn</h3>
            ${(order.history ?? []).map((h) => `<p>• ${escape(db.ORDER_STATUS[h.status]?.label ?? h.status)} — ${new Date(h.at).toLocaleString('vi-VN')}</p>`).join('')}
          </section>
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-primary" data-action="close-modal">Đóng</button></div>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

/* ---------------- actions ---------------- */

const compressImageFile = (file, maxSide = 1200, quality = 0.82) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('read-failed'))
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error('image-failed'))
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas-failed'))
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.src = String(reader.result || '')
  }
  reader.readAsDataURL(file)
})

const submitDish = async (form) => {
  const dish = state.editing
  const data = new FormData(form)
  const rawOriginal = String(data.get('originalPrice') ?? '').trim()
  const rawStock = String(data.get('stock') ?? '').trim()
  const payload = {
    name: String(data.get('name') ?? '').trim(),
    description: String(data.get('description') ?? '').trim(),
    category: String(data.get('category') ?? ''),
    vendorId: String(data.get('vendorId') ?? 'cbm-food'),
    price: Number(data.get('price') ?? 0),
    originalPrice: rawOriginal === '' ? null : Number(rawOriginal),
    stock: rawStock === '' ? null : Number(rawStock),
    status: String(data.get('status') ?? 'available'),
    image: dish?.image ?? '',
    ingredients: String(data.get('ingredients') ?? '')
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
    emoji: state.emoji,
  }
  if (!payload.name) return toast('Vui lòng nhập tên món', 'err')
  if (rawOriginal !== '' && !Number.isFinite(payload.originalPrice)) return toast('Giá gốc không hợp lệ', 'err')
  if (rawStock !== '' && (!Number.isFinite(payload.stock) || payload.stock < 0)) return toast('Số lượng tồn không hợp lệ', 'err')

  const imageFile = data.get('imageFile')
  if (imageFile instanceof File && imageFile.size) {
    if (!imageFile.type.startsWith('image/')) return toast('Vui lòng chọn đúng file ảnh', 'err')
    if (imageFile.size > 8 * 1024 * 1024) return toast('Ảnh món tối đa 8MB', 'err')
    try {
      payload.image = await compressImageFile(imageFile, 1000, 0.72)
    } catch {
      return toast('Không đọc được ảnh món ăn', 'err')
    }
  }

  const result = dish ? db.updateDish(dish.code, payload) : db.createDish(payload)
  if (result?.error) return toast(result.error, 'err')
  if (!result) return toast('Không lưu được món ăn', 'err')
  toast(dish ? `Đã cập nhật ${result.name}` : `Đã thêm ${result.name}`)
  closeModal()
  fillCategoryOptions()
  render()
}

/* ---------------- voucher form ---------------- */

const voucherForm = (voucher) => `
  <form id="voucher-form" novalidate>
    <div class="form-grid">
      <label class="field">
        <span>Mã voucher *</span>
        <input name="code" value="${escape(voucher?.code ?? '')}" maxlength="20"
          placeholder="VD: GIAM10" required />
        <small class="field-hint">Chỉ chữ in hoa và số, không khoảng trắng.</small>
      </label>
      <label class="field">
        <span>Loại giảm *</span>
        <select name="type">
          ${Object.entries(db.VOUCHER_TYPES)
            .map(
              ([id, meta]) =>
                `<option value="${escape(id)}" ${
                  (voucher?.type ?? 'percent') === id ? 'selected' : ''
                }>${escape(meta.label)}</option>`,
            )
            .join('')}
        </select>
      </label>
      <label class="field">
        <span>Mức giảm *</span>
        <input name="value" type="number" min="1" step="1"
          value="${escape(voucher && voucher.type !== 'freeship' ? voucher.value : '')}"
          placeholder="${escape(db.VOUCHER_TYPES[voucher?.type ?? 'percent'].hint)}" />
        <small class="field-hint" data-role="value-hint">${escape(
          db.VOUCHER_TYPES[voucher?.type ?? 'percent'].hint,
        )}</small>
      </label>
      <label class="field">
        <span>Đơn tối thiểu (đ)</span>
        <input name="minOrder" type="number" min="0" step="1000"
          value="${escape(voucher?.minOrder ?? '')}" placeholder="Không yêu cầu" />
      </label>
      <label class="field">
        <span>Giảm tối đa (đ)</span>
        <input name="maxDiscount" type="number" min="0" step="1000"
          value="${escape(voucher?.maxDiscount ?? '')}" placeholder="Không giới hạn" />
        <small class="field-hint">Chỉ áp dụng cho mã giảm %.</small>
      </label>
      <label class="field">
        <span>Tổng lượt dùng</span>
        <input name="usageLimit" type="number" min="0" step="1"
          value="${escape(voucher?.usageLimit ?? '')}" placeholder="Không giới hạn" />
      </label>
      <label class="field">
        <span>Lượt tối đa mỗi khách</span>
        <input name="perUserLimit" type="number" min="0" step="1"
          value="${escape(voucher?.perUserLimit ?? '')}" placeholder="Không giới hạn" />
      </label>
      <label class="field">
        <span>Bắt đầu</span>
        <input name="startsAt" type="datetime-local" value="${escape(toLocalInput(voucher?.startsAt))}" />
      </label>
      <label class="field">
        <span>Hết hạn</span>
        <input name="expiresAt" type="datetime-local" value="${escape(
          toLocalInput(voucher?.expiresAt),
        )}" />
      </label>
      <label class="field span-2">
        <span>Trạng thái</span>
        <select name="active">
          <option value="1" ${voucher?.active !== false ? 'selected' : ''}>Đang bật</option>
          <option value="0" ${voucher?.active === false ? 'selected' : ''}>Đã tắt</option>
        </select>
      </label>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
      <button type="submit" class="btn btn-primary">${
        voucher ? 'Lưu thay đổi' : 'Thêm voucher'
      }</button>
    </div>
  </form>`

const openVoucherModal = (voucher) => {
  lastFocused = document.activeElement
  state.editingVoucher = voucher
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${
        voucher ? 'Sửa voucher' : 'Thêm voucher'
      }">
        <header class="modal-head">
          <h2>${voucher ? 'Sửa voucher' : 'Thêm voucher'}</h2>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">✕</button>
        </header>
        ${voucherForm(voucher)}
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
  el.modalRoot.querySelector('[name="code"]')?.focus()
}

const submitVoucher = (form) => {
  const voucher = state.editingVoucher
  const data = new FormData(form)
  const num = (name) => {
    const raw = String(data.get(name) ?? '').trim()
    return raw === '' ? 0 : Number(raw)
  }
  const type = String(data.get('type') ?? 'percent')
  const payload = {
    code: String(data.get('code') ?? '').trim(),
    type,
    value: type === 'freeship' ? 0 : num('value'),
    minOrder: num('minOrder'),
    maxDiscount: type === 'percent' ? num('maxDiscount') : 0,
    usageLimit: num('usageLimit'),
    perUserLimit: num('perUserLimit'),
    startsAt: fromLocalInput(data.get('startsAt')),
    expiresAt: fromLocalInput(data.get('expiresAt')),
    active: String(data.get('active') ?? '1') === '1',
  }

  const result = voucher
    ? db.updateVoucher(voucher.code, payload)
    : db.createVoucher(payload)
  if (result?.error) return toast(result.error, 'err')
  toast(voucher ? `Đã cập nhật ${result.voucher.code}` : `Đã tạo mã ${result.voucher.code}`)
  closeModal()
  return render()
}

const openDeliveryProofModal = (code) => {
  const order = db.findOrder(code)
  if (!order) return toast('Không tìm thấy đơn hàng', 'err')
  state.deliveryOrder = order
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal delivery-proof-modal" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div><h2>📷 Xác nhận giao hàng</h2><small class="muted">${escape(order.code)} · ${escape(order.customer.name)}</small></div>
          <button type="button" class="icon-btn" data-action="close-modal">✕</button>
        </header>
        <form id="delivery-proof-form">
          <div class="form-grid">
            <label class="field"><span>Tên shipper *</span><input name="shipperName" value="${escape(order.shipper?.name ?? '')}" placeholder="Nguyễn Văn Shipper" required /></label>
            <label class="field span-2"><span>Ảnh khi giao hàng *</span><input name="photo" type="file" accept="image/*" capture="environment" required /></label>
            <div class="proof-preview span-2" id="proof-preview">${order.deliveryProof?.photo ? `<img src="${escape(order.deliveryProof.photo)}" alt="Ảnh giao hàng hiện tại" />` : '<span>Chụp ảnh món hàng trước khi giao cho khách</span>'}</div>
            <label class="field span-2"><span>Ghi chú giao hàng</span><textarea name="note" placeholder="Khách đã nhận đủ món, thu tiền COD..."></textarea></label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
            <button type="submit" class="btn btn-primary">Xác nhận đã giao</button>
          </div>
        </form>
      </div>
    </div>`
  document.body.style.overflow = 'hidden'
}

const confirmDelete = (code) => {
  const dish = db.findDish(code)
  if (!dish) return toast('Không tìm thấy món', 'err')
  el.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <header class="modal-head"><h2>Xoá món ăn</h2></header>
        <div class="form-grid"><p>Bạn có chắc muốn xoá <b>${escape(dish.name)}</b>?</p></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Giữ lại</button>
          <button type="button" class="btn btn-primary" data-action="dish-delete-confirm" data-code="${escape(
            dish.code,
          )}">Xoá</button>
        </div>
      </div>
    </div>`
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]')
  if (target) {
    const action = target.dataset.action
    if (action === 'revenue-period') {
      const report = el.revenueReport
      if (report) {
        const period = target.dataset.period
        const now = new Date()
        report.dataset.period = period
        report.dataset.value = period === 'year' ? String(now.getFullYear()) : period === 'month' ? now.toISOString().slice(0,7) : now.toISOString().slice(0,10)
        renderStats()
      }
      return
    }
    if (action === 'close-modal') return closeModal()
    if (action === 'pick-emoji') {
      event.preventDefault()
      state.emoji = target.dataset.emoji
      target.closest('.emoji-grid')?.querySelectorAll('.emoji-opt').forEach((b) => b.classList.remove('is-active'))
      target.classList.add('is-active')
      return undefined
    }
    if (action === 'order-filter') {
      state.orderStatus = target.dataset.status
      return renderOrders()
    }
    if (action === 'review-hide') {
      if (deny()) return undefined
      db.setReviewHidden(target.dataset.id, target.dataset.hidden !== '1')
      return renderOrders()
    }
    if (action === 'order-status') {
      if (deny()) return undefined
      const updated = db.updateOrderStatus(target.dataset.code, target.dataset.status)
      if (!updated) return toast('Không cập nhật được đơn', 'err')
      toast(`${updated.code} → ${db.ORDER_STATUS[updated.status].label}`)
      /* render() để số liệu tổng quan (doanh thu, đơn chờ) cũng cập nhật,
         không chỉ riêng danh sách đơn. */
      return render()
    }
    if (action === 'dish-new') {
      if (deny()) return undefined
      return openDishModal(null)
    }
    if (action === 'dish-detail') {
      if (deny()) return undefined
      const dish = db.findDish(target.dataset.code)
      if (!dish) return toast('Không tìm thấy món', 'err')
      el.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal"><header class="modal-head"><h2>Chi tiết ${escape(dish.name)}</h2><button class="icon-btn" data-action="close-modal">✕</button></header><div class="form-grid"><p>${escape(dish.description || 'Chưa có mô tả.')}</p><div class="detail-box"><h3>Nguyên liệu</h3>${dish.ingredients?.length ? `<ul class="ingredient-list">${dish.ingredients.map(i => `<li>${escape(i)}</li>`).join('')}</ul>` : '<p class="muted">Chưa khai báo nguyên liệu.</p>'}</div><p><b>Giá:</b> ${money(dish.price)} · <b>Đã bán:</b> ${dish.sold} phần · <b>Tồn:</b> ${dish.stock === null ? 'Không giới hạn' : dish.stock}</p></div><div class="modal-foot"><button class="btn btn-primary" data-action="close-modal">Đóng</button></div></div></div>`
      document.body.style.overflow = 'hidden'
      return undefined
    }
    if (action === 'order-detail') {
      if (deny()) return undefined
      return openOrderDetail(target.dataset.code)
    }
    if (action === 'dish-edit') {
      if (deny()) return undefined
      const dish = db.findDish(target.dataset.code)
      return dish ? openDishModal(dish) : toast('Không tìm thấy món', 'err')
    }
    if (action === 'dish-delete') {
      if (deny()) return undefined
      return confirmDelete(target.dataset.code)
    }
    if (action === 'dish-delete-confirm') {
      if (deny()) return undefined
      const code = target.dataset.code
      const removed = db.findDish(code)
      const ok = db.deleteDish(code)
      toast(ok ? `Đã xoá ${removed?.name ?? 'món ăn'}` : 'Không xoá được', ok ? '' : 'err')
      if (ok) closeModal()
      return render()
    }
    if (action === 'voucher-new') {
      if (deny()) return undefined
      return openVoucherModal(null)
    }
    if (action === 'voucher-edit') {
      if (deny()) return undefined
      const voucher = db.findVoucher(target.dataset.code)
      return voucher ? openVoucherModal(voucher) : toast('Không tìm thấy voucher', 'err')
    }
    if (action === 'voucher-toggle') {
      if (deny()) return undefined
      const updated = db.setVoucherActive(target.dataset.code, target.dataset.active !== '1')
      if (!updated) return toast('Không đổi được trạng thái voucher', 'err')
      toast(`${updated.code} ${updated.active ? 'đã bật' : 'đã tắt'}`)
      return render()
    }
    if (action === 'voucher-delete') {
      if (deny()) return undefined
      const voucher = db.findVoucher(target.dataset.code)
      if (!voucher) return toast('Không tìm thấy voucher', 'err')
      const used = voucher.usedCount
      el.modalRoot.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" role="dialog" aria-modal="true">
            <header class="modal-head"><h2>Xoá voucher</h2></header>
            <div class="form-grid">
              <p>Bạn có chắc muốn xoá mã <b>${escape(voucher.code)}</b>?</p>
              ${
                used
                  ? `<p class="muted">Mã đã dùng ${used} lượt. Xoá đi thì các đơn đã áp vẫn giữ nguyên số tiền đã giảm.</p>`
                  : ''
              }
            </div>
            <div class="modal-foot">
              <button type="button" class="btn btn-ghost" data-action="close-modal">Huỷ</button>
              <button type="button" class="btn btn-primary" data-action="voucher-delete-confirm"
                data-code="${escape(voucher.code)}">Xoá voucher</button>
            </div>
          </div>
        </div>`
      document.body.style.overflow = 'hidden'
      return undefined
    }
    if (action === 'voucher-delete-confirm') {
      if (deny()) return undefined
      const ok = db.deleteVoucher(target.dataset.code)
      toast(ok ? 'Đã xoá voucher' : 'Không xoá được', ok ? '' : 'err')
      if (ok) closeModal()
      return render()
    }
    if (action === 'game-admin-tab') {
      const tab = target.dataset.tab
      if (!GAME_ADMIN_TABS.some((item) => item.id === tab)) return undefined
      state.gameTab = tab
      return renderGamesAdmin()
    }
    if (action === 'game-global-toggle') {
      if (deny()) return undefined
      const config = gameConfig.getGameConfig()
      const result = gameConfig.saveGameConfig({ enabled: target.dataset.enabled !== '1' })
      if (result.error) return toast(result.error, 'err')
      toast(config.enabled ? 'Đã tắt toàn bộ mini game' : 'Đã bật toàn bộ mini game')
      return renderGamesAdmin()
    }
    if (action === 'game-toggle') {
      if (deny()) return undefined
      const game = target.dataset.game
      const config = gameConfig.getGameConfig()
      if (!config.games[game]) return toast('Game không hợp lệ', 'err')
      const enabled = target.dataset.enabled !== '1'
      const result = gameConfig.saveGameConfig({ games: { [game]: { enabled } } })
      if (result.error) return toast(result.error, 'err')
      toast(`${gameConfig.GAME_LABELS[game]} ${enabled ? 'đã bật' : 'đã tắt'}`)
      return renderGamesAdmin()
    }
    if (action === 'game-config-reset') {
      if (deny()) return undefined
      return openGameResetConfirm()
    }
    if (action === 'game-config-reset-confirm') {
      if (deny()) return undefined
      gameConfig.resetGameConfig()
      toast('Đã khôi phục cấu hình mini game mặc định')
      closeModal()
      return renderGamesAdmin()
    }
    if (action === 'game-reward-filter') {
      state.gameRewardGame = target.dataset.game
      return renderGamesAdmin()
    }
    if (action === 'game-reward-new') {
      if (deny()) return undefined
      return openGameRewardModal(null)
    }
    if (action === 'game-reward-edit') {
      if (deny()) return undefined
      const reward = gameConfig.findReward(target.dataset.id)
      return reward ? openGameRewardModal(reward) : toast('Không tìm thấy phần thưởng', 'err')
    }
    if (action === 'game-reward-toggle') {
      if (deny()) return undefined
      const result = gameConfig.setRewardActive(target.dataset.id, target.dataset.active !== '1')
      if (result.error) return toast(result.error, 'err')
      toast(result.reward.active ? 'Đã bật phần thưởng' : 'Đã tắt phần thưởng')
      return renderGamesAdmin()
    }
    if (action === 'game-reward-delete') {
      if (deny()) return undefined
      const reward = gameConfig.findReward(target.dataset.id)
      if (!reward) return toast('Không tìm thấy phần thưởng', 'err')
      return openGameConfirm({
        title: 'Xoá phần thưởng',
        message: `Bạn có chắc muốn xoá <b>${escape(reward.label)}</b> (${escape(gameConfig.GAME_LABELS[reward.game])})? Các voucher đã phát từ phần thưởng này vẫn giữ nguyên.`,
        action: 'game-reward-delete-confirm',
        id: reward.id,
        label: 'Xoá phần thưởng',
      })
    }
    if (action === 'game-reward-delete-confirm') {
      if (deny()) return undefined
      const result = gameConfig.deleteReward(target.dataset.id)
      if (result.error) return toast(result.error, 'err')
      toast('Đã xoá phần thưởng')
      closeModal()
      return renderGamesAdmin()
    }
    if (action === 'game-question-new') {
      if (deny()) return undefined
      return openGameQuestionModal(null)
    }
    if (action === 'game-question-edit') {
      if (deny()) return undefined
      const question = gameConfig.findQuizQuestion(target.dataset.id)
      return question ? openGameQuestionModal(question) : toast('Không tìm thấy câu hỏi', 'err')
    }
    if (action === 'game-question-delete') {
      if (deny()) return undefined
      const question = gameConfig.findQuizQuestion(target.dataset.id)
      if (!question) return toast('Không tìm thấy câu hỏi', 'err')
      return openGameConfirm({
        title: 'Xoá câu hỏi',
        message: `Bạn có chắc muốn xoá câu hỏi <b>${escape(question.prompt)}</b>?`,
        action: 'game-question-delete-confirm',
        id: question.id,
        label: 'Xoá câu hỏi',
      })
    }
    if (action === 'game-question-delete-confirm') {
      if (deny()) return undefined
      const result = gameConfig.deleteQuizQuestion(target.dataset.id)
      if (result.error) return toast(result.error, 'err')
      toast('Đã xoá câu hỏi')
      closeModal()
      return renderGamesAdmin()
    }
    if (action === 'game-question-add-option') {
      const editor = el.modalRoot.querySelector('#quiz-option-editor')
      if (!editor) return undefined
      if (editor.querySelectorAll('[data-option-row]').length >= 6) {
        return toast('Tối đa 6 đáp án', 'err')
      }
      const index = editor.querySelectorAll('[data-option-row]').length
      editor.insertAdjacentHTML('beforeend', `
        <div class="quiz-option-row" data-option-row>
          <input type="radio" name="answer" value="${index}" aria-label="Đáp án đúng" />
          <input type="text" name="option" value="" maxlength="200" placeholder="Đáp án ${index + 1}" />
          <button type="button" class="icon-btn is-danger" data-action="game-question-remove-option" title="Xoá đáp án">✕</button>
        </div>`)
      editor.querySelectorAll('[data-option-row]').forEach((row, i) => {
        row.querySelector('[name="answer"]').value = i
        row.querySelector('[name="option"]').placeholder = `Đáp án ${i + 1}`
      })
      return undefined
    }
    if (action === 'game-question-remove-option') {
      const editor = el.modalRoot.querySelector('#quiz-option-editor')
      const row = target.closest('[data-option-row]')
      if (!editor || !row) return undefined
      if (editor.querySelectorAll('[data-option-row]').length <= 2) {
        return toast('Câu hỏi phải có ít nhất 2 đáp án', 'err')
      }
      row.remove()
      editor.querySelectorAll('[data-option-row]').forEach((item, i) => {
        item.querySelector('[name="answer"]').value = i
        item.querySelector('[name="option"]').placeholder = `Đáp án ${i + 1}`
      })
      return undefined
    }
    if (action === 'reset') {
      if (deny()) return undefined
      db.resetDishes()
      toast('Đã khôi phục dữ liệu mẫu')
      fillCategoryOptions()
      return render()
    }
    return undefined
  }

  if (event.target.classList.contains('modal-backdrop')) closeModal()
})

el.modalRoot.addEventListener('change', (event) => {
  if (event.target.name === 'game' && event.target.closest('#game-reward-form')) {
    const form = event.target.closest('form')
    const tier = form.querySelector('[data-role="reward-tier"]')
    if (tier) tier.innerHTML = rewardTierOptions(event.target.value, '')
    return
  }
  if (event.target.name !== 'imageFile') return
  const file = event.target.files?.[0]
  const preview = el.modalRoot.querySelector('#dish-image-preview')
  if (!preview || !file) return
  if (!file.type.startsWith('image/')) return toast('Vui lòng chọn đúng file ảnh', 'err')
  const url = URL.createObjectURL(file)
  preview.innerHTML = `<img src="${escape(url)}" alt="Ảnh xem trước" />`
})

el.modalRoot.addEventListener('submit', (event) => {
  if (event.target.id === 'dish-form') {
    event.preventDefault()
    return submitDish(event.target)
  }
  if (event.target.id === 'voucher-form') {
    event.preventDefault()
    return submitVoucher(event.target)
  }
  if (event.target.id === 'game-reward-form') {
    event.preventDefault()
    return submitGameReward(event.target)
  }
  if (event.target.id === 'game-question-form') {
    event.preventDefault()
    return submitGameQuestion(event.target)
  }
  return undefined
})

if (el.gameAdminBody) {
  el.gameAdminBody.addEventListener('submit', (event) => {
    if (event.target.id !== 'game-config-form') return
    event.preventDefault()
    submitGameConfig(event.target)
  })
  el.gameAdminBody.addEventListener('input', (event) => {
    if (event.target.id !== 'game-history-search') return
    state.gameHistoryQuery = event.target.value
    renderGameHistoryResults()
  })
  el.gameAdminBody.addEventListener('change', (event) => {
    if (event.target.id === 'game-history-status') {
      state.gameHistoryStatus = event.target.value
      renderGameHistoryResults()
      return
    }
    if (event.target.id === 'game-history-game') {
      state.gameHistoryGame = event.target.value
      renderGameHistoryResults()
    }
  })
}

el.gateForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  showGateError('')
  const data = new FormData(el.gateForm)
  const result = await auth.login({
    email: String(data.get('email') ?? ''),
    password: String(data.get('password') ?? ''),
  })
  if (result.error) return showGateError(result.error)
  if (!auth.canAccessAdmin()) return showGateError('Tài khoản này không có quyền quản trị')
  showAdmin(result.user)
  toast(`Chào ${result.user.name}`)
  fillCategoryOptions()
  return render()
})

el.logout.addEventListener('click', () => {
  auth.logout()
  showGate()
  toast('Đã đăng xuất')
})

el.dishSearch.addEventListener('input', (event) => {
  state.dishQuery = event.target.value
  renderDishes()
})
el.dishCategory.addEventListener('change', (event) => {
  state.dishCategory = event.target.value
  renderDishes()
})
el.dishStatus.addEventListener('change', (event) => {
  state.dishStatus = event.target.value
  renderDishes()
})
el.orderSearch.addEventListener('input', (event) => {
  state.orderQuery = event.target.value
  renderOrders()
})
el.voucherSearch.addEventListener('input', (event) => {
  state.voucherQuery = event.target.value
  renderVouchers()
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  /* Escape chỉ đóng hộp thoại. Trước đây khi không có hộp nào mở thì Escape
     lại gọi auth.logout() — bấm Escape một lần là mất phiên đăng nhập. */
  if (el.modalRoot.innerHTML) closeModal()
})

document.addEventListener('change', (event) => {
  if (event.target.id !== 'revenue-date' || !el.revenueReport) return
  el.revenueReport.dataset.value = event.target.value
  renderStats()
})

window.addEventListener('hashchange', render)

/*
 * Quản trị và trang bán hàng hay được mở cùng nhau. `store` giữ món/đơn trong
 * bộ nhớ nên đơn khách vừa đặt ở tab kia sẽ không xuất hiện ở đây nếu không
 * nạp lại — trước đây phải bấm F5 mới thấy.
 */
window.addEventListener('storage', (event) => {
  if (event.key === 'cbmfood.session.admin') {
    /* Đăng nhập/đăng xuất ở tab quản trị khác phải có hiệu lực ngay. */
    if (syncGuard()) render()
    return
  }
  if (
    event.key !== 'cbmfood.orders' &&
    event.key !== 'cbmfood.dishes' &&
    event.key !== 'cbmfood.reviews' &&
    event.key !== 'cbmfood.vouchers'
  ) {
    if (event.key === gameConfig.GAME_CONFIG_KEY || event.key === gameConfig.GAME_REWARDS_KEY) {
      render()
    }
    return
  }
  db.reloadFromStorage()
  render()
})

async function bootstrap() {
  auth.useScope('admin')
  await auth.init()
  if (!syncGuard()) return
  fillCategoryOptions()
  render()
}

bootstrap()