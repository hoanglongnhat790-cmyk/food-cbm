/**
 * menu.js — Hiển thị danh sách món ăn từ foods.json (Phúc-JSON branch)
 * Tính năng:
 *   - Tạo dữ liệu món ăn từ JSON (foods.json)
 *   - Hiển thị danh sách món: ảnh đồ họa, giá, mô tả, trạng thái
 *   - Lọc theo danh mục
 *   - Tìm kiếm theo tên
 *   - Sắp xếp theo giá (tăng/giảm)
 *   - Chọn số lượng món
 *   - Thêm vào giỏ hàng + sidebar giỏ hàng
 */

import foodData from './data/foods.json';

// ─── Màu gradient cho từng danh mục ─────────────────────────────────────────
const CATEGORY_GRADIENTS = {
  'pho-bun': 'linear-gradient(140deg, #ffb26b, #ff8a3d)',
  'com':     'linear-gradient(140deg, #ffd08a, #f5a038)',
  'banh-mi': 'linear-gradient(140deg, #e8b48a, #d0884a)',
  'do-uong': 'linear-gradient(140deg, #a8d8c8, #3e8f6b)',
  'an-vat':  'linear-gradient(140deg, #f2ad81, #e0713b)',
  'combo':   'linear-gradient(140deg, #c3b1e1, #7c5cbf)',
};

// Icon SVG cho từng danh mục (hiển thị thay ảnh)
const CATEGORY_ICONS = {
  'pho-bun': `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-width="2"/>
    <path d="M18 40c0-10 6-14 14-14s14 4 14 14Z" fill="#fff" fill-opacity="0.85"/>
    <path d="M32 16c0 4-1 8-3 10M26 18c2 3 3 8 2 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  'com': `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-width="2"/>
    <path d="M20 36h24M20 36c0 8 5 12 12 12s12-4 12-12Z" fill="#fff" fill-opacity="0.85"/>
    <path d="M28 24v8M32 22v10M36 24v8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  'banh-mi': `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-width="2"/>
    <path d="M16 35c0-6 7-11 16-11s16 5 16 11v2H16Z" fill="#fff" fill-opacity="0.85"/>
    <path d="M16 37h32" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 30l20 5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.6"/>
  </svg>`,
  'do-uong': `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-width="2"/>
    <rect x="22" y="20" width="20" height="26" rx="5" fill="#fff" fill-opacity="0.85"/>
    <path d="M26 20v-4M38 20v-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="33" r="4" fill="#fff" fill-opacity="0.4"/>
  </svg>`,
  'an-vat': `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-width="2"/>
    <path d="M22 38c0-8 4-14 10-14s10 6 10 14H22Z" fill="#fff" fill-opacity="0.85"/>
    <path d="M22 38h20" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  'combo': `<svg viewBox="0 0 64 64" width="72" height="72" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-width="2"/>
    <rect x="18" y="24" width="12" height="16" rx="3" fill="#fff" fill-opacity="0.85"/>
    <rect x="34" y="24" width="12" height="16" rx="3" fill="#fff" fill-opacity="0.65"/>
    <path d="M24 20v4M40 20v4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
};

// Badge màu sắc theo tagType
const TAG_CLASS = {
  bestseller: 'badge-bestseller',
  specialty:  'badge-specialty',
  sale:       'badge-sale',
  new:        'badge-new',
  popular:    'badge-popular',
};

// ─── Trạng thái ứng dụng ────────────────────────────────────────────────────
const state = {
  currentCategory: 'all',
  searchQuery: '',
  sortOrder: 'default', // 'default' | 'price-asc' | 'price-desc'
  cart: [],             // [{ dish, quantity }]
  cartOpen: false,
};

// ─── Format giá ─────────────────────────────────────────────────────────────
function formatPrice(price) {
  return price.toLocaleString('vi-VN') + 'đ';
}

// ─── Lọc + tìm kiếm + sắp xếp ───────────────────────────────────────────────
function getFilteredDishes(dishes) {
  let result = [...dishes];

  // Lọc theo danh mục
  if (state.currentCategory !== 'all') {
    result = result.filter(d => d.category === state.currentCategory);
  }

  // Tìm kiếm theo tên
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    result = result.filter(d => d.name.toLowerCase().includes(q));
  }

  // Sắp xếp theo giá
  if (state.sortOrder === 'price-asc') {
    result.sort((a, b) => a.price - b.price);
  } else if (state.sortOrder === 'price-desc') {
    result.sort((a, b) => b.price - a.price);
  }

  return result;
}

// ─── Giỏ hàng: thêm / bớt / xóa ────────────────────────────────────────────
function addToCart(dish, qty) {
  const existing = state.cart.find(i => i.dish.id === dish.id);
  if (existing) {
    existing.quantity += qty;
  } else {
    state.cart.push({ dish, quantity: qty });
  }
  renderCart();
  updateCartBadge();
  showCartToast(dish.name, qty);
}

function removeFromCart(dishId) {
  state.cart = state.cart.filter(i => i.dish.id !== dishId);
  renderCart();
  updateCartBadge();
}

function changeCartQty(dishId, delta) {
  const item = state.cart.find(i => i.dish.id === dishId);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  renderCart();
  updateCartBadge();
}

function getTotalPrice() {
  return state.cart.reduce((sum, i) => sum + i.dish.price * i.quantity, 0);
}

function getTotalItems() {
  return state.cart.reduce((sum, i) => sum + i.quantity, 0);
}

// ─── Toast thông báo ─────────────────────────────────────────────────────────
function showCartToast(name, qty) {
  const existing = document.getElementById('cart-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'cart-toast';
  toast.className = 'cart-toast';
  toast.innerHTML = `<span>🛒</span> Đã thêm <strong>${qty}x ${name}</strong> vào giỏ hàng`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('cart-toast--show'));

  setTimeout(() => {
    toast.classList.remove('cart-toast--show');
    setTimeout(() => toast.remove(), 350);
  }, 2500);
}

// ─── Render giỏ hàng sidebar ─────────────────────────────────────────────────
function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  if (!body || !footer) return;

  if (state.cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <span class="cart-empty-icon">🛒</span>
        <p>Giỏ hàng trống</p>
        <small>Hãy chọn món ăn yêu thích của bạn!</small>
      </div>`;
    footer.hidden = true;
    return;
  }

  footer.hidden = false;
  body.innerHTML = state.cart.map(item => `
    <div class="cart-item" data-id="${item.dish.id}">
      <div class="cart-item-art" style="background:${CATEGORY_GRADIENTS[item.dish.category] || '#ccc'}">
        ${CATEGORY_ICONS[item.dish.category] ? '' : '🍽️'}
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${item.dish.name}</p>
        <p class="cart-item-price">${formatPrice(item.dish.price)} / phần</p>
        <div class="cart-qty-row">
          <button class="cart-qty-btn" data-action="minus" data-id="${item.dish.id}" aria-label="Giảm">−</button>
          <span class="cart-qty-val">${item.quantity}</span>
          <button class="cart-qty-btn" data-action="plus" data-id="${item.dish.id}" aria-label="Tăng">+</button>
          <button class="cart-remove-btn" data-id="${item.dish.id}" aria-label="Xóa">🗑</button>
        </div>
      </div>
      <div class="cart-item-subtotal">${formatPrice(item.dish.price * item.quantity)}</div>
    </div>
  `).join('');

  document.getElementById('cart-total').textContent = formatPrice(getTotalPrice());

  body.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      changeCartQty(Number(btn.dataset.id), btn.dataset.action === 'plus' ? 1 : -1);
    });
  });
  body.querySelectorAll('.cart-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.id)));
  });
}

