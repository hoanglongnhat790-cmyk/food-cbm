import './style.css'
import './admin.css'
import {
  ACCENTS,
  CATEGORIES,
  DISH_STATUS,
  ORDER_STATUS,
  accentOf,
} from './seed.js'
import * as store from './store.js'

/* ---------------------------------------------------------------- helpers */

const $ = (selector, scope = document) => scope.querySelector(selector)
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)]

const priceFormat = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
})

const number = (value) => priceFormat.format(Number(value) || 0)

const money = (value) => `${number(value)}đ`

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const dateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const shortTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isToday = (value) => {
  const date = new Date(value)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

const orderSubtotal = (order) =>
  (order.items ?? []).reduce((sum, item) => sum + item.price * item.qty, 0)

const orderTotal = (order) => orderSubtotal(order) + (order.shipping ?? 0)

const orderCount = (order) =>
  (order.items ?? []).reduce((sum, item) => sum + item.qty, 0)

const orderSummary = (order) =>
  (order.items ?? [])
    .map((item) => `${item.qty}x ${item.name}`)
    .join(' · ')

const ICON = {
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>',
  close:
    '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5Z"/><path d="M3 8.5 12 13l9-4.5M12 13v7"/></svg>',
  checkCircle:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  money: '<svg viewBox="0 0 24 24"><path d="M7 5 17 19M17 5 7 19"/></svg>',
  receipt:
    '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5L10 21l-2-1.5L6 21Z"/><path d="M9 8h6M9 12h6"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
}

/* ------------------------------------------------------------------ state */

const ui = {
  view: 'dashboard',
  dishQuery: '',
  dishCategory: 'all',
  dishStatus: 'all',
  dishSort: 'new',
  orderQuery: '',
  orderStatus: 'all',
}

const VIEWS = {
  dashboard: {
    title: 'Tổng quan',
    sub: 'Theo dõi hoạt động nhà hàng trong ngày hôm nay.',
  },
  dishes: {
    title: 'Quản lý món ăn',
    sub: 'Thêm, sửa, xóa và bật/tắt các món trong thực đơn.',
  },
  orders: {
    title: 'Quản lý đơn hàng',
    sub: 'Cập nhật trạng thái đơn từ lúc khách đặt đến lúc giao xong.',
  },
}

const el = {
  statGrid: $('#stat-grid'),
  recentOrders: $('#recent-orders'),
  topDishes: $('#top-dishes'),
  dishList: $('#dish-list'),
  dishSummary: $('#dish-summary'),
  dishSearch: $('#dish-search'),
  dishCategory: $('#dish-category'),
  dishStatus: $('#dish-status'),
  dishSort: $('#dish-sort'),
  orderList: $('#order-list'),
  orderSummary: $('#order-summary'),
  orderSearch: $('#order-search'),
  orderChips: $('#order-chips'),
  pageTitle: $('#page-title'),
  pageSub: $('#page-sub'),
  modalRoot: $('#modal-root'),
  toastRoot: $('#toast-root'),
}

const badge = (tone, label) =>
  `<span class="badge ${tone}">${esc(label)}</span>`

const emptyState = (icon, title, desc) => `
  <div class="empty">
    <span class="empty-icon">${icon}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(desc)}</p>
  </div>`

/* ------------------------------------------------------------------ toast */

function toast(message, tone = 'ok') {
  const node = document.createElement('div')
  node.className = `toast ${tone}`
  node.innerHTML = `${tone === 'ok' ? ICON.checkCircle : ICON.alert}<span>${esc(message)}</span>`

  el.toastRoot.append(node)
  setTimeout(() => {
    node.classList.add('out')
    setTimeout(() => node.remove(), 260)
  }, 2800)
}

/* ------------------------------------------------------------------ modal */

let activeModal = null
let activeOrderId = null

function openModal(html, { onMount, orderId = null } = {}) {
  closeModal()
  el.modalRoot.innerHTML = `<div class="modal-backdrop">${html}</div>`
  activeModal = el.modalRoot.firstElementChild
  activeOrderId = orderId
  onMount?.(activeModal)
  $('.modal', activeModal)?.focus()
}

function closeModal() {
  el.modalRoot.innerHTML = ''
  activeModal = null
  activeOrderId = null
}

el.modalRoot.addEventListener('mousedown', (event) => {
  if (event.target.classList.contains('modal-backdrop')) closeModal()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeModal) closeModal()
})

