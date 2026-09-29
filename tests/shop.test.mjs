import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

/* ------------------------------------------------------------------- setup */

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const dom = new JSDOM(html, {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

const { window } = dom
const { document } = window

globalThis.window = window
globalThis.document = document
globalThis.HTMLElement = window.HTMLElement
globalThis.HTMLImageElement = window.HTMLImageElement
globalThis.Node = window.Node
globalThis.Event = window.Event
globalThis.FormData = window.FormData
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)

const shop = await import('../src/shop.js')
const db = await import('../src/store.js')
const cart = await import('../src/cart.js')

await shop.startShop()

/* ----------------------------------------------------------------- helpers */

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))
/* đợi lâu hơn thời gian chuyển động của drawer (240ms) trong shop.js */
const settle = () => new Promise((resolve) => setTimeout(resolve, 320))

const type = (input, value) => {
  input.value = value
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

const categoryButton = (label) =>
  $$('#category-row [data-category]').find((node) =>
    node.querySelector('.category-label').textContent.trim().startsWith(label),
  )

const cardNames = () => $$('#menu-grid .product-name').map((node) => node.textContent.trim())

/** tìm thẻ món theo tên, dùng lại sau mỗi lần render lại lưới */
const cardNamed = (name) =>
  $$('#menu-grid .product').find(
    (card) => card.querySelector('.product-name').textContent.trim() === name,
  )

const reset = () => {
  cart.clear()
  db.resetData()
  type($('#header-search'), '')
  const all = categoryButton('Tất cả')
  if (!all.classList.contains('active')) all.click()
  const popular = $('[data-sort="popular"]')
  if (!popular.classList.contains('active')) popular.click()
}

/* ------------------------------------------------------------------- tests */

describe('cửa hàng - dựng trang', () => {
  it('vẽ đủ danh mục mặc định cộng thêm mục "Tất cả"', () => {
    const buttons = $$('#category-row [data-category]')
    assert.equal(buttons.length, 6)
    assert.equal(buttons[0].dataset.category, 'all')
    assert.ok(buttons[0].classList.contains('active'), '"Tất cả" phải được chọn mặc định')
  })

  it('vẽ toàn bộ món trong kho', () => {
    assert.equal($$('#menu-grid .product').length, db.getDishes().length)
    assert.ok($$('#menu-grid .product').length >= 12, 'thực đơn phải có món để đặt')
  })

  it('mỗi thẻ món có tên, giá và nút thêm giỏ', () => {
    $$('#menu-grid .product').forEach((card) => {
      assert.ok(card.querySelector('.product-name').textContent.trim(), 'thiếu tên món')
      assert.match(card.querySelector('.product-price b').textContent, /\d+đ$/, 'thiếu giá')
      assert.ok(card.querySelector('.add-btn'), 'thiếu nút thêm giỏ')
    })
  })

  it('món tạm ngưng thì không cho bấm thêm giỏ', () => {
    const off = db.getDishes().find((dish) => dish.status === 'unavailable')
    const card = $(`#menu-grid .product:has(.add-btn[disabled])`)
    assert.ok(off, 'dữ liệu mẫu phải có món tạm ngưng')
    assert.ok(card, 'phải có thẻ món bị khoá nút thêm')
    assert.match(card.textContent, /Tạm ngưng/)
  })

  it('hiện số lượng món trong phần giới thiệu', () => {
    assert.equal($('#hero-dish-count').textContent, String(db.getDishes().length))
  })
})

describe('cửa hàng - lọc, tìm kiếm, sắp xếp', () => {
  it('bấm danh mục chỉ còn món của danh mục đó', () => {
    reset()
    categoryButton('Fast Food').click()

    const expected = db.getDishes().filter((dish) => dish.category === 'Fast Food').length
    assert.equal($$('#menu-grid .product').length, expected)
    assert.ok(expected > 0, 'danh mục Fast Food phải có món')
    assert.ok(categoryButton('Fast Food').classList.contains('active'))
  })

  it('tìm theo tên, mô tả hoặc danh mục', () => {
    reset()
    type($('#header-search'), 'trà sữa')

    const names = cardNames()
    assert.ok(names.length >= 1, 'phải tìm thấy món trà sữa')
    names.forEach((name) => {
      const dish = db.getDishes().find((item) => item.name === name)
      const haystack = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase()
      assert.ok(haystack.includes('trà sữa'), `"${name}" không khớp từ khoá`)
    })
    assert.equal($('#search-clear').hidden, false, 'phải hiện nút xoá tìm kiếm')
  })

  it('bộ lọc đang dùng hiện thành chip và xoá được', () => {
    reset()
    categoryButton('Ăn vặt').click()
    type($('#header-search'), 'chè')

    assert.equal($('#active-filters').hidden, false)
    assert.equal($$('#active-filters .filter-chip').length, 2)

    $('#active-filters [data-clear="all"]').click()
    assert.equal($('#active-filters').hidden, true)
    assert.equal($('#header-search').value, '')
    assert.equal($$('#menu-grid .product').length, db.getDishes().length)
  })

  it('không tìm thấy thì báo rõ và cho xoá bộ lọc', () => {
    reset()
    type($('#header-search'), 'khong-ton-tai')

    assert.equal($$('#menu-grid .product').length, 0)
    assert.match($('#menu-grid').textContent, /Không tìm thấy món nào/)
    $('#menu-grid [data-clear="all"]').click()
    assert.ok($$('#menu-grid .product').length > 0)
  })

  it('sắp xếp theo giá tăng dần và giảm dần', () => {
    reset()
    $('[data-sort="price-asc"]').click()
    const asc = $$('#menu-grid .product-price b').map((node) =>
      Number(node.textContent.replace(/\D/g, '')),
    )
    assert.deepEqual(asc, [...asc].sort((a, b) => a - b))

    $('[data-sort="price-desc"]').click()
    const desc = $$('#menu-grid .product-price b').map((node) =>
      Number(node.textContent.replace(/\D/g, '')),
    )
    assert.deepEqual(desc, [...desc].sort((a, b) => b - a))
  })
})

describe('cửa hàng - giỏ hàng', () => {
  it('bấm nút thêm thì badge giỏ tăng và thẻ món hiện số lượng', () => {
    reset()
    const name = $('#menu-grid .product .product-name').textContent.trim()

    $('#menu-grid .product .add-btn').click()

    assert.equal(cart.count(), 1)
    assert.equal($('#cart-count').textContent, '1')
    assert.equal($('#cart-count').hidden, false)
    assert.equal(
      cardNamed(name).querySelector('.product-incart').textContent,
      '1',
      'thẻ món phải hiện số lượng',
    )
    assert.ok($('#toasts').textContent.includes(name), 'phải có thông báo đã thêm món')
  })

  it('mở giỏ thấy dòng món, tổng tiền và nút thanh toán', async () => {
    reset()
    $('#menu-grid .product .add-btn').click()
    $('#cart-btn').click()
    await tick()

    assert.equal($('#cart-drawer').hidden, false)
    assert.equal($('#cart-drawer').classList.contains('is-open'), true)
    assert.equal($('#overlay').hidden, false)
    assert.equal($$('#cart-body .cart-line').length, 1)
    assert.match($('#cart-totals').textContent, /Tổng cộng/)
    assert.equal($('#cart-checkout').disabled, false)
  })

  it('tăng số lượng trong giỏ cập nhật tổng tiền', () => {
    reset()
    $('#menu-grid .product .add-btn').click()
    $('#cart-btn').click()

    const before = $('#cart-totals').textContent
    $('#cart-body [data-step="1"]').click()

    assert.equal(cart.count(), 2)
    assert.notEqual($('#cart-totals').textContent, before, 'tổng tiền phải thay đổi')
  })

  it('xoá hết giỏ thì hiện trạng thái trống', () => {
    reset()
    $('#menu-grid .product .add-btn').click()
    $('#cart-btn').click()
    $('#cart-clear').click()

    assert.equal(cart.count(), 0)
    assert.match($('#cart-body').textContent, /Giỏ hàng đang trống/)
    assert.equal($('#cart-count').hidden, true)
  })

  it('Escape đóng được giỏ và bỏ khoá cuộn trang', async () => {
    reset()
    $('#cart-btn').click()
    await tick()
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()

    assert.equal($('#cart-drawer').hidden, true)
    assert.equal($('#overlay').hidden, true)
    assert.equal(document.body.classList.contains('is-locked'), false)
  })
})

describe('cửa hàng - thanh toán', () => {
  it('mở checkout từ giỏ và chốt được đơn', async () => {
    reset()
    $('#menu-grid .product .add-btn').click()
    $('#cart-btn').click()
    await tick()
    $('#cart-checkout').click()
    await tick()

    assert.equal($('#checkout-modal').hidden, false)
    assert.match($('#checkout-summary').textContent, /Tổng thanh toán/)

    const orders = db.getOrders().length
    const form = $('#checkout-form')
    form.elements.customer.value = 'Nguyễn Văn A'
    form.elements.phone.value = '0901234567'
    form.elements.address.value = '12 Ngõ 45 Nguyễn Huế, Hà Nội'
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    assert.equal(db.getOrders().length, orders + 1, 'phải tạo được đơn hàng')
    assert.equal(cart.count(), 0, 'đặt xong thì giỏ phải trống')
    assert.equal($('#success-modal').hidden, false)
    assert.match($('#success-code').textContent, /^Mã đơn CB-/)
  })

  it('thiếu thông tin bắt buộc thì báo lỗi, không tạo đơn', async () => {
    reset()
    $('#menu-grid .product .add-btn').click()
    $('#cart-btn').click()
    await tick()
    $('#cart-checkout').click()
    await tick()

    const orders = db.getOrders().length
    const form = $('#checkout-form')
    form.elements.customer.value = 'Nguyễn Văn A'
    form.elements.phone.value = '123'
    form.elements.address.value = 'ngắn'
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    assert.equal(db.getOrders().length, orders, 'không được tạo đơn khi dữ liệu sai')
    assert.equal($('#checkout-error').hidden, false)
    assert.match($('#checkout-error').textContent, /điện thoại/i)
  })
})

describe('cửa hàng - ảnh món', () => {
  it('món không có ảnh thì dùng biểu tượng', () => {
    reset()
    const card = $('#menu-grid .product')
    assert.ok(card.querySelector('.product-emoji'), 'phải có biểu tượng dự phòng')
    assert.equal(card.querySelector('.product-emoji').hidden, false)
    assert.equal(card.querySelector('.product-photo'), null)
  })

  it('món có ảnh thì hiện ảnh và ẩn biểu tượng', () => {
    reset()
    const target = db.getDishes()[0]
    db.updateDish(target.id, { ...target, image: 'https://example.com/pho-bo.jpg' })

    const card = cardNamed(target.name)
    const photo = card.querySelector('.product-photo')
    assert.ok(photo, 'phải render thẻ img')
    assert.equal(photo.getAttribute('src'), 'https://example.com/pho-bo.jpg')
    assert.equal(photo.alt, target.name)
    assert.equal(card.querySelector('.product-emoji').hidden, true)
  })

  it('ảnh hỏng thì lùi về biểu tượng', () => {
    reset()
    const target = db.getDishes()[0]
    db.updateDish(target.id, { ...target, image: 'https://example.com/hong.jpg' })

    const card = cardNamed(target.name)
    const photo = card.querySelector('.product-photo')
    photo.dispatchEvent(new window.Event('error'))

    assert.equal(photo.hidden, true)
    assert.equal(card.querySelector('.product-emoji').hidden, false)
  })

  it('không nhận URL không an toàn', () => {
    reset()
    const before = db.getDishes()[0]
    const after = db.updateDish(before.id, {
      name: before.name,
      category: before.category,
      price: before.price,
      description: before.description,
      accent: before.accent,
      emoji: before.emoji,
      status: before.status,
      image: 'javascript:alert(1)',
    })
    assert.equal(after.image, '', 'phải loại URL nguy hiểm')
  })
})

describe('cửa hàng - địa chỉ giao hàng', () => {
  it('chọn khu vực khác thì đổi nhãn ở header', () => {
    $('#location-btn').click()
    assert.equal($('#location-menu').hidden, false)
    assert.equal($('#location-btn').getAttribute('aria-expanded'), 'true')

    const options = $$('#location-menu [data-location]')
    assert.ok(options.length >= 2, 'phải có nhiều khu vực')
    const target = options[1].dataset.location
    options[1].click()

    assert.equal($('#location-label').textContent, target)
    assert.equal($('#location-menu').hidden, true, 'chọn xong phải đóng danh sách')
  })
})