// ─── Cập nhật badge số lượng trên FAB ────────────────────────────────────────
function updateCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  const total = getTotalItems();
  if (!badge) return;
  badge.textContent = total;
  badge.hidden = total === 0;
}

// ─── Tạo DOM cho 1 dish card ─────────────────────────────────────────────────
function createDishCard(dish) {
  const gradient = CATEGORY_GRADIENTS[dish.category] || 'linear-gradient(140deg,#ccc,#999)';
  const icon = CATEGORY_ICONS[dish.category] || '';

  const badgeHTML = dish.tag
    ? `<span class="badge ${TAG_CLASS[dish.tagType] || ''}">${dish.tag}</span>`
    : '';

  const priceHTML = dish.originalPrice
    ? `<del class="price-original">${formatPrice(dish.originalPrice)}</del>
       <span class="price">${formatPrice(dish.price)}</span>`
    : `<span class="price">${formatPrice(dish.price)}</span>`;

  const spiceHTML = dish.spiceLevel > 0
    ? `<span class="spice-dots" title="${dish.spiceLevel === 1 ? 'Hơi cay' : 'Cay'}">${'🌶️'.repeat(dish.spiceLevel)}</span>`
    : '';

  const statusBadge = dish.isAvailable
    ? `<span class="status-badge status-available">● Còn hàng</span>`
    : `<span class="status-badge status-unavailable">● Tạm hết</span>`;

  const article = document.createElement('article');
  article.className = `dish${dish.isAvailable ? '' : ' dish--unavailable'}`;
  article.dataset.category = dish.category;
  article.dataset.id = dish.id;
  article.setAttribute('role', 'listitem');

  article.innerHTML = `
    <div class="dish-art" style="background:${gradient}">
      ${icon}
      ${badgeHTML}
      ${statusBadge}
    </div>
    <div class="dish-body">
      <h3>${dish.name}</h3>
      <p class="dish-desc">${dish.description}</p>
      <div class="dish-meta">
        <span class="dish-rating" aria-label="Đánh giá ${dish.rating}">
          ⭐ ${dish.rating} <span class="dish-review-count">(${dish.reviewCount.toLocaleString()})</span>
        </span>
        ${spiceHTML}
        <span class="dish-time" title="Thời gian chuẩn bị">⏱ ${dish.prepTime}</span>
      </div>
      <div class="dish-info-row">
        <span class="dish-serving">👤 ${dish.servingSize}</span>
        <span class="dish-calories">🔥 ${dish.calories} kcal</span>
      </div>
      <div class="dish-foot">
        <div class="price-group">${priceHTML}</div>
        ${dish.isAvailable
          ? `<div class="dish-order-area">
              <div class="qty-control" role="group" aria-label="Chọn số lượng">
                <button class="qty-btn qty-minus" data-id="${dish.id}" aria-label="Giảm">−</button>
                <span class="qty-val" id="qty-val-${dish.id}">1</span>
                <button class="qty-btn qty-plus" data-id="${dish.id}" aria-label="Tăng">+</button>
              </div>
              <button class="btn btn-sm btn-primary add-to-cart-btn" data-id="${dish.id}" aria-label="Thêm vào giỏ">
                🛒 Thêm
              </button>
            </div>`
          : `<span class="dish-unavailable-label">Tạm hết hàng</span>`
        }
      </div>
    </div>
  `;

  if (dish.isAvailable) {
    const qtyValEl = article.querySelector(`#qty-val-${dish.id}`);
    let qty = 1;

    article.querySelector('.qty-minus').addEventListener('click', () => {
      if (qty > 1) { qty--; qtyValEl.textContent = qty; }
    });
    article.querySelector('.qty-plus').addEventListener('click', () => {
      qty++;
      qtyValEl.textContent = qty;
    });
    article.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
      addToCart(dish, qty);
      qty = 1;
      qtyValEl.textContent = 1;
      const btn = e.currentTarget;
      btn.classList.add('btn--added');
      btn.innerHTML = '✓ Đã thêm';
      setTimeout(() => {
        btn.classList.remove('btn--added');
        btn.innerHTML = '🛒 Thêm';
      }, 1200);
    });
  }

  return article;
}