/* -------------------------------------------------------------- dashboard */

function renderStats() {
  const dishes = store.getDishes()
  const orders = store.getOrders()

  const todayOrders = orders.filter((order) => isToday(order.createdAt))
  const todayRevenue = todayOrders
    .filter((order) => order.status === 'completed')
    .reduce((sum, order) => sum + orderTotal(order), 0)
  const activeDishes = dishes.filter((dish) => dish.status !== 'unavailable')
  const cooking = orders.filter((order) =>
    ['confirmed', 'preparing', 'delivering'].includes(order.status),
  ).length

  const stats = [
    {
      icon: ICON.box,
      tone: 'brand',
      value: number(dishes.length),
      label: 'Tổng món trong thực đơn',
    },
    {
      icon: ICON.checkCircle,
      tone: 'green',
      value: number(activeDishes.length),
      label: 'Món đang bán',
    },
    {
      icon: ICON.receipt,
      tone: 'violet',
      value: number(todayOrders.length),
      label: `Đơn hôm nay${cooking ? ` (${cooking} đang xử lý)` : ''}`,
    },
    {
      icon: ICON.money,
      tone: 'gold',
      value: money(todayRevenue),
      label: 'Doanh thu hôm nay',
    },
  ]

  el.statGrid.innerHTML = stats
    .map(
      (stat) => `
      <article class="stat">
        <span class="stat-icon ${stat.tone}">${stat.icon}</span>
        <div class="stat-text">
          <strong>${esc(stat.value)}</strong>
          <span>${esc(stat.label)}</span>
        </div>
      </article>`,
    )
    .join('')
}

function renderRecentOrders() {
  const orders = [...store.getOrders()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )

  if (!orders.length) {
    el.recentOrders.innerHTML = emptyState(
      ICON.receipt,
      'Chưa có đơn hàng',
      'Các đơn khách đặt sẽ hiển thị tại đây.',
    )
    return
  }

  el.recentOrders.innerHTML = orders
    .slice(0, 6)
    .map((order) => {
      const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending
      return `
        <div class="mini-row">
          <span class="mini-thumb mini-avatar">${esc(
            (order.customer.trim().charAt(0) || '?').toUpperCase(),
          )}</span>
          <div class="mini-main">
            <strong>${esc(order.customer)}</strong>
            <span>${esc(order.id)} · ${esc(shortTime(order.createdAt))}</span>
          </div>
          <div class="mini-side">
            ${esc(money(orderTotal(order)))}
            <small>${esc(status.label)}</small>
          </div>
        </div>`
    })
    .join('')
}

function renderTopDishes() {
  const dishes = [...store.getDishes()].sort((a, b) => b.sold - a.sold)
  if (!dishes.length) {
    el.topDishes.innerHTML = emptyState(
      ICON.box,
      'Thực đơn trống',
      'Thêm món ăn đầu tiên để bắt đầu bán hàng.',
    )
    return
  }

  const top = dishes.slice(0, 6)
  const max = Math.max(...top.map((dish) => dish.sold), 1)

  el.topDishes.innerHTML = top
    .map(
      (dish) => `
      <div class="mini-row">
        <span class="mini-thumb" style="background:${accentOf(dish.accent).css}">${esc(dish.emoji)}</span>
        <div class="mini-main">
          <strong>${esc(dish.name)}</strong>
          <span>${esc(dish.category)} · ${esc(money(dish.price))}</span>
          <div class="progress"><i style="width:${Math.round((dish.sold / max) * 100)}%"></i></div>
        </div>
        <div class="mini-side">
          ${esc(number(dish.sold))}
          <small>lượt bán</small>
        </div>
      </div>`,
    )
    .join('')
}

