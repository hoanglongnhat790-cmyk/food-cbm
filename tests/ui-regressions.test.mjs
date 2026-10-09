import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Chống hồi quy cho các lỗi "không thấy bằng mắt, không thấy bằng test JS".
 *
 * Hai lỗi nặng nhất trước đây đều là lỗi lớp CSS: code chạy đúng, không
 * có exception nào, 114 test logic vẫn xanh, nhưng người dùng không bấm
 * được nút nào vì có lớp phủ nằm sai chỗ. Test logic không bao giờ bắt
 * được loại lỗi đó, nên ở đây ta kiểm tra thẳng các bất biến phân lớp.
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const styleCss = readFileSync(resolve(root, 'src/style.css'), 'utf8')
const adminCss = readFileSync(resolve(root, 'src/admin.css'), 'utf8')
const mainJs = readFileSync(resolve(root, 'src/main.js'), 'utf8')
const adminJs = readFileSync(resolve(root, 'src/admin.js'), 'utf8')

/** Bỏ comment rồi cắt css thành các cặp (selector, body). */
const parseRules = (css) => {
  const rules = []
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  let match = re.exec(clean)
  while (match !== null) {
    rules.push({ selector: match[1], body: match[2] })
    match = re.exec(clean)
  }
  return rules
}

const selectorMatches = (selector, target) => {
  const s = selector.replace(/\s+/g, ' ').trim()
  return s === target || s.endsWith(` ${target}`)
}

/**
 * Khai báo hợp nhất của một selector trong một file, rule đứng sau thắng
 * rule đứng trước (giống cascade thật khi cùng độ ưu tiên).
 */
const declarationsOf = (css, target) => {
  const out = {}
  for (const rule of parseRules(css)) {
    const parts = rule.selector.split(',')
    if (!parts.some((part) => selectorMatches(part, target))) continue
    for (const decl of rule.body.split(';')) {
      const at = decl.indexOf(':')
      if (at === -1) continue
      const prop = decl.slice(0, at).trim().toLowerCase()
      const value = decl.slice(at + 1).trim()
      if (prop && value) out[prop] = value
    }
  }
  return out
}

const zIndexOf = (declarations) => {
  const raw = declarations['z-index']
  return raw === undefined ? null : Number.parseInt(raw, 10)
}

/** Bỏ comment JS để assert về hành vi, không về chú thích giải thích. */
const stripJsComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const numeric = (value) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/* ---------------- Lớp phủ của giỏ hàng ---------------- */

test('ngan gio phai nam tren lop phu nen', () => {
  const backdrop = declarationsOf(styleCss, '.drawer-backdrop')
  const drawer = declarationsOf(styleCss, '.cart-drawer')

  assert.notEqual(zIndexOf(drawer), null, '.cart-drawer phai khai bao z-index')
  assert.notEqual(zIndexOf(backdrop), null, '.drawer-backdrop phai khai bao z-index')
  assert.ok(
    zIndexOf(drawer) > zIndexOf(backdrop),
    `.cart-drawer (z-index ${zIndexOf(drawer)}) phai lon hon .drawer-backdrop ` +
      `(z-index ${zIndexOf(backdrop)}). Neu khong, lop phu nen phu kien ngan gio ` +
      `va moi cu bam trong gio chi dong duoc chu khong doi so luong duoc.`,
  )
})

test('lop phu nen cua gio phu kin toan man hinh', () => {
  const backdrop = declarationsOf(styleCss, '.drawer-backdrop')
  assert.equal(backdrop.position, 'fixed', 'phai la lop phu co dinh')
  assert.equal(backdrop.inset, '0', 'phai phu kin toan man hinh')
})

/* ---------------- Lớp phủ của hộp thoại trang quản trị ---------------- */

test('hop thoai admin phai hien va bam duoc duoc', () => {
  const modal = declarationsOf(adminCss, '.modal-backdrop')
  /* style.css đặt .modal-backdrop ở trạng thái đóng cho luồng đăng nhập
     (opacity 0 / visibility hidden / pointer-events none). admin.css dùng
     lại đúng class đó cho hộp thêm/sửa/xoá nên phải ghi đè, nếu không hộp
     có hình nhưng vô hình và không bấm được. */
  assert.equal(modal.opacity, '1', '.modal-backdrop trong admin.css phai reset opacity')
  assert.equal(modal.visibility, 'visible', '.modal-backdrop trong admin.css phai reset visibility')
  assert.equal(modal['pointer-events'], 'auto', '.modal-backdrop trong admin.css phai reset pointer-events')
})

test('hop thoai admin phai nam tren giao dien', () => {
  const backdrop = declarationsOf(adminCss, '.modal-backdrop')
  const shell = declarationsOf(adminCss, '.shell')
  assert.equal(backdrop.position, 'fixed')
  const backdropZ = zIndexOf(backdrop)
  const shellZ = zIndexOf(shell)
  assert.ok(
    shellZ === null || backdropZ > shellZ,
    `.modal-backdrop (z-index ${backdropZ}) phai lon hon .shell (z-index ${shellZ})`,
  )
})