// ─── Render danh sách dish ───────────────────────────────────────────────────
function renderDishes(dishes) {
  const grid = document.getElementById('dish-grid');
  const empty = document.getElementById('menu-empty');
  const countEl = document.getElementById('dish-count');

  grid.style.opacity = '0';
  grid.style.transform = 'translateY(8px)';

  setTimeout(() => {
    grid.innerHTML = '';

    if (dishes.length === 0) {
      empty.hidden = false;
      grid.hidden = true;
      if (countEl) countEl.textContent = '0 món';
    } else {
      empty.hidden = true;
      grid.hidden = false;
      grid.setAttribute('role', 'list');
      if (countEl) countEl.textContent = `${dishes.length} món`;
      dishes.forEach((dish, i) => {
        const card = createDishCard(dish);
        card.style.animationDelay = `${i * 55}ms`;
        grid.appendChild(card);
      });
    }

    grid.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    grid.style.opacity = '1';
    grid.style.transform = 'translateY(0)';
  }, 200);
}

// ─── Render filter tabs ──────────────────────────────────────────────────────
function renderTabs(categories) {
  const tabsEl = document.getElementById('category-tabs');
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab';
    btn.dataset.category = cat.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.id = `tab-${cat.id}`;
    btn.textContent = `${cat.icon} ${cat.name}`;
    tabsEl.appendChild(btn);
  });
}

// ─── Tìm kiếm ────────────────────────────────────────────────────────────────
function initSearch(dishes) {
  const input = document.getElementById('menu-search');
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchQuery = input.value;
      renderDishes(getFilteredDishes(dishes));
    }, 250);
  });
}