/* ------------------------------------------------------------------ dishes */

const match = (haystack, needle) =>
  haystack.toLowerCase().includes(needle)

function visibleDishes() {
  const query = ui.dishQuery.trim().toLowerCase()

  const list = store.getDishes().filter((dish) => {
    if (ui.dishCategory !== 'all' && dish.category !== ui.dishCategory) {
      return false
    }
    if (ui.dishStatus !== 'all' && dish.status !== ui.dishStatus) return false
    if (!query) return true
    return (
      match(dish.name, query) ||
      match(dish.description, query) ||
      match(dish.category, query) ||
      match(dish.id, query)
    )
  })

  const sorters = {
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name, 'vi'),
    sold: (a, b) => b.sold - a.sold,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
  }

  return list.sort(sorters[ui.dishSort] ?? sorters.new)
}

function renderDishList() {
  const dishes = visibleDishes()
  const all = store.getDishes()
  const selling = all.filter((dish) => dish.status !== 'unavailable').length

  el.dishSummary.textContent = `Có ${all.length} món · ${selling} đang bán · hiển thị ${dishes.length} món`

  if (!dishes.length) {
    el.dishList.innerHTML = emptyState(
      ICON.search,
      'Không tìm thấy món ăn',
      all.length
        ? 'Thử xoá bớt từ khoá hoặc đổi bộ lọc để xem lại thực đơn.'
        : 'Bấm “Thêm món ăn” để thêm món đầu tiên vào thực đơn.',
    )
    return
  }

  el.dishList.innerHTML = dishes
    .map((dish) => {
      const status = DISH_STATUS[dish.status] ?? DISH_STATUS.available
      return `
      <article class="dish-card${dish.status === 'unavailable' ? ' off' : ''}">
        <div class="dish-art" style="background:${accentOf(dish.accent).css}">
          <span class="emoji" aria-hidden="true">${esc(dish.emoji)}</span>
          <span class="dish-code">${esc(dish.id)}</span>
        </div>
        <div class="dish-body">
          <h3>${esc(dish.name)}</h3>
          <div class="dish-tags">
            <span class="tag">${esc(dish.category)}</span>
            ${badge(status.tone, status.label)}
          </div>
          <p class="dish-desc">${esc(dish.description) || '<em>Chưa có mô tả</em>'}</p>
        </div>
        <div class="dish-meta">
          <div>
            <div class="dish-price">${esc(money(dish.price))}</div>
            <div class="dish-sold">Đã bán ${esc(number(dish.sold))} lượt</div>
          </div>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-action="edit-dish"
              data-id="${esc(dish.id)}" title="Sửa món">${ICON.edit}</button>
            <button type="button" class="icon-btn danger" data-action="delete-dish"
              data-id="${esc(dish.id)}" title="Xóa món">${ICON.trash}</button>
          </div>
        </div>
      </article>`
    })
    .join('')
}

function syncCategoryOptions() {
  const current = ui.dishCategory
  const used = new Set(store.getDishes().map((dish) => dish.category))
  const options = [...CATEGORIES.filter((item) => used.has(item))]
  used.forEach((item) => {
    if (!options.includes(item)) options.push(item)
  })

  el.dishCategory.innerHTML =
    '<option value="all">Tất cả danh mục</option>' +
    options
      .map(
        (item) =>
          `<option value="${esc(item)}"${item === current ? ' selected' : ''}>${esc(item)}</option>`,
      )
      .join('')
}

/* ------------------------------------------------------------ dish modals */

const EMOJIS = [
  '🍜', '🍲', '🍝', '🍚', '🍱', '🥗', '🍗', '🥖',
  '🍤', '🧋', '🍋', '🍰', '🥭', '🐟', '🍢', '☕',
]