test('dau va chan hop thoai phai bam sticky de luon bam duoc nut Luu', () => {
  /* Form thêm món dài hơn 90vh trên màn hình thấp và điện thoại; nếu
     đầu/chân cuộn theo nội dung thì nút Lưu nằm ngoài màn hình. */
  for (const part of ['.modal-head', '.modal-foot']) {
    const decl = declarationsOf(adminCss, part)
    assert.equal(decl.position, 'sticky', `${part} phai co position: sticky`)
  }
})

test('[hidden] phai duoc ep display none', () => {
  assert.equal(declarationsOf(styleCss, '[hidden]').display, 'none !important')
  assert.equal(declarationsOf(adminCss, '[hidden]').display, 'none !important')
})

/* ---------------- Lớp phủ phải đóng được bằng cách bấm ra ngoài ---------------- */

test('mọi lop phu nen cua trang ban hang deu co data-close', () => {
  /* Bấm ra vùng ngoài chỉ đóng được khi chính lớp phủ mang data-close.
     Nếu render hai lớp phủ chồng nhau thì lớp trên sẽ nuốt cú bấm. */
  const overlays = mainJs.match(/<div class="(?:drawer-backdrop|modal-backdrop-cart)"[^>]*>/g) ?? []
  assert.ok(overlays.length > 0, 'phai co lop phu nen')
  for (const tag of overlays) {
    assert.match(tag, /data-close/, `lop phu nen thieu data-close: ${tag}`)
  }
  assert.doesNotMatch(
    mainJs,
    /<div class="drawer-backdrop" data-close="1"><\/div>\s*<div class="modal-backdrop-cart">/,
    'khong duoc render hai lop phu nen chong len nhau',
  )
})

test('thanh toan khong duoc render nut doi so luong va xoa', () => {
  /* Nút +/- và ✕ trong giỏ gọi renderCartPanel() nên sẽ xoá luôn form
     đang nhập. Ở bước thanh toán chỉ cần xem lại, không sửa được. */
  assert.match(mainJs, /cartRows\(\{ editable: false \}\)/)
})

test('thanh toan phai truyen gio hang vao createOrder', () => {
  /* createOrder mặc định items = [] và báo "Giỏ hàng đang rỗng" ngay.
     Trước đây main.js không truyền items nên khách điền đủ thông tin,
     bấm "Đặt món" vẫn không tạo được đơn — không có lỗi JS nào để thấy. */
  const call = mainJs.slice(mainJs.indexOf('db.createOrder('))
  assert.ok(call.length > 0, 'phai co loi goi db.createOrder')
  const end = call.indexOf('})')
  const payload = call.slice(0, end)
  assert.match(payload, /items:\s*cart\.list\(\)/, 'createOrder phai nhan danh sach mon trong gio')
})

test('bam nut ben trong hop thoai khong duoc dong hop thoai', () => {
  /* Lớp phủ nền của hộp thoại mang data-close. Nếu dùng closest('[data-close]')
     thì mọi thứ bên trong hộp — kể cả nút "Đặt món" — đều khớp, hộp đóng
     trước, sự kiện submit không kịp chạy và đơn hàng không được tạo. */
  const code = stripJsComments(mainJs)
  assert.doesNotMatch(
    code,
    /closest\('\[data-close\]'\)/,
    'khong duoc dung closest("[data-close]") — se dong nham moi thu ben trong hop thoai',
  )
  assert.match(code, /target\.dataset\.close/, 'phai kiem tra data-close tren chinh phan tu bi bam')
})

/* ---------------- Lỗi JavaScript khó phát hiện bằng mắt ---------------- */

test('toast phai nam ngoai #ui-root', () => {
  /* openCart/openCheckout gán lại innerHTML của #ui-root nên toast đặt
     trong đó sẽ biến mất mỗi lần mở lại giỏ. */
  assert.match(mainJs, /id="toast-root"/)
  assert.doesNotMatch(mainJs, /ui\.append\(node\)/, 'toast dang duoc append vao #ui-root')
})

test('Escape tren trang quan tri chi dong hop thoai, khong dang xuat', () => {
  const code = stripJsComments(adminJs)
  const handler = code.slice(code.indexOf("addEventListener('keydown'"))
  assert.ok(handler.length > 0, 'phai co handler keydown')
  assert.doesNotMatch(handler, /auth\.logout\(\)/, 'Escape dang goi logout')
})

test('admin chi hien nut chuyen trang thai hop le', () => {
  assert.match(adminJs, /db\.nextOrderStatuses\(order\.status\)/)
  assert.doesNotMatch(adminJs, /db\.ORDER_FLOW\.map\(/)
})
