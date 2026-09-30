import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const idsIn = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
const refsIn = (js) => [...js.matchAll(/\$\('#([a-zA-Z0-9_-]+)'/g)].map((m) => m[1])

/** id hợp lệ nếu có trong HTML tĩnh hoặc trong template sinh động của chính file JS đó */
const missingRefs = (html, js) => {
  const known = new Set([...idsIn(html), ...idsIn(js)])
  return [...new Set(refsIn(js))].filter((id) => !known.has(id))
}

describe('wiring - storefront', () => {
  const html = read('index.html')
  const shop = read('src/shop.js')

  it('mọi id mà shop.js truy vấn đều tồn tại trong index.html', () => {
    const missing = missingRefs(html, shop)
    assert.deepEqual(missing, [], `thiếu id trong index.html: ${missing.join(', ')}`)
  })

  it('không truy vấn id trùng lặp', () => {
    const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    const dupes = all.filter((id, i) => all.indexOf(id) !== i)
    assert.deepEqual([...new Set(dupes)], [], 'id bị trùng trong index.html')
  })
})

describe('wiring - admin', () => {
  const html = read('admin.html')
  const admin = read('src/admin.js')

  it('mọi id mà admin.js truy vấn đều tồn tại', () => {
    const missing = missingRefs(html, admin)
    assert.deepEqual(missing, [], `thiếu id trong admin.html: ${missing.join(', ')}`)
  })

  it('admin chỉ khởi tạo sau khi đã xác thực quyền', () => {
    const bootstrap = admin.slice(admin.indexOf('async function bootstrap()'))
    assert.ok(bootstrap.length > 0, 'phải có hàm bootstrap')
    assert.ok(
      bootstrap.indexOf('await auth.init()') < bootstrap.indexOf('syncGuard()'),
      'phải init auth trước khi kiểm tra quyền',
    )
    assert.match(bootstrap, /syncGuard\(\)/)
  })

  it('render chỉ chạy khi đã qua cổng quyền', () => {
    const guarded = admin.match(/canAccessAdmin\(\)[^)]*\)?\s*\)?\s*render\(\)/g) ?? []
    assert.ok(guarded.length >= 1, 'phải render qua điều kiện canAccessAdmin')
    assert.ok(
      /^render\(\)$/m.test(admin.trim().split('\n').slice(-2).join('\n').trim()) === false,
      'không được gọi render() ở top-level mà không kiểm tra quyền',
    )
  })

  it('mọi hành động admin đều qua kiểm tra quyền', () => {
    const handler = admin.slice(
      admin.indexOf("document.addEventListener('click'"),
      admin.indexOf('switch (action)'),
    )
    assert.match(handler, /if \(!auth\.canAccessAdmin\(\)\)/)
  })

  it('không còn tên quản trị viên hardcode', () => {
    const bar = html.slice(html.indexOf('admin-topbar-meta'), html.indexOf('admin-content'))
    assert.match(bar, /id="admin-user-name"/)
    assert.match(bar, /id="admin-avatar"/)
    assert.doesNotMatch(bar, />Quản trị viên</)
  })

  it('cổng chặn có nút đăng xuất và form đăng nhập', () => {
    assert.match(html, /id="auth-gate"/)
    assert.match(html, /id="gate-form"/)
    assert.match(html, /id="admin-logout"/)
  })
})

describe('wiring - thuộc tính hidden không bị CSS ghi đè', () => {
  const css = read('src/style.css')

  it('có rule [hidden] buộc display none', () => {
    assert.match(
      css,
      /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
      'thiếu rule [hidden] — modal/drawer sẽ chặn toàn bộ thao tác chuột',
    )
  })

  it('các lớp phủ toàn màn hình đều dùng hidden để ẩn', () => {
    /* display:grid/flex trên .modal/.drawer sẽ thắng [hidden] của trình duyệt */
    for (const className of ['modal', 'drawer']) {
      const rule = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`))
      assert.ok(rule, `không tìm thấy rule .${className}`)
      assert.match(rule[0], /display:\s*(grid|flex)/, `.${className} đang đặt display`)
    }
  })

  it('overlay không đặt display nên hidden vẫn ăn', () => {
    const rule = css.match(/\.overlay\s*\{[^}]*\}/)[0]
    assert.doesNotMatch(rule, /display:/, '.overlay không được đặt display')
  })
})

describe('wiring - cửa hàng dùng chung kho dữ liệu', () => {
  const shop = read('src/shop.js')
  const cart = read('src/cart.js')
  const admin = read('src/admin.js')

  it('cửa hàng và admin cùng import store.js', () => {
    assert.match(shop, /import \* as db from '\.\/store\.js'/)
    assert.match(cart, /import \* as db from '\.\/store\.js'/)
    assert.match(admin, /import \* as store from '\.\/store\.js'/)
  })

  it('thực đơn hiển thị động, không còn thẻ món viết tay', () => {
    const menu = read('index.html').slice(
      read('index.html').indexOf('id="menu"'),
      read('index.html').indexOf('id="about"'),
    )
    assert.match(menu, /id="menu-grid"/)
    assert.doesNotMatch(menu, /dish-art-1/)
    assert.doesNotMatch(menu, /<article class="dish">/)
  })

  it('mọi nút đặt món đều gọi giỏ hàng, không dùng liên kết #contact', () => {
    const html = read('index.html')
    assert.doesNotMatch(html, /href="#contact" class="btn btn-sm">Đặt ngay/)
  })
})
