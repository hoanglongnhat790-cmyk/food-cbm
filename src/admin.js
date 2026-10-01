import './admin.css'
import * as db from './store.js'
import * as auth from './auth.js'

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
  dishList: $('#dish-list'),
  dishSummary: $('#dish-summary'),
  dishSearch: $('#dish-search'),
  dishCategory: $('#dish-category'),
  dishStatus: $('#dish-status'),
  orderList: $('#order-list'),
  orderSummary: $('#order-summary'),
  orderSearch: $('#order-search'),
  orderChips: $('#order-chips'),
  modalRoot: $('#modal-root'),
  toastRoot: $('#toast-root'),
}

const PAGES = {
  dashboard: { title: 'Tổng quan', sub: 'Sức khoẻ cửa hàng hôm nay.' },
  dishes: { title: 'Món ăn', sub: 'Thêm, sửa, xoá món trong thực đơn.' },
  orders: { title: 'Đơn hàng', sub: 'Theo dõi và cập nhật trạng thái đơn.' },
}

const state = {
  dishQuery: '',
  dishCategory: 'all',
  dishStatus: 'all',
  orderQuery: '',
  orderStatus: 'all',
  editing: null,
  emoji: '',
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
        <p class="dish-desc">${escape(dish.description) || 'Chưa có mô tả.'}</p>
        <div class="dish-tags">
          <span class="tag ${status.tone === 'off' ? 'is-off' : status.tone === 'warn' ? 'is-warn' : ''}">${escape(status.label)}</span>
          ${dish.tags.map((t) => `<span class="tag">${escape(t)}</span>`).join('')}
        </div>
        <div class="dish-foot">
          <span class="price">${money(dish.price)}</span>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-action="dish-edit" data-code="${escape(dish.code)}" title="Sửa">✎</button>
            <button type="button" class="icon-btn is-danger" data-action="dish-delete" data-code="${escape(dish.code)}" title="Xoá">🗑</button>
          </div>
        </div>
      </div>
    </article>`
}

const renderDishes = () => {
  const all = db.listDishes()

  const query = state.dishQuery.toLowerCase()
  const rows = all.filter((dish) => {
    if (state.dishCategory !== 'all' && dish.category !== state.dishCategory) return false
    if (state.dishStatus !== 'all' && dish.status !== state.dishStatus) return false
    if (!query) return true
    return `${dish.name} ${dish.description}`.toLowerCase().includes(query)
  })

  /* Báo cả số đang lọc lẫn tổng, giống trang bán hàng, để thấy bộ lọc
     đang có hiệu lực. */
  const available = all.filter((d) => d.status === 'available').length
  el.dishSummary.textContent = rows.length
    ? `Hiển thị ${rows.length}/${all.length} món · ${available} đang bán`
    : `Không có món nào khớp bộ lọc · ${all.length} món trong thực đơn`

  el.dishList.innerHTML = rows.length
    ? rows.map(dishCard).join('')
    : '<p class="muted">Không có món nào khớp bộ lọc.</p>'
}

const statusBadge = (status) => {
  const meta = db.ORDER_STATUS[status] ?? { label: status, tone: 'off' }
  return `<span class="badge is-${meta.tone}">${escape(meta.label)}</span>`
}

const orderCard = (order) => {
  const actions = db.ORDER_FLOW.filter((next) => next !== order.status).map((next) => {
    const meta = db.ORDER_STATUS[next]
    return `<button type="button" class="chip" data-action="order-status" data-code="${escape(
      order.code,
    )}" data-status="${next}">${escape(meta.label)}</button>`
  })
  if (order.status !== 'cancelled') {
    actions.push(
      `<button type="button" class="chip" data-action="order-status" data-code="${escape(
        order.code,
      )}" data-status="cancelled">Huỷ đơn</button>`,
    )
  }
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
      <div class="status-actions">${actions.join('')}</div>
    </article>`
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

  const query = state.orderQuery.toLowerCase()
  const rows = all.filter((order) => {
    if (state.orderStatus !== 'all' && order.status !== state.orderStatus) return false
    if (!query) return true
    return `${order.code} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(query)
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
}

/* ---------------- modal ---------------- */

const closeModal = () => {
  el.modalRoot.innerHTML = ''
  document.body.style.overflow = ''
  state.editing = null
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
        <span>Ảnh (URL)</span>
        <input name="image" value="${escape(dish?.image ?? '')}" placeholder="https://... hoặc /ten-anh.jpg" />
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

/* ---------------- actions ---------------- */

const submitDish = (form) => {
  const dish = state.editing
  const data = new FormData(form)
  const payload = {
    name: String(data.get('name') ?? '').trim(),
    description: String(data.get('description') ?? '').trim(),
    category: String(data.get('category') ?? ''),
    price: Number(data.get('price') ?? 0),
    originalPrice: data.get('originalPrice') ? Number(data.get('originalPrice')) : undefined,
    status: String(data.get('status') ?? 'available'),
    image: String(data.get('image') ?? '').trim(),
    emoji: state.emoji,
  }
  if (!payload.name) return toast('Vui lòng nhập tên món', 'err')

  const result = dish ? db.updateDish(dish.code, payload) : db.createDish(payload)
  if (result?.error) return toast(result.error, 'err')
  if (!result) return toast('Không lưu được món ăn', 'err')
  toast(dish ? `Đã cập nhật ${result.name}` : `Đã thêm ${result.name}`)
  closeModal()
  fillCategoryOptions()
  render()
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
    if (action === 'order-status') {
      if (deny()) return undefined
      const updated = db.updateOrderStatus(target.dataset.code, target.dataset.status)
      if (!updated) return toast('Không cập nhật được đơn', 'err')
      toast(`${updated.code} → ${db.ORDER_STATUS[updated.status].label}`)
      return renderOrders()
    }
    if (action === 'dish-new') {
      if (deny()) return undefined
      return openDishModal(null)
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
      const ok = db.deleteDish(target.dataset.code)
      toast(ok ? 'Đã xoá món ăn' : 'Không xoá được', ok ? '' : 'err')
      if (ok) closeModal()
      return renderDishes()
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

el.modalRoot.addEventListener('submit', (event) => {
  if (event.target.id !== 'dish-form') return
  event.preventDefault()
  submitDish(event.target)
})

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

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  if (el.modalRoot.innerHTML) return closeModal()
  if (!el.gate.hidden) return
  auth.logout()
  showGate()
  return undefined
})

window.addEventListener('hashchange', render)

async function bootstrap() {
  await auth.init()
  if (!syncGuard()) return
  fillCategoryOptions()
  render()
}

bootstrap()