// ─── Sắp xếp ─────────────────────────────────────────────────────────────────
function initSort(dishes) {
  const select = document.getElementById('menu-sort');
  if (!select) return;
  select.addEventListener('change', () => {
    state.sortOrder = select.value;
    renderDishes(getFilteredDishes(dishes));
  });
}

// ─── Lọc danh mục ─────────────────────────────────────────────────────────────
function initFilter(dishes) {
  const tabsEl = document.getElementById('category-tabs');

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    const cat = tab.dataset.category;
    if (cat === state.currentCategory) return;
    state.currentCategory = cat;

    tabsEl.querySelectorAll('.cat-tab').forEach(t => {
      const isActive = t.dataset.category === cat;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    renderDishes(getFilteredDishes(dishes));
  });
}

// ─── Giỏ hàng sidebar ────────────────────────────────────────────────────────
function openCart() {
  state.cartOpen = true;
  document.getElementById('cart-sidebar').classList.add('cart-sidebar--open');
  document.getElementById('cart-overlay').classList.add('cart-overlay--show');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  state.cartOpen = false;
  document.getElementById('cart-sidebar').classList.remove('cart-sidebar--open');
  document.getElementById('cart-overlay').classList.remove('cart-overlay--show');
  document.body.style.overflow = '';
}

function createCartSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.id = 'cart-sidebar';
  sidebar.className = 'cart-sidebar';
  sidebar.setAttribute('aria-label', 'Giỏ hàng');
  sidebar.innerHTML = `
    <div class="cart-header">
      <h3>🛒 Giỏ hàng của bạn</h3>
      <button id="cart-close-btn" class="cart-close-btn" aria-label="Đóng giỏ hàng">✕</button>
    </div>
    <div class="cart-body" id="cart-body"></div>
    <div class="cart-footer" id="cart-footer" hidden>
      <div class="cart-total-row">
        <span>Tổng cộng</span>
        <strong id="cart-total" class="cart-total-price">0đ</strong>
      </div>
      <button class="btn btn-primary btn-lg cart-checkout-btn" id="cart-checkout-btn">
        Đặt hàng ngay →
      </button>
    </div>
  `;
  document.body.appendChild(sidebar);

  const overlay = document.createElement('div');
  overlay.id = 'cart-overlay';
  overlay.className = 'cart-overlay';
  document.body.appendChild(overlay);

  document.getElementById('cart-close-btn').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  document.getElementById('cart-checkout-btn').addEventListener('click', () => {
    alert(`✅ Đặt hàng thành công!\n\nTổng: ${formatPrice(getTotalPrice())}\nCảm ơn bạn đã tin tưởng CBM FOOD! 🍜`);
    state.cart = [];
    renderCart();
    updateCartBadge();
    closeCart();
  });
}

function createCartFAB() {
  const fab = document.createElement('button');
  fab.id = 'cart-fab';
  fab.className = 'cart-fab';
  fab.setAttribute('aria-label', 'Xem giỏ hàng');
  fab.innerHTML = `🛒 <span class="cart-count-badge" id="cart-count-badge" hidden>0</span>`;
  document.body.appendChild(fab);
  fab.addEventListener('click', () => { if (state.cartOpen) closeCart(); else openCart(); });
}

// ─── Toolbar tìm kiếm + sắp xếp ──────────────────────────────────────────────
function insertMenuToolbar() {
  const menuContainer = document.querySelector('#menu .container');
  if (!menuContainer) return;
  const catTabs = document.getElementById('category-tabs');

  const toolbar = document.createElement('div');
  toolbar.className = 'menu-toolbar';
  toolbar.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" id="menu-search" class="menu-search"
        placeholder="Tìm tên món ăn..." aria-label="Tìm kiếm món ăn" autocomplete="off" />
    </div>
    <div class="sort-wrap">
      <label for="menu-sort" class="sort-label">Sắp xếp:</label>
      <select id="menu-sort" class="menu-sort" aria-label="Sắp xếp theo giá">
        <option value="default">Mặc định</option>
        <option value="price-asc">Giá tăng dần ↑</option>
        <option value="price-desc">Giá giảm dần ↓</option>
      </select>
    </div>
    <span class="dish-count-label" id="dish-count"></span>
  `;
  menuContainer.insertBefore(toolbar, catTabs);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export function initMenu() {
  const { categories, dishes } = foodData;

  insertMenuToolbar();
  renderTabs(categories);
  renderDishes(dishes);
  initFilter(dishes);
  initSearch(dishes);
  initSort(dishes);
  createCartSidebar();
  createCartFAB();
  renderCart();
  updateCartBadge();
}
