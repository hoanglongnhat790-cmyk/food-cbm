const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`

export const qtyStepper = (line, { maxQty }) => `
  <div class="qty">
    <button type="button" class="qty-btn" data-qty="-1" data-key="${escape(line.key)}"
      aria-label="Bớt một ${escape(line.name)}">−</button>
    <span aria-live="polite">${line.qty}</span>
    <button type="button" class="qty-btn" data-qty="1" data-key="${escape(line.key)}"
      ${line.qty >= maxQty ? 'disabled aria-disabled="true"' : ''}
      aria-label="Thêm một ${escape(line.name)}">+</button>
  </div>`

export const cartLineHtml = (line, { maxQty, editable = true }) => `
  <div class="cart-line">
    ${
      line.image
        ? `<img class="cart-line-art" src="${escape(line.image)}" alt="" loading="lazy" />`
        : `<span class="cart-line-art is-emoji" aria-hidden="true">${escape(line.emoji ?? '')}</span>`
    }
    <div class="cart-line-main">
      <strong>${escape(line.name)}</strong>
      <small>${money(line.price)} / phần</small>
    </div>
    ${editable ? qtyStepper(line, { maxQty }) : `<span class="qty is-static"><span>${line.qty}</span></span>`}
    <span class="cart-line-total">${money(line.price * line.qty)}</span>
    ${
      editable
        ? `<button type="button" class="cart-remove" data-remove="${escape(line.key)}"
             aria-label="Xoá ${escape(line.name)} khỏi giỏ">✕</button>`
        : ''
    }
  </div>`

export const cartLinesHtml = (lines, opts) => lines.map((line) => cartLineHtml(line, opts)).join('')

export const cartEmptyHtml = () => `
  <div class="cart-empty">
    <span class="cart-empty-mark" aria-hidden="true">🍽️</span>
    <p>Giỏ hàng đang trống</p>
    <small>Thêm món bạn thích ở mục Thực đơn để bắt đầu.</small>
  </div>`

export const summaryHtml = ({ subtotal, shipping, total }) => `
  <div class="cart-sum">
    <span>Tạm tính</span><span>${money(subtotal)}</span>
  </div>
  <div class="cart-sum">
    <span>Phí giao hàng</span>
    <span>${shipping === 0 ? 'Miễn phí' : money(shipping)}</span>
  </div>
  <div class="cart-sum is-total">
    <span>Tổng cộng</span><span>${money(total)}</span>
  </div>`