function dishForm(dish) {
  const isEdit = Boolean(dish)

  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dish-form-title" tabindex="-1">
      <header class="modal-head">
        <div>
          <h2 id="dish-form-title">${isEdit ? 'Sửa món ăn' : 'Thêm món ăn mới'}</h2>
          <p>${isEdit ? `Mã món: ${esc(dish.id)}` : 'Điền thông tin món để đưa vào thực đơn.'}</p>
        </div>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">${ICON.close}</button>
      </header>

      <form class="modal-body" id="dish-form" novalidate>
        <div class="form-grid">
          <div class="form-field full" data-field="name">
            <label for="f-name">Tên món <span class="req">*</span></label>
            <input id="f-name" name="name" maxlength="60" value="${esc(dish?.name ?? '')}"
              placeholder="Ví dụ: Phở bò đặc biệt" />
            <span class="error"></span>
          </div>

          <div class="form-field" data-field="category">
            <label for="f-category">Danh mục <span class="req">*</span></label>
            <select id="f-category" name="category">
              ${CATEGORIES.map(
                (item) =>
                  `<option value="${esc(item)}"${item === (dish?.category ?? CATEGORIES[0]) ? ' selected' : ''}>${esc(item)}</option>`,
              ).join('')}
            </select>
            <span class="error"></span>
          </div>

          <div class="form-field" data-field="price">
            <label for="f-price">Giá bán (VNĐ) <span class="req">*</span></label>
            <input id="f-price" name="price" type="number" min="0" step="1000"
              value="${dish?.price ?? ''}" placeholder="65000" />
            <span class="error"></span>
          </div>

          <div class="form-field full" data-field="description">
            <label for="f-desc">Mô tả</label>
            <textarea id="f-desc" name="description" maxlength="180"
              placeholder="Nguyên liệu, hương vị, khẩu phần...">${esc(dish?.description ?? '')}</textarea>
            <span class="hint">Tối đa 180 ký tự.</span>
            <span class="error"></span>
          </div>

          <div class="form-field">
            <span class="form-hint-title">Màu hiển thị</span>
            <div class="picker-row">
              ${ACCENTS.map(
                (item) => `
                <button type="button" class="swatch${item.id === (dish?.accent ?? 'orange') ? ' on' : ''}"
                  style="background:${item.css}" data-accent="${esc(item.id)}"
                  title="${esc(item.label)}" aria-label="${esc(item.label)}"></button>`,
              ).join('')}
            </div>
          </div>

          <div class="form-field">
            <span class="form-hint-title">Biểu tượng</span>
            <div class="emoji-grid">
              ${EMOJIS.map(
                (emoji) => `
                <label class="emoji-opt${emoji === (dish?.emoji ?? EMOJIS[0]) ? ' on' : ''}">
                  <input type="radio" name="emoji" value="${emoji}"${emoji === (dish?.emoji ?? EMOJIS[0]) ? ' checked' : ''} />
                  <span aria-hidden="true">${emoji}</span>
                </label>`,
              ).join('')}
            </div>
          </div>

          <div class="form-field full" data-field="status">
            <label for="f-status">Trạng thái</label>
            <select id="f-status" name="status">
              ${Object.entries(DISH_STATUS)
                .map(
                  ([value, meta]) =>
                    `<option value="${value}"${value === (dish?.status ?? 'available') ? ' selected' : ''}>${meta.label}</option>`,
                )
                .join('')}
            </select>
            <span class="error"></span>
          </div>
        </div>
      </form>

      <footer class="modal-foot">
        <button type="button" class="btn btn-outline" data-action="close-modal">Huỷ bỏ</button>
        <button type="submit" form="dish-form" class="btn btn-primary">
          ${isEdit ? 'Lưu thay đổi' : 'Thêm món ăn'}
        </button>
      </footer>
    </div>`
}

function openDishModal(dish) {
  openModal(dishForm(dish), {
    onMount(root) {
      const form = $('#dish-form', root)
      let accent = dish?.accent ?? 'orange'

      $('#f-name', form).focus()

      form.addEventListener('click', (event) => {
        const swatch = event.target.closest('[data-accent]')
        if (!swatch) return
        accent = swatch.dataset.accent
        $$('.swatch', form).forEach((node) => node.classList.remove('on'))
        swatch.classList.add('on')
      })

      form.addEventListener('change', (event) => {
        if (event.target.name !== 'emoji') return
        $$('.emoji-opt', form).forEach((node) => node.classList.remove('on'))
        event.target.closest('.emoji-opt').classList.add('on')
      })

      const setError = (name, message) => {
        const field = $(`[data-field="${name}"]`, form)
        field.classList.toggle('invalid', Boolean(message))
        $('.error', field).textContent = message ?? ''
      }

      form.addEventListener('submit', (event) => {
        event.preventDefault()

        const data = new FormData(form)
        const name = String(data.get('name') ?? '').trim()
        const priceRaw = String(data.get('price') ?? '').trim()
        const price = Number(priceRaw)
        const description = String(data.get('description') ?? '').trim()
        let invalid = false

        setError('name', '')
        setError('price', '')
        setError('description', '')

        if (!name) {
          setError('name', 'Vui lòng nhập tên món ăn.')
          invalid = true
        } else if (name.length < 3) {
          setError('name', 'Tên món quá ngắn, tối thiểu 3 ký tự.')
          invalid = true
        }

        if (!priceRaw) {
          setError('price', 'Vui lòng nhập giá bán.')
          invalid = true
        } else if (!Number.isFinite(price) || price < 0) {
          setError('price', 'Giá bán không hợp lệ.')
          invalid = true
        } else if (price > 100_000_000) {
          setError('price', 'Giá bán vượt quá giới hạn cho phép.')
          invalid = true
        }

        if (description.length > 180) {
          setError('description', 'Mô tả không được vượt quá 180 ký tự.')
          invalid = true
        }

        if (invalid) {
          $('.form-field.invalid input', form)?.focus()
          return
        }

        const payload = {
          name,
          category: data.get('category'),
          price,
          description,
          accent,
          emoji: data.get('emoji') ?? EMOJIS[0],
          status: data.get('status'),
        }

        if (dish) {
          store.updateDish(dish.id, payload)
          toast(`Đã cập nhật món “${name}”.`)
        } else {
          const created = store.createDish(payload)
          toast(`Đã thêm món “${created.name}”.`)
        }

        closeModal()
      })
    },
  })
}

function openDeleteModal(dish) {
  if (!dish) return

  const usedInOrders = store
    .getOrders()
    .filter((order) => (order.items ?? []).some((item) => item.name === dish.name))

  openModal(
    `
    <div class="modal narrow" role="alertdialog" aria-modal="true" aria-labelledby="del-title" tabindex="-1">
      <header class="modal-head">
        <h2 id="del-title">Xóa món ăn</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">${ICON.close}</button>
      </header>
      <div class="modal-body">
        <p>Bạn có chắc muốn xóa <strong>${esc(dish.name)}</strong> (${esc(dish.id)}) khỏi thực đơn?</p>
        ${
          usedInOrders.length
            ? `<div class="note-box">Món này xuất hiện trong ${usedInOrders.length} đơn hàng. Lịch sử các đơn cũ vẫn giữ nguyên tên món.</div>`
            : ''
        }
        <p class="hint" style="margin-top:12px">Thao tác này không thể hoàn tác.</p>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-danger-outline" data-action="close-modal">Giữ lại</button>
        <button type="button" class="btn btn-danger" data-action="confirm-delete" data-id="${esc(dish.id)}">
          Xóa món ăn
        </button>
      </footer>
    </div>`,
    {
      onMount(root) {
        $('[data-action="confirm-delete"]', root).focus()
      },
    },
  )
}

/* ----------------------------------------------------------------- orders */

const matchesQuery = (order, query) =>
  match(order.id, query) ||
  match(order.customer, query) ||
  match(order.phone, query) ||
  match(order.address, query) ||
  match(orderSummary(order), query)

function visibleOrders() {
  const query = ui.orderQuery.trim().toLowerCase()

  return [...store.getOrders()]
    .filter((order) => {
      if (ui.orderStatus !== 'all' && order.status !== ui.orderStatus) {
        return false
      }
      return !query || matchesQuery(order, query)
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

function renderOrderChips() {
  const orders = store.getOrders()
  const counts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1
    return acc
  }, {})

  const chips = [
    { value: 'all', label: 'Tất cả', count: orders.length },
    ...Object.entries(ORDER_STATUS).map(([value, meta]) => ({
      value,
      label: meta.label,
      count: counts[value] ?? 0,
    })),
  ]

  el.orderChips.innerHTML = chips
    .map(
      (chip) => `
      <button type="button" class="chip${chip.value === ui.orderStatus ? ' active' : ''}"
        data-action="filter-order" data-status="${esc(chip.value)}"
        aria-pressed="${chip.value === ui.orderStatus}">
        ${esc(chip.label)} <b>${esc(number(chip.count))}</b>
      </button>`,
    )
    .join('')
}

function renderOrderList() {
  const orders = visibleOrders()
  const all = store.getOrders()
  const revenue = orders
    .filter((order) => order.status === 'completed')
    .reduce((sum, order) => sum + orderTotal(order), 0)

  el.orderSummary.textContent = `Có ${all.length} đơn · hiển thị ${orders.length} đơn · doanh thu ${money(revenue)}`

  if (!orders.length) {
    el.orderList.innerHTML = emptyState(
      ICON.search,
      'Không có đơn hàng phù hợp',
      'Thử đổi bộ lọc trạng thái hoặc xoá từ khoá tìm kiếm.',
    )
    return
  }

  el.orderList.innerHTML = orders
    .map((order) => {
      const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending
      const next = status.next
      const nextLabel = next ? ORDER_STATUS[next].label : null

      return `
      <article class="order-card${order.status === 'pending' ? ' is-new' : ''}">
        <div class="order-main">
          <div class="order-top">
            <span class="order-code">${esc(order.id)}</span>
            <span class="order-who">${esc(order.customer)} · ${esc(order.phone)}</span>
            ${badge(status.tone, status.label)}
            ${order.payment === 'card' ? badge('info', 'Chuyển khoản') : badge('muted', 'COD')}
          </div>
          <div class="order-items">${esc(orderSummary(order) || 'Không có món')} · ${esc(number(orderCount(order)))} món</div>
          <div class="order-addr">${esc(order.address || 'Chưa có địa chỉ')}</div>
        </div>
        <div class="order-side">
          <div class="order-total">${esc(money(orderTotal(order)))}</div>
          <div class="order-time">${esc(shortTime(order.createdAt))}</div>
          <div class="order-actions">
            ${
              next
                ? `<button type="button" class="btn btn-primary btn-sm" data-action="advance-order"
                    data-id="${esc(order.id)}" data-status="${next}">
                    ${ICON.next} ${esc(nextLabel)}
                  </button>`
                : ''
            }
            <button type="button" class="icon-btn" data-action="view-order"
              data-id="${esc(order.id)}" title="Chi tiết đơn">${ICON.eye}</button>
          </div>
        </div>
      </article>`
    })
    .join('')
}

function openOrderModal(id) {
  const order = store.getOrder(id)
  if (!order) return

  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending
  const subtotal = orderSubtotal(order)
  const total = orderTotal(order)

  openModal(
    `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="order-title" tabindex="-1">
      <header class="modal-head">
        <div>
          <h2 id="order-title">Đơn hàng ${esc(order.id)}</h2>
          <p>Đặt lúc ${esc(dateTime(order.createdAt))} · cập nhật ${esc(dateTime(order.updatedAt))}</p>
        </div>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">${ICON.close}</button>
      </header>

      <div class="modal-body">
        <section class="detail-section">
          <h3>Khách hàng</h3>
          <dl class="kv">
            <dt>Họ tên</dt><dd>${esc(order.customer)}</dd>
            <dt>Điện thoại</dt><dd>${esc(order.phone || '—')}</dd>
            <dt>Địa chỉ</dt><dd>${esc(order.address || '—')}</dd>
            <dt>Thanh toán</dt><dd>${order.payment === 'card' ? 'Chuyển khoản ngân hàng' : 'Thanh toán khi nhận món (COD)'}</dd>
          </dl>
          ${order.note ? `<div class="note-box"><strong>Ghi chú:</strong> ${esc(order.note)}</div>` : ''}
        </section>

        <section class="detail-section">
          <h3>Món đã đặt</h3>
          <div class="line-items">
            ${(order.items ?? [])
              .map(
                (item) => `
              <div class="line-item">
                <span class="name">${esc(item.name)}</span>
                <span class="qty">${esc(number(item.qty))} × ${esc(money(item.price))}</span>
                <span class="sum">${esc(money(item.price * item.qty))}</span>
              </div>`,
              )
              .join('')}
          </div>
          <div class="totals">
            <div><span>Tạm tính</span><span>${esc(money(subtotal))}</span></div>
            <div><span>Phí giao hàng</span><span>${order.shipping ? esc(money(order.shipping)) : 'Miễn phí'}</span></div>
            <div class="grand"><span>Tổng cộng</span><strong>${esc(money(total))}</strong></div>
          </div>
        </section>

        <section class="detail-section">
          <h3>Cập nhật trạng thái</h3>
          <div class="status-actions">
            ${Object.entries(ORDER_STATUS)
              .map(
                ([value, meta]) => `
              <button type="button" class="chip${value === order.status ? ' active' : ''}"
                data-action="set-order-status" data-id="${esc(order.id)}" data-status="${esc(value)}">
                ${esc(meta.label)}
              </button>`,
              )
              .join('')}
          </div>
        </section>

        <section class="detail-section">
          <h3>Lịch sử xử lý</h3>
          <ul class="timeline">
            ${(order.history ?? [])
              .slice()
              .reverse()
              .map(
                (entry) => `
              <li>
                <span class="dot">${esc((ORDER_STATUS[entry.status] ?? status).label.charAt(0))}</span>
                <span class="label">${esc((ORDER_STATUS[entry.status] ?? status).label)}</span>
                <time>${esc(shortTime(entry.at))}</time>
              </li>`,
              )
              .join('')}
          </ul>
        </section>
      </div>

      <footer class="modal-foot">
        <button type="button" class="btn btn-outline" data-action="close-modal">Đóng</button>
      </footer>
    </div>`,
    { orderId: id },
  )
}

function changeOrderStatus(id, status) {
  const order = store.getOrder(id)
  if (!order || order.status === status) return
  if (status === 'cancelled' && order.status !== 'cancelled') {
    openCancelModal(order)
    return
  }
  applyOrderStatus(id, status)
}

function applyOrderStatus(id, status) {
  const updated = store.updateOrderStatus(id, status)
  if (!updated) return
  toast(`Đơn ${updated.id} → ${ORDER_STATUS[status].label}.`)
  if (activeOrderId === id) openOrderModal(id)
}

function openResetModal() {
  openModal(
    `
    <div class="modal narrow" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" tabindex="-1">
      <header class="modal-head">
        <h2 id="reset-title">Khôi phục dữ liệu mẫu</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">${ICON.close}</button>
      </header>
      <div class="modal-body">
        <p>Toàn bộ món ăn và đơn hàng bạn đã thêm/sửa/xoá sẽ bị thay bằng dữ liệu mẫu ban đầu.</p>
        <p class="hint" style="margin-top:10px">Thao tác này không thể hoàn tác.</p>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-danger-outline" data-action="close-modal">Huỷ</button>
        <button type="button" class="btn btn-danger" data-action="confirm-reset">Khôi phục</button>
      </footer>
    </div>`,
    {
      onMount(root) {
        $('[data-action="confirm-reset"]', root).focus()
      },
    },
  )
}

function openCancelModal(order) {
  openModal(
    `
    <div class="modal narrow" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" tabindex="-1">
      <header class="modal-head">
        <h2 id="cancel-title">Huỷ đơn ${esc(order.id)}</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">${ICON.close}</button>
      </header>
      <div class="modal-body">
        <p>Huỷ đơn của <strong>${esc(order.customer)}</strong> (${esc(money(orderTotal(order)))})?</p>
        <p class="hint" style="margin-top:10px">Bạn vẫn có thể chuyển trạng thái khác sau khi huỷ.</p>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-danger-outline" data-action="close-modal">Giữ đơn</button>
        <button type="button" class="btn btn-danger" data-action="confirm-cancel" data-id="${esc(order.id)}">
          Huỷ đơn
        </button>
      </footer>
    </div>`,
    {
      onMount(root) {
        $('[data-action="confirm-cancel"]', root).focus()
      },
    },
  )
}

/* ------------------------------------------------------------------ views */

function setView(view) {
  ui.view = VIEWS[view] ? view : 'dashboard'

  $$('.admin-view').forEach((node) => {
    node.hidden = node.dataset.view !== ui.view
  })
  $$('[data-nav]').forEach((node) => {
    node.classList.toggle('active', node.dataset.nav === ui.view)
  })

  el.pageTitle.textContent = VIEWS[ui.view].title
  el.pageSub.textContent = VIEWS[ui.view].sub
}

function render() {
  syncCategoryOptions()
  renderStats()
  renderRecentOrders()
  renderTopDishes()
  renderDishList()
  renderOrderChips()
  renderOrderList()
  if (ui.view) setView(ui.view)
}

/* ------------------------------------------------------------------ events */

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action]')
  if (!trigger) return

  const { action, id, status } = trigger.dataset

  switch (action) {
    case 'open-dish-new':
      openDishModal(null)
      break
    case 'edit-dish':
      openDishModal(store.getDish(id))
      break
    case 'delete-dish':
      openDeleteModal(store.getDish(id))
      break
    case 'confirm-delete': {
      const dish = store.getDish(id)
      if (dish && store.removeDish(id)) {
        toast(`Đã xóa món “${dish.name}”.`)
      }
      closeModal()
      break
    }
    case 'close-modal':
      closeModal()
      break
    case 'view-order':
      openOrderModal(id)
      break
    case 'advance-order':
    case 'set-order-status':
      changeOrderStatus(id, status)
      break
    case 'confirm-cancel': {
      closeModal()
      applyOrderStatus(id, 'cancelled')
      break
    }
    case 'filter-order':
      ui.orderStatus = status
      renderOrderChips()
      renderOrderList()
      break
    case 'reset-data':
      openResetModal()
      break
    case 'confirm-reset':
      closeModal()
      store.resetData()
      toast('Đã khôi phục dữ liệu mẫu.')
      break
    default:
      break
  }
})

el.dishSearch.addEventListener('input', (event) => {
  ui.dishQuery = event.target.value
  renderDishList()
})

el.dishCategory.addEventListener('change', (event) => {
  ui.dishCategory = event.target.value
  renderDishList()
})

el.dishStatus.addEventListener('change', (event) => {
  ui.dishStatus = event.target.value
  renderDishList()
})

el.dishSort.addEventListener('change', (event) => {
  ui.dishSort = event.target.value
  renderDishList()
})

el.orderSearch.addEventListener('input', (event) => {
  ui.orderQuery = event.target.value
  renderOrderList()
})

window.addEventListener('hashchange', () => {
  setView(window.location.hash.replace(/^#\/?/, '') || 'dashboard')
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

store.subscribe(() => render())

render()
setView(window.location.hash.replace(/^#\/?/, '') || 'dashboard')
