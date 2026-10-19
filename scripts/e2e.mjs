/**
 * Kiểm thử đầu-cuối bằng trình duyệt thật (Chrome qua puppeteer-core).
 *
 *   node scripts/e2e.mjs            -> build rồi chạy
 *   node scripts/e2e.mjs --no-build -> dùng sẵn dist/
 *
 * Tách khỏi `npm test` vì cần Chrome cài trên máy. Lý do phải có:
 * hai lỗi nặng nhất (ngăn giỏ bị lớp phủ che, hộp thoại admin vô hình và
 * không bấm được) đều là lỗi lớp CSS — không có exception nào, mọi test
 * logic vẫn xanh, chỉ có bấm chuột thật mới thấy.
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const args = process.argv.slice(2)

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error(
    '\n✗ Không tìm thấy Chrome/Edge. Đặt CHROME_PATH trỏ tới trình duyệt rồi chạy lại.\n',
  )
  process.exit(1)
}

const puppeteer = require('puppeteer-core')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

if (!args.includes('--no-build')) {
  /* Gọi thẳng API của Vite thay vì spawn `npm run build`: Node chặn
     spawnSync('npm.cmd') bằng EINVAL trên Windows. */
  const { build } = await import('vite')
  await build({ root })
}

const server = createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (pathname.endsWith('/')) pathname += 'index.html'
  const target = normalize(join(dist, pathname))
  try {
    const info = await stat(target)
    if (!info.isFile()) throw new Error('not a file')
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(await readFile(target))
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h1>404</h1>')
  }
})
const PORT = 4199 + Math.floor(Math.random() * 60)
await new Promise((resolve) => server.listen(PORT, resolve))
const BASE = `http://localhost:${PORT}`

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox'],
  protocolTimeout: 30000,
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let passed = 0
const failures = []

const check = async (name, fn) => {
  try {
    await fn()
    passed += 1
    console.log(`  ✔ ${name}`)
  } catch (error) {
    failures.push({ name, message: error.message })
    console.log(`  ✘ ${name}\n      ${error.message}`)
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) throw new Error(`${message} (thực tế: ${JSON.stringify(actual)})`)
}

/**
 * Element nào thật sự nhận cú bấm ở giữa `sel`? Đây là kiểm tra bắt lỗi lớp
 * phủ: DOM vẫn có nút, nhưng người dùng thì không bấm được.
 */
const receivesClick = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return { found: false, reason: `khong tim thay ${s}` }
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return { found: false, reason: `${s} co kich thuoc 0` }
    if (box.top < 0 || box.bottom > window.innerHeight) {
      return { found: false, reason: `${s} nam ngoai man hinh` }
    }
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      found: true,
      ok: el === hit || el.contains(hit),
      hit: hit ? `<${hit.tagName} class="${hit.className}">` : 'null',
    }
  }, sel)

/**
 * Bấm chuột THẬT vào giữa phần tử, không dùng el.click().
 *
 * Hai chi tiết bắt buộc:
 * 1. Phải cuộn tới trước — nút "Đặt ngay" nằm ngoài màn hình đầu tiên.
 * 2. Trang đặt `scroll-behavior: smooth` (src/style.css), nên phải đợi cuộn xong
 *    rồi đo lại. Đo ngay sau scrollIntoView sẽ lấy tọa độ cũ và click rơi ra
 *    ngoài viewport — tưởng như nút "hỏng" trong khi thực tế là click trượt.
 */
const realClickPoint = async (page, sel, index) => {
  const locate = (s, i) => {
    const el = i == null ? document.querySelector(s) : document.querySelectorAll(s)[i]
    if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const box = el.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    /* Báo ngay nếu bị che hoặc là phần tử ẩn — nếu không, lệnh click sẽ trượt
       sang phần tử khác và bài kiểm tra báo sai nguyên nhân. */
    const hit = document.elementFromPoint(x, y)
    const at = `tại (${Math.round(x)}, ${Math.round(y)}) trong ${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
    return {
      x,
      y,
      visible: box.width > 0 && box.height > 0,
      covered: hit === el || el.contains(hit)
        ? null
        : `${hit?.tagName ?? 'null'}.${hit?.className ?? ''} — ${el.tagName}${el.className ? `.${el.className}` : ''} ${at}`,
    }
  }

  let point = await page.evaluate(locate, sel, index ?? null)
  assert(point, index === undefined ? `khong tim thay ${sel}` : `khong tim thay ${sel}[${index}]`)
  /* Chờ cuộn nếu trang dùng smooth-scroll rồi đo lại tọa độ thật. */
  await sleep(120)
  point = await page.evaluate(locate, sel, index ?? null)

  assert(point.visible, `${sel} co kich thuoc 0 (khong hiinh, dang o view khac hoac bi an)`)
  assert(!point.covered, `${sel} bi phu bang <${point.covered}> — se click nham`)
  await page.mouse.click(point.x, point.y)
  await sleep(240)
}

const realClick = (page, sel) => realClickPoint(page, sel, undefined)
const realClickNth = (page, sel, index) => realClickPoint(page, sel, index)

/**
 * Chờ lớp phủ trượt vào đủ chỗ rồi mới bấm bên trong.
 * Giỏ trượt từ ngoài vào theo trục ngang (~280ms); đo ngay sau lệnh mở sẽ ra
 * tọa độ ngoài màn hình và báo "bị che" — tưởng như nút hỏng trong khi thực tế
 * là chưa kịp trượt tới. Chỉ so chiều ngang vì hộp thoại cao hơn màn hình là
 * bình thường và không liên quan tới hiệu ứng trượt.
 */
const waitPanel = async (page, sel) => {
  try {
    await page.waitForFunction(
      (s) => {
        const el = document.querySelector(s)
        if (!el) return true
        const r = el.getBoundingClientRect()
        return r.left >= -1 && r.right <= window.innerWidth + 1
      },
      { timeout: 3000, polling: 50 },
      sel,
    )
  } catch {
    const info = await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return `${s} khong ton tai`
      const r = el.getBoundingClientRect()
      return `${s} van o [${Math.round(r.left)}, ${Math.round(r.right)}]`
    }, sel)
    throw new Error(`${info}, khong trượt vao khoang man hinh`)
  }
}

const typeInto = async (page, sel, text) => {
  await page.evaluate((s) => {
    const el = document.querySelector(s)
    el.value = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, sel)
  await page.type(sel, text)
}

const loginAdmin = async (page) => {
  await page.evaluate(() => {
    document.querySelector('#gate-form [name="email"]').value = 'admin@cbmfood.vn'
    document.querySelector('#gate-form [name="password"]').value = 'admin123'
  })
  await page.evaluate(() => document.querySelector('#gate-form button[type="submit"]').click())
  await sleep(900)
  assert(
    await page.evaluate(() => !document.querySelector('#admin-shell').hidden),
    'đăng nhập admin thất bại',
  )
}

const trackErrors = (page, bucket) => {
  page.on('pageerror', (e) => bucket.push(`${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') bucket.push(`console: ${m.text()}`)
  })
}

/* =======================================================================
   1. GIỎ HÀNG
   ======================================================================= */

console.log('\nGIỎ HÀNG (trang bán hàng)')

const shopErrors = []
const shop = await browser.newPage()
trackErrors(shop, shopErrors)
await shop.setViewport({ width: 1440, height: 900 })
await shop.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
/* Bắt đầu từ dữ liệu sạch: nếu còn phiên admin cũ thì trang quản trị sẽ bỏ qua
   cổng đăng nhập và các bài kiểm tra sau sẽ đo nhầm. */
await shop.evaluate(() => localStorage.clear())
await shop.reload({ waitUntil: 'networkidle2' })
await sleep(600)

await check('trang ban hang khoi dong va co duoc thuc don', async () => {
  const state = await shop.evaluate(() => ({
    dishes: document.querySelectorAll('.dish').length,
    cartButton: !!document.querySelector('[data-action="open-cart"]'),
  }))
  assert(state.dishes > 0, 'khong render mon an')
  assert(state.cartButton, 'khong co nut gio hang')
})

await check('them mon vao gio bang chuot that', async () => {
  await realClick(shop, '.order-btn:not([disabled])')
  const badge = await shop.evaluate(() => document.querySelector('#cartBadge').textContent)
  assertEqual(badge, '1', 'hieu gio phai la 1')
})

await check('hieu gio an khi gio trong', async () => {
  const hidden = await shop.evaluate(() => document.querySelector('#cartBadge').hidden)
  assert(hidden === false, 'hieu gio phai hien khi co mon')
})

await check('mo duoc ngan gio', async () => {
  await realClick(shop, '[data-action="open-cart"]')
  assert(
    await shop.evaluate(() => !!document.querySelector('.cart-drawer .cart-line')),
    'ngan gio khong co dong mon',
  )
})

await check('lop phu nen khong che ngan gio (bam duoc nut +/-)', async () => {
  const plus = await receivesClick(shop, '.qty-btn[data-qty="1"]')
  assert(plus.found, plus.reason ?? '')
  assert(plus.ok, `nut "+" bi lop khac chon: ${plus.hit}`)
  const minus = await receivesClick(shop, '.qty-btn[data-qty="-1"]')
  assert(minus.ok, `nut "−" bi lop khac chon: ${minus.hit}`)
})

await check('bam "+" tang so luong thuc su', async () => {
  await realClick(shop, '.qty-btn[data-qty="1"]')
  const state = await shop.evaluate(() => ({
    open: !!document.querySelector('.cart-drawer'),
    qty: document.querySelector('.cart-line .qty span')?.textContent,
    stored: JSON.parse(localStorage.getItem('cbmfood.cart') ?? '[]')[0]?.qty,
  }))
  assert(state.open, 'ngan gio bi dong khi tang so luong')
  assertEqual(state.qty, '2', 'so luong tren man hinh')
  assertEqual(state.stored, 2, 'so luong da luu')
})

await check('bam "−" giam so luong thuc su', async () => {
  await realClick(shop, '.qty-btn[data-qty="-1"]')
  assertEqual(
    await shop.evaluate(() => document.querySelector('.cart-line .qty span')?.textContent),
    '1',
    'so luong sau khi giam',
  )
})

await check('bam "✕" xoa mon khoi gio thuc su', async () => {
  await realClick(shop, '[data-remove]')
  const state = await shop.evaluate(() => ({
    open: !!document.querySelector('.cart-drawer'),
    empty: !!document.querySelector('.cart-empty'),
    stored: JSON.parse(localStorage.getItem('cbmfood.cart') ?? '[]').length,
  }))
  assert(state.open, 'ngan gio bi dong khi xoa')
  assert(state.empty, 'phai hien thong bao gio trong')
  assertEqual(state.stored, 0, 'gio da luu phai trong')
})

await check('them lai nhieu mon roi vao thanh toan', async () => {
  await shop.keyboard.press('Escape')
  await sleep(200)
  /* Hai nút khác nhau để giỏ có 2 dòng, bấm 2 lần cùng 1 món chỉ ra 1 dòng
     với số lượng 2. */
  await realClickNth(shop, '.order-btn:not([disabled])', 0)
  await realClickNth(shop, '.order-btn:not([disabled])', 1)
  await realClick(shop, '[data-action="open-cart"]')
  assertEqual(
    await shop.evaluate(() => document.querySelectorAll('.cart-line').length),
    2,
    'phai co 2 dong trong gio',
  )
  await realClick(shop, '[data-action="checkout"]')
  assert(
    await shop.evaluate(() => !!document.querySelector('#checkoutForm')),
    'khong mo duoc form thanh toan',
  )
})

await check('bam ra ngoai form thanh toan thi dong duoc', async () => {
  await shop.mouse.click(12, 12)
  await sleep(300)
  assert(
    await shop.evaluate(() => document.querySelector('#ui-root').innerHTML === ''),
    'bam ra ngoài không đóng được form',
  )
  assertEqual(
    await shop.evaluate(() => document.body.style.overflow),
    '',
    'cuộn trang phải được trả lại',
  )
})

await check('buoc thanh toan khong co nut +/- va ✕', async () => {
  await realClick(shop, '[data-action="open-cart"]')
  await realClick(shop, '[data-action="checkout"]')
  const state = await shop.evaluate(() => ({
    qty: document.querySelectorAll('.sheet-lines .qty-btn').length,
    remove: document.querySelectorAll('.sheet-lines [data-remove]').length,
    lines: document.querySelectorAll('.sheet-lines .cart-line').length,
  }))
  assert(state.lines > 0, 'phai hien danh sach mon trong don')
  assertEqual(state.qty, 0, 'khong duoc co nut doi so luong o buoc thanh toan')
  assertEqual(state.remove, 0, 'khong duoc co nut xoa o buoc thanh toan')
})

await check('bam nut "Ve gio hang" quay lai duoc gio', async () => {
  await realClick(shop, '[data-action="back-to-cart"]')
  assert(
    await shop.evaluate(() => !!document.querySelector('.cart-drawer')),
    'khong quay lai duoc ngan gio',
  )
  await realClick(shop, '[data-action="checkout"]')
})

await check('form sai du lieu hien loi va giu nguyen don', async () => {
  await typeInto(shop, '#checkoutForm [name="name"]', 'A')
  await typeInto(shop, '#checkoutForm [name="phone"]', '123')
  await typeInto(shop, '#checkoutForm [name="address"]', 'abc')
  await realClick(shop, '#checkoutForm button[type="submit"]')
  const state = await shop.evaluate(() => ({
    error: document.querySelector('#checkoutError')?.textContent,
    stillOpen: !!document.querySelector('#checkoutForm'),
    name: document.querySelector('#checkoutForm [name="name"]')?.value,
  }))
  assert(state.error, 'phai hien loi')
  assert(state.stillOpen, 'form phai con mo de khach sua lai')
  assertEqual(state.name, 'A', 'du lieu da nhap phai duoc giu nguyen')
})

await check('dat mon thanh cong xoa gio va tao don', async () => {
  await typeInto(shop, '#checkoutForm [name="name"]', 'Nguyen Van A')
  await typeInto(shop, '#checkoutForm [name="phone"]', '0901234567')
  await typeInto(shop, '#checkoutForm [name="address"]', '123 Nguyen Hue, Quan 1, TP.HCM')
  await realClick(shop, '#checkoutForm button[type="submit"]')
  const state = await shop.evaluate(() => ({
    success: !!document.querySelector('.sheet.is-success'),
    text: document.querySelector('.sheet')?.innerText ?? '',
    cart: JSON.parse(localStorage.getItem('cbmfood.cart') ?? '[]').length,
    badge: document.querySelector('#cartBadge').hidden,
  }))
  assert(state.success, 'phai hien man hinh dat thanh cong')
  assert(/DH\d{8}-\d{3}/.test(state.text), `khong thay ma don: ${state.text}`)
  assertEqual(state.cart, 0, 'gio phai duoc xoa sau khi dat')
  assertEqual(state.badge, true, 'hieu gio phai an lai')
})

await check('mo lai gio sau khi dat thi trong', async () => {
  /* Phải bấm nút "Đóng" của hộp thoại, không bấm giữa lớp phủ nền — giữa
     lớp phủ chính là hộp thoại nên click rơi vào hộp và không đóng được. */
  await realClick(shop, '.sheet.is-success [data-close]')
  assert(
    await shop.evaluate(() => !document.querySelector('#ui-root').innerHTML),
    'bam nut Đóng phai dong duoc hộp thoại',
  )
  await realClick(shop, '[data-action="open-cart"]')
  assert(
    await shop.evaluate(() => !!document.querySelector('.cart-empty')),
    'gio phai trong sau khi dat',
  )
})

await check('trang ban hang khong co loi javascript', async () => {
  const real = shopErrors.filter((e) => !/404|Failed to load resource/.test(e))
  assertEqual(real.length, 0, `loi: ${real.join(' | ')}`)
})

/* =======================================================================
   2. TRANG QUẢN TRỊ
   ======================================================================= */

console.log('\nTRANG QUẢN TRỊ (thêm / sửa / xoá / đơn hàng)')

const adminErrors = []
const admin = await browser.newPage()
trackErrors(admin, adminErrors)
await admin.setViewport({ width: 1440, height: 950 })
await admin.goto(`${BASE}/admin.html`, { waitUntil: 'networkidle2' })
await sleep(700)

await check('cong quan tri chan khach chua dang nhap', async () => {
  const state = await admin.evaluate(() => ({
    gate: !document.querySelector('#auth-gate').hidden,
    shell: document.querySelector('#admin-shell').hidden,
  }))
  assert(state.gate && state.shell, 'phai hien cong dang nhap va an giao dien')
})

await check('dang nhap admin thanh cong', async () => {
  await loginAdmin(admin)
  assertEqual(
    await admin.evaluate(() => document.querySelector('#admin-name').textContent),
    'Quản trị viên',
    'ten nguoi dung',
  )
})

await check('trang quan tri nhin thay don vua dat', async () => {
  const orders = await admin.evaluate(() =>
    JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').length,
  )
  assert(orders > 0, 'khong thay don nao')
  await admin.evaluate(() => {
    location.hash = '#/orders'
  })
  await sleep(400)
  assertEqual(
    await admin.evaluate(() => document.querySelectorAll('.order-card').length),
    orders,
    'so don hien tren man hinh',
  )
})

await check('mo duoc trang danh sach mon', async () => {
  await admin.evaluate(() => {
    location.hash = '#/dishes'
  })
  await sleep(400)
  assert(
    (await admin.evaluate(() => document.querySelectorAll('.dish-card').length)) > 0,
    'khong co mon nao',
  )
})

await check('hop thoai them mon hien ra va bam duoc', async () => {
  await realClick(admin, '[data-action="dish-new"]')
  const state = await admin.evaluate(() => {
    const backdrop = document.querySelector('.modal-backdrop')
    const cs = backdrop ? getComputedStyle(backdrop) : null
    return {
      open: !!document.querySelector('#dish-form'),
      opacity: cs?.opacity,
      visibility: cs?.visibility,
      pointerEvents: cs?.pointerEvents,
    }
  })
  assert(state.open, 'form them mon khong mo')
  assertEqual(state.opacity, '1', 'hop thoai phai hinh')
  assertEqual(state.visibility, 'visible', 'hop thoai phai nhin thay')
  assertEqual(state.pointerEvents, 'auto', 'hop thoai phai bam duoc')
})

await check('bam duoc truong ten, gia va nut Emoji trong hop thoai', async () => {
  for (const sel of [
    '#dish-form [name="name"]',
    '#dish-form [name="price"]',
    '[data-action="pick-emoji"]',
    '[data-action="close-modal"]',
  ]) {
    const hit = await receivesClick(admin, sel)
    assert(hit.found, `${sel}: ${hit.reason ?? ''}`)
    assert(hit.ok, `${sel} bi lop khac chon: ${hit.hit}`)
  }
})

await check('them mon moi duoc', async () => {
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="name"]').value = 'Mon E2E'
    document.querySelector('#dish-form [name="price"]').value = '52000'
  })
  await realClick(admin, '[data-action="pick-emoji"]')
  await realClick(admin, '#dish-form button[type="submit"]')
  const state = await admin.evaluate(() => ({
    closed: !document.querySelector('#dish-form'),
    found: [...document.querySelectorAll('.dish-card h3')].some((h) => h.textContent === 'Mon E2E'),
    price: JSON.parse(localStorage.getItem('cbmfood.dishes')).find((d) => d.name === 'Mon E2E')
      ?.price,
    emoji: JSON.parse(localStorage.getItem('cbmfood.dishes')).find((d) => d.name === 'Mon E2E')
      ?.emoji,
  }))
  assert(state.closed, 'hop thoai phai dong sau khi luu')
  assert(state.found, 'khong thay mon vua them trong danh sach')
  assertEqual(state.price, 52000, 'gia da luu sai')
  assert(state.emoji, 'emoji da chon phai duoc luu')
})

await check('them mon ten rong bi tu choi', async () => {
  await realClick(admin, '[data-action="dish-new"]')
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="name"]').value = '   '
    document.querySelector('#dish-form [name="price"]').value = '10000'
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  const state = await admin.evaluate(() => ({
    stillOpen: !!document.querySelector('#dish-form'),
    error: [...document.querySelectorAll('.toast')].some((t) => /nhập tên món/i.test(t.textContent)),
  }))
  assert(state.stillOpen, 'form phai con mo')
  assert(state.error, 'phai co thong bao loi')
  await realClick(admin, '[data-action="close-modal"]')
})

await check('gia am bi tu choi', async () => {
  await realClick(admin, '[data-action="dish-new"]')
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="name"]').value = 'Gia Am E2E'
    document.querySelector('#dish-form [name="price"]').value = '-100'
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  assert(
    await admin.evaluate(() => !!document.querySelector('#dish-form')),
    'khong duoc luu mon gia am',
  )
  await realClick(admin, '[data-action="close-modal"]')
})

await check('sua ten va gia mon', async () => {
  const code = await admin.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('cbmfood.dishes')).find((x) => x.name === 'Mon E2E')
    return d?.code
  })
  assert(code, 'khong tim thay mon vua them')
  await realClick(admin, `.dish-card[data-code="${code}"] [data-action="dish-edit"]`)
  assert(await admin.evaluate(() => !!document.querySelector('#dish-form')), 'form sua khong mo')
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="name"]').value = 'Mon E2E Da Sua'
    document.querySelector('#dish-form [name="price"]').value = '61000'
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  const dish = await admin.evaluate(
    (c) => JSON.parse(localStorage.getItem('cbmfood.dishes')).find((x) => x.code === c),
    code,
  )
  assertEqual(dish.name, 'Mon E2E Da Sua', 'ten mon')
  assertEqual(dish.price, 61000, 'gia mon')
  assertEqual(dish.code, code, 'ma mon khong duoc doi')
})

await check('sua duoc gia goc va xoa duoc gia goc', async () => {
  const code = await admin.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('cbmfood.dishes')).find(
      (x) => x.name === 'Mon E2E Da Sua',
    )
    return d?.code
  })
  assert(code, 'khong tim thay mon vua sua')
  const load = async (c) =>
    admin.evaluate(
      (key) => JSON.parse(localStorage.getItem('cbmfood.dishes')).find((x) => x.code === key),
      c,
    )

  await realClick(admin, `.dish-card[data-code="${code}"] [data-action="dish-edit"]`)
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="originalPrice"]').value = '90000'
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  assertEqual((await load(code)).originalPrice, 90000, 'gia goc sau khi nhap')

  /* Xoá trống ô "Giá gốc" = muốn bỏ giảm giá. Trước đây gửi undefined
     nên updateDish giữ luôn giá cũ. */
  await realClick(admin, `.dish-card[data-code="${code}"] [data-action="dish-edit"]`)
  const shown = await admin.evaluate(
    () => document.querySelector('#dish-form [name="originalPrice"]').value,
  )
  assertEqual(shown, '90000', 'ô giá gốc phải điền sẵn giá hiện tại')
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="originalPrice"]').value = ''
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  assertEqual((await load(code)).originalPrice, null, 'gia goc phai duoc xoa')
})

await check('sua gia khong lam mat gia goc', async () => {
  const code = await admin.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('cbmfood.dishes')).find(
      (x) => x.name === 'Mon E2E Da Sua',
    )
    return d?.code
  })
  await realClick(admin, `.dish-card[data-code="${code}"] [data-action="dish-edit"]`)
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="originalPrice"]').value = '90000'
    document.querySelector('#dish-form [name="price"]').value = '63000'
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  const dish = await admin.evaluate(
    (c) => JSON.parse(localStorage.getItem('cbmfood.dishes')).find((x) => x.code === c),
    code,
  )
  assertEqual(dish.originalPrice, 90000, 'gia goc phai duoc giu nguyen')
  assertEqual(dish.price, 63000, 'gia ban da cap nhat')
})

await check('mon bi ngung thi bien khoi gio o trang ban hang', async () => {
  /* Bài trước cố ý để ngăn giỏ mở; phải đóng trước khi bấm món. */
  await shop.keyboard.press('Escape')
  await sleep(250)
  /* Thêm 1 món đang bán vào giỏ ở trang khách. */
  await realClick(shop, '.order-btn:not([disabled])')
  const code = await shop.evaluate(
    () => JSON.parse(localStorage.getItem('cbmfood.cart') ?? '[]')[0]?.key,
  )
  assert(code, 'gio phai co 1 mon truoc khi ngung ban')
  /* Quản trị ngưng bán chính món đó. */
  await realClick(admin, `.dish-card[data-code="${code}"] [data-action="dish-edit"]`)
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="status"]').value = 'unavailable'
  })
  await realClick(admin, '#dish-form button[type="submit"]')
  const dish = await admin.evaluate(
    (c) => JSON.parse(localStorage.getItem('cbmfood.dishes')).find((x) => x.code === c),
    code,
  )
  assertEqual(dish.status, 'unavailable', 'trang thai mon trong quan tri')

  /* Tải lại trang khách: giỏ phải tự dọn món không còn bán. */
  await shop.reload({ waitUntil: 'networkidle2' })
  await sleep(600)
  const state = await shop.evaluate((c) => {
    const lines = JSON.parse(localStorage.getItem('cbmfood.cart') ?? '[]')
    return {
      keys: lines.map((l) => l.key),
      total: lines.reduce((sum, l) => sum + l.qty, 0),
      badge: document.querySelector('#cartBadge').hidden,
      soldOut: [...document.querySelectorAll('.order-btn[disabled]')].length,
    }
  }, code)
  assert(!state.keys.includes(code), `gio van con mon da ngung ban: ${state.keys.join(', ')}`)
  assertEqual(state.soldOut > 0, true, 'mon da ngung phai hien nut "Tam ngung"')
  assertEqual(state.badge, state.total === 0, 'hieu gio phai khop so luong trong gio')
})

await check('loc danh muc va tim kiem khong dau trong admin', async () => {
  await admin.evaluate(() => {
    location.hash = '#/dishes'
  })
  await sleep(400)
  await admin.evaluate(() => {
    const input = document.querySelector('#dish-search')
    input.value = 'pho bo'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(300)
  const found = await admin.evaluate(() => document.querySelectorAll('.dish-card').length)
  assert(found > 0, 'gõ "pho bo" (không dấu) phải ra kết quả')
  await admin.evaluate(() => {
    const input = document.querySelector('#dish-search')
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(200)
})

await check('xoa mon duoc qua hop thoai xac nhan', async () => {
  const before = await admin.evaluate(() => document.querySelectorAll('.dish-card').length)
  await realClick(admin, '.dish-card[data-code="MH002"] [data-action="dish-delete"]')
  assert(
    await admin.evaluate(() => !!document.querySelector('[data-action="dish-delete-confirm"]')),
    'hop thoai xac nhan khong mo',
  )
  await realClick(admin, '[data-action="dish-delete-confirm"]')
  const state = await admin.evaluate(() => ({
    after: document.querySelectorAll('.dish-card').length,
    gone: !JSON.parse(localStorage.getItem('cbmfood.dishes')).some((d) => d.code === 'MH002'),
    modal: !!document.querySelector('.modal'),
  }))
  assertEqual(state.after, before - 1, 'so mon sau khi xoa')
  assert(state.gone, 'mon phai bi xoa khoi du lieu')
  assert(!state.modal, 'hop thoai phai dong')
})

await check('doanh thu chi tinh don hoan thanh', async () => {
  await admin.evaluate(() => {
    location.hash = '#/orders'
  })
  await sleep(400)
  await realClick(admin, '[data-action="order-status"][data-status="confirmed"]')
  assertEqual(
    await admin.evaluate(() => document.querySelector('.order-card .badge')?.textContent),
    'Đang chuẩn bị',
    'sau khi xac nhan',
  )
  await realClick(admin, '[data-action="order-status"][data-status="delivering"]')
  await realClick(admin, '[data-action="order-status"][data-status="completed"]')
  assertEqual(
    await admin.evaluate(() => document.querySelector('.order-card .badge')?.textContent),
    'Hoàn thành',
    'sau khi hoan thanh',
  )
  await admin.evaluate(() => {
    location.hash = '#/dashboard'
  })
  await sleep(400)
  const revenue = await admin.evaluate(() => {
    const card = [...document.querySelectorAll('.stat')].find((s) =>
      s.querySelector('small')?.textContent.includes('Doanh thu'),
    )
    return card?.querySelector('strong')?.textContent
  })
  assert(revenue && revenue !== '0đ', `doanh thu phai khac 0 (dang ${revenue})`)
})

await check('don da ket thuc khong con nut chuyen trang thai', async () => {
  await admin.evaluate(() => {
    location.hash = '#/orders'
  })
  await sleep(400)
  assertEqual(
    await admin.evaluate(() => document.querySelectorAll('.order-card [data-action="order-status"]').length),
    0,
    'khong duoc con nut chuyen trang thai',
  )
})

await check('loc don theo trang thai', async () => {
  await realClick(admin, '#order-chips .chip[data-status="completed"]')
  assertEqual(
    await admin.evaluate(() => document.querySelectorAll('.order-card').length),
    1,
    'loc "Hoàn thành"',
  )
  await realClick(admin, '#order-chips .chip[data-status="pending"]')
  assertEqual(
    await admin.evaluate(() => document.querySelectorAll('.order-card').length),
    0,
    'loc "Chờ xác nhận"',
  )
  await realClick(admin, '#order-chips .chip[data-status="all"]')
})

await check('Escape khong lam mat phien dang nhap', async () => {
  await admin.keyboard.press('Escape')
  await sleep(400)
  const state = await admin.evaluate(() => ({
    shell: document.querySelector('#admin-shell').hidden,
    session: localStorage.getItem('cbmfood.session.admin'),
  }))
  assert(!state.shell, 'Escape khong duoc dang xuat nguoi dung')
  assert(state.session !== null && state.session !== 'null', 'key session phai con')
})

await check('Escape van dong duoc hop thoai', async () => {
  /* Nút "Thêm món ăn" nằm ở view #/dishes, phải chuyển tab trước. */
  await admin.evaluate(() => {
    location.hash = '#/dishes'
  })
  await sleep(400)
  await realClick(admin, '[data-action="dish-new"]')
  assert(await admin.evaluate(() => !!document.querySelector('#dish-form')), 'hop thoai phai mo')
  await admin.keyboard.press('Escape')
  await sleep(300)
  assert(
    await admin.evaluate(() => !document.querySelector('#dish-form')),
    'Escape phai dong hop thoai',
  )
  assertEqual(
    await admin.evaluate(() => document.body.style.overflow),
    '',
    'cuộn trang phai duoc tra lai',
  )
})

await check('nut dang xuat ve cong', async () => {
  await realClick(admin, '#admin-logout')
  await sleep(300)
  const state = await admin.evaluate(() => ({
    gate: !document.querySelector('#auth-gate').hidden,
    session: localStorage.getItem('cbmfood.session.admin'),
  }))
  assert(state.gate, 'phai quay lai cong dang nhap')
  assertEqual(state.session, null, 'key session phai bi xoa')
})

await check('trang quan tri khong co loi javascript', async () => {
  const real = adminErrors.filter((e) => !/404|Failed to load resource/.test(e))
  assertEqual(real.length, 0, `loi: ${real.join(' | ')}`)
})

/* =======================================================================
   3. ĐƠN CỦA TÔI (khách đã đăng nhập)
   ======================================================================= */

console.log('\nĐƠN CỦA TÔI (theo dõi trạng thái + huỷ đơn)')

/* Tab quản trị đã được mở sau nên trang bán hàng nằm nền. Chrome đóng băng
   animation của tab nền — ngăn kéo sẽ đứng yên ngoài màn hình và mọi cú
   bấm bên trong đều rơi xuống lớp phủ. Phải đưa tab lên trước. */
await shop.bringToFront()

const KHACH = {
  name: 'Nguyễn Thị B',
  email: 'khach.b@cbmfood.vn',
  password: 'khach123',
  phone: '0909876543',
}

const goToMyOrders = async () => {
  await realClick(shop, '.main-nav a[href="#my-orders"]')
  await sleep(300)
}

await check('khach chua dang nhap duoc nhac dang nhap, khong thay don rong', async () => {
  await shop.keyboard.press('Escape')
  await sleep(200)
  await goToMyOrders()
  const state = await shop.evaluate(() => ({
    gate: !!document.querySelector('#myOrders .order-gate'),
    empty: !!document.querySelector('#myOrders .order-empty'),
    loginCta: [...document.querySelectorAll('#myOrders [data-auth]')].length,
  }))
  assert(state.gate, 'phai hien o "dang nhap de xem don hang"')
  assert(!state.empty, 'khong duoc hien "ban chua co don" khi chua dang nhap')
  assertEqual(state.loginCta, 2, 'phai co nut dang nhap va tao tai khoan')
})

await check('tao tai khoan khach qua giao dien', async () => {
  await realClick(shop, '#myOrders [data-auth="register"]')
  await waitPanel(shop, '.sheet')
  await typeInto(shop, '#authForm [name="name"]', KHACH.name)
  await typeInto(shop, '#authForm [name="email"]', KHACH.email)
  await typeInto(shop, '#authForm [name="phone"]', KHACH.phone)
  await typeInto(shop, '#authForm [name="password"]', KHACH.password)
  await typeInto(shop, '#authForm [name="confirm"]', KHACH.password)
  await realClick(shop, '#authForm button[type="submit"]')
  await sleep(1200)
  const state = await shop.evaluate(() => ({
    user: JSON.parse(localStorage.getItem('cbmfood.session.shop') ?? 'null')?.userId ?? null,
    gate: !!document.querySelector('#myOrders .order-gate'),
  }))
  assert(state.user, 'phai co phi dang nhap')
  assert(!state.gate, 'sau khi dang nhap phai thay danh sach don')
})

await check('tai khoan moi chua co don', async () => {
  const state = await shop.evaluate(() => ({
    empty: !!document.querySelector('#myOrders .order-empty'),
    cards: document.querySelectorAll('#myOrders .my-order').length,
  }))
  assert(state.empty, 'phai hien o trong')
  assertEqual(state.cards, 0, 'chua co the nao')
})

/** Đặt một đơn trên trang khách và trả về mã đơn. */
const placeOrder = async () => {
  await realClick(shop, '.order-btn:not([disabled])')
  await realClick(shop, '[data-action="open-cart"]')
  await waitPanel(shop, '.cart-drawer')
  await realClick(shop, '[data-action="checkout"]')
  await waitPanel(shop, '.sheet')
  await typeInto(shop, '#checkoutForm [name="name"]', KHACH.name)
  await typeInto(shop, '#checkoutForm [name="phone"]', KHACH.phone)
  await typeInto(shop, '#checkoutForm [name="address"]', '456 Nguyễn Huệ, Quận 1, TP.HCM')
  await realClick(shop, '#checkoutForm button[type="submit"]')
  await sleep(500)
  const code = await shop.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').find((o) => o.userId)?.code ?? null,
  )
  assert(code, 'khong tao duoc don cho khach da dang nhap')
  await waitPanel(shop, '.sheet.is-success')
  await realClick(shop, '.sheet.is-success [data-close]')
  return code
}

/** Đọc thẻ đơn theo mã; null nếu trang khách không hiện đơn đó. */
const readMyOrder = (code) =>
  shop.evaluate((c) => {
    const card = document.querySelector(`#myOrders .my-order[data-code="${c}"]`)
    return {
      found: !!card,
      pill: card?.querySelector('.order-pill')?.textContent ?? null,
      current: card?.querySelector('.order-step.is-current strong')?.textContent ?? null,
      done: card?.querySelectorAll('.order-step.is-done').length ?? -1,
      canCancel: !!card?.querySelector('[data-action="cancel-order"]'),
    }
  }, code)

/** Chờ thẻ đơn tự đổi nhãn trạng thái (không tải lại trang). */
const waitMyOrderStatus = async (code, label) => {
  let state = null
  for (let i = 0; i < 24; i += 1) {
    state = await readMyOrder(code)
    if (state.pill === label) break
    await sleep(250)
  }
  return state
}

let donCuaKhach = null

await check('don vua dat xuat hien ngay trong "Don cua toi"', async () => {
  const code = await placeOrder()
  donCuaKhach = code
  await goToMyOrders()
  const state = await readMyOrder(code)
  assert(state.found, 'phai thay don vua dat')
  assertEqual(state.pill, 'Chờ xác nhận', 'nhan trang thai')
  assertEqual(state.current, 'Chờ xác nhận', 'moc hien tai')
  assertEqual(state.done, 0, 'chua moc nao hoan thanh')
  assert(state.canCancel, 'don cho xac nhan phai co nut huy')
  const items = await shop.evaluate(
    (c) => document.querySelectorAll(`#myOrders .my-order[data-code="${c}"] .my-order-items li`)
      .length,
    code,
  )
  assert(items > 0, 'phai liet ke mon trong don')
})

await check('khong thay don cua khach vang lai hay cua nguoi khac', async () => {
  const state = await shop.evaluate(() => {
    const mine = new Set(
      JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]')
        .filter((o) => o.userId)
        .map((o) => o.code),
    )
    const shown = [...document.querySelectorAll('#myOrders .my-order')].map((n) => n.dataset.code)
    return {
      ok: shown.every((c) => mine.has(c)),
      cards: shown.length,
    }
  })
  assert(state.ok, 'chi duoc hien don co userId cua chinh minh')
  assertEqual(state.cards, 1, 'chi co 1 don')
})

await check('dang nhap o trang quan tri khong lam khach mat phien', async () => {
  /* Trước đây hai trang ghi chung một khoá `cbmfood.session` nên đăng nhập ở
     đây là tài khoản đang mua ở tab bán hàng bị đá đi. Nay mỗi trang một
     khoá phiên riêng. */
  await loginAdmin(admin)
  await sleep(400)
  const state = await shop.evaluate(() => ({
    gate: !!document.querySelector('#myOrders .order-gate'),
    cards: document.querySelectorAll('#myOrders .my-order').length,
    name: document.querySelector('.btn-login')?.textContent ?? null,
    guestSession: localStorage.getItem('cbmfood.session.shop'),
  }))
  assert(!state.gate, 'khách vẫn phải thấy danh sách đơn')
  assertEqual(state.cards, 1, 'đơn của khách phải còn nguyên')
  assertEqual(state.name, 'Nguyễn', 'header vẫn hiện tên khách')
  assert(state.guestSession, 'phiên khách phải còn trong localStorage')
})

await check('quan tri xac nhan don', async () => {
  await admin.evaluate(() => {
    location.hash = '#/orders'
  })
  await sleep(400)
  /* Bài lọc trạng thái trước còn đang để "Hoàn thành". */
  await realClick(admin, '[data-action="order-filter"][data-status="all"]')
  await realClick(admin, `.order-card[data-code="${donCuaKhach}"] [data-status="confirmed"]`)

  /* Tab quản trị đổi trạng thái, tab bán hàng phải tự vẽ lại. */
  const state = await waitMyOrderStatus(donCuaKhach, 'Đang chuẩn bị')
  assertEqual(state.pill, 'Đang chuẩn bị', 'trang khách phải tự thấy trạng thái mới')
  assertEqual(state.current, 'Đang chuẩn bị', 'mốc hiện tại')
  assertEqual(state.done, 1, 'một mốc đã hoàn thành')
})

await check('khach van thay don sau khi quan tri doi trang thai tiep', async () => {
  await realClick(admin, `.order-card[data-code="${donCuaKhach}"] [data-status="delivering"]`)
  const state = await waitMyOrderStatus(donCuaKhach, 'Đang giao')
  assertEqual(state.pill, 'Đang giao', 'trang khách phải tự thấy trạng thái mới')
  assertEqual(state.current, 'Đang giao', 'mốc hiện tại')
  assertEqual(state.done, 2, 'hai mốc trước đã hoàn thành')
})

await check('don da nha hàng nhận thi khong huỷ duoc', async () => {
  const state = await readMyOrder(donCuaKhach)
  assert(!state.canCancel, 'nut huy phai bien mat')
})

/* ===================== ĐÁNH GIÁ MÓN ===================== */

/** Đọc phần đánh giá của thẻ đơn trên trang khách. */
const readMyReview = (code) =>
  shop.evaluate((c) => {
    const box = document.querySelector(`#myOrders .my-order[data-code="${c}"] .review-box`)
    const row = box?.querySelector('.review-row')
    return {
      hasBox: !!box,
      head: box?.querySelector('.review-head small')?.textContent ?? null,
      rowDone: !!row?.classList.contains('is-done'),
      stars: row?.querySelectorAll('.stars > *').length ?? 0,
      comment: row?.querySelector('.review-comment')?.textContent ?? null,
      /* Phải hỏi đúng selector `:not([disabled])`: nút vắng mặt thì
         `?.disabled` là undefined và `!undefined` ra true — tức coi như sửa
         được dù đơn chưa chấm. */
      canEdit: !!row?.querySelector('[data-action="review-edit"]:not([disabled])'),
      editDisabled: !!row?.querySelector('[data-action="review-edit"][disabled]'),
      canNew: !!row?.querySelector('[data-action="review-new"]'),
      lockLabel: row?.querySelector('[data-action="review-lock"]')?.textContent?.trim() ?? null,
    }
  }, code)

/** Điểm trung bình hiện trên thẻ món ở trang thực đơn. */
const readDishRating = () =>
  shop.evaluate(() => {
    const node = document.querySelector('.dish .dish-rating')
    return {
      shown: !!node,
      text: node?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      stars: node?.querySelectorAll('.stars > *').length ?? 0,
    }
  })

const storedReviews = () =>
  shop.evaluate(() => JSON.parse(localStorage.getItem('cbmfood.reviews') ?? '[]'))

await check('don chua giao xong thi chua duoc cham sao', async () => {
  await goToMyOrders()
  const state = await readMyReview(donCuaKhach)
  assert(!state.hasBox, 'đơn đang giao chưa được chấm sao')
  assertEqual(
    await shop.evaluate(() => document.querySelectorAll('.dish-rating').length),
    0,
    'chưa có đánh giá thì thẻ món không hiện điểm',
  )
})

await check('quan tri giao xong thi khach duoc cham sao', async () => {
  await admin.bringToFront()
  await realClick(admin, `.order-card[data-code="${donCuaKhach}"] [data-status="completed"]`)

  await shop.bringToFront()
  await waitMyOrderStatus(donCuaKhach, 'Hoàn thành')
  await sleep(300)
  const state = await readMyReview(donCuaKhach)
  assert(state.hasBox, 'đơn hoàn thành phải có khối đánh giá')
  assert(state.head?.includes('0/1'), `phải báo chưa chấm món nào: ${state.head}`)
  assert(!state.canEdit, 'chưa chấm thì không có nút sửa')
  assert(state.canNew, 'chưa chấm thì phải có nút chấm sao')
  assertEqual(state.lockLabel, null, 'chưa chấm thì không có nút khoá')
})

await check('bam cham sao thi hien hop thoai 5 sao', async () => {
  await realClick(shop, `#myOrders .my-order[data-code="${donCuaKhach}"] [data-action="review-new"]`)
  await waitPanel(shop, '.sheet')
  const state = await shop.evaluate(() => ({
    stars: document.querySelectorAll('.sheet .star-btn').length,
    on: document.querySelectorAll('.sheet .star-btn.is-on').length,
    note: document.querySelector('.sheet .star-note')?.textContent?.trim(),
    focused: document.activeElement?.className ?? null,
  }))
  assertEqual(state.stars, 5, 'phai hien du 5 nut sao')
  assertEqual(state.on, 5, 'mac dinh chon 5 sao')
  assertEqual(state.note, '5/5 sao')
  assert(state.focused?.includes('star-btn'), 'phai focus vao nut sao')
})

await check('cham 4 sao va nhac xinh duoc luu', async () => {
  await realClickNth(shop, '.sheet .star-btn', 3)
  const picked = await shop.evaluate(() => ({
    on: document.querySelectorAll('.sheet .star-btn.is-on').length,
    note: document.querySelector('.sheet .star-note')?.textContent?.trim(),
  }))
  assertEqual(picked.on, 4, 'bam sao thu 4 phai chon dung 4 sao')
  assertEqual(picked.note, '4/5 sao')

  await typeInto(shop, '.sheet textarea[name="comment"]', 'Ngon, giao nhanh')
  await realClick(shop, '[data-action="review-save"]')
  await sleep(500)

  const saved = await storedReviews()
  assertEqual(saved.length, 1, 'phai ghi 1 danh gia')
  assertEqual(saved[0].rating, 4, 'luu dung so sao')
  assertEqual(saved[0].comment, 'Ngon, giao nhanh')
  assertEqual(saved[0].orderCode, donCuaKhach, 'review phai gan dung don')
  assertEqual(saved[0].locked, false)

  const state = await readMyReview(donCuaKhach)
  assert(state.rowDone, 'phai hien danh gia da cham')
  assertEqual(state.head, '1/1 món đã chấm')
  assertEqual(state.comment, 'Ngon, giao nhanh')
  assertEqual(state.lockLabel, 'Khoá', 'phai co nut khoa')
})

await check('diem trung binh hien tren the mon', async () => {
  await shop.evaluate(() => {
    location.hash = '#/'
  })
  await sleep(500)
  const state = await readDishRating()
  assert(state.shown, 'phai hien diem tren the mon')
  assertEqual(state.stars, 5, 'dai sao luon 5 ky tu')
  assert(state.text?.includes('4'), `phai hien diem 4: ${state.text}`)
  assert(state.text?.includes('1 đánh giá'), `phai hien so luot danh gia: ${state.text}`)
})

await check('sua lai danh gia cua chinh minh', async () => {
  await shop.evaluate(() => {
    location.hash = '#my-orders'
  })
  await sleep(400)
  await realClick(shop, `#myOrders .my-order[data-code="${donCuaKhach}"] [data-action="review-edit"]`)
  await waitPanel(shop, '.sheet')
  assertEqual(
    await shop.evaluate(() => document.querySelectorAll('.sheet .star-btn.is-on').length),
    4,
    'mo ra phai thay dung so sao da chon',
  )
  assertEqual(
    await shop.evaluate(() => document.querySelector('.sheet textarea[name="comment"]').value),
    'Ngon, giao nhanh',
    'phai nap lai nhan xinh',
  )

  await realClickNth(shop, '.sheet .star-btn', 4)
  await realClick(shop, '[data-action="review-save"]')
  await sleep(500)
  const saved = await storedReviews()
  assertEqual(saved.length, 1, 'sua phai ghi de khong tao ban moi')
  assertEqual(saved[0].rating, 5, 'phai cap nhat so sao')
  assertEqual(saved[0].comment, 'Ngon, giao nhanh')
})

await check('khoa danh gia thi khong sua duoc nua', async () => {
  await realClick(shop, `#myOrders .my-order[data-code="${donCuaKhach}"] [data-action="review-lock"]`)
  await sleep(400)
  assertEqual((await storedReviews())[0].locked, true, 'phai ghi co khoa')
  const state = await readMyReview(donCuaKhach)
  assert(!state.canEdit, 'nut sua phai khoa theo')
  assert(state.editDisabled, 'nut sua phai hien vo hinh')
  assert(!state.canNew, 'da cham thi khong con nut cham sao')
  assertEqual(state.lockLabel, 'Mở khoá', 'phai doi nhan thanh mo khoa')
  /* Đánh giá khoá vẫn hiện sao để khách xem lại được. */
  assert(state.rowDone && state.stars === 5, 'đánh giá đã khoá vẫn phải hiện')
})

await check('mo khoa thi sua lai duoc', async () => {
  await realClick(shop, `#myOrders .my-order[data-code="${donCuaKhach}"] [data-action="review-lock"]`)
  await sleep(400)
  assertEqual((await storedReviews())[0].locked, false)
  assert((await readMyReview(donCuaKhach)).canEdit, 'mo khoa phai bat lai nut sua')

  await realClick(shop, `#myOrders .my-order[data-code="${donCuaKhach}"] [data-action="review-edit"]`)
  await waitPanel(shop, '.sheet')
  assertEqual(
    await shop.evaluate(() => document.querySelectorAll('.sheet .star-btn.is-on').length),
    5,
    'mo khoa xong phai sua duoc so sao da chon',
  )
  await realClickNth(shop, '.sheet .star-btn', 2)
  await realClick(shop, '[data-action="review-save"]')
  await sleep(500)
  const saved = await storedReviews()
  assertEqual(saved.length, 1)
  assertEqual(saved[0].rating, 3, 'phai ghi lai so sao da sua')
})

await check('quan tri thay va an danh gia duoc', async () => {
  await admin.bringToFront()
  await admin.evaluate(() => {
    location.hash = '#/orders'
  })
  await sleep(400)
  await realClick(admin, '[data-action="order-filter"][data-status="all"]')
  await sleep(300)

  const hien = await admin.evaluate(
    (c) => ({
      box: !!document.querySelector(`.order-card[data-code="${c}"] .admin-review`),
      label: document
        .querySelector(`.order-card[data-code="${c}"] [data-action="review-hide"]`)
        ?.textContent?.trim(),
    }),
    donCuaKhach,
  )
  assert(hien.box, 'quan tri phai thay danh gia cua don')
  assertEqual(hien.label, 'Ẩn')

  await realClick(admin, `.order-card[data-code="${donCuaKhach}"] [data-action="review-hide"]`)
  await sleep(300)
  assertEqual((await storedReviews())[0].hidden, true, 'phai ghi co an')
  assertEqual(
    await admin.evaluate(
      (c) =>
        document
          .querySelector(`.order-card[data-code="${c}"] [data-action="review-hide"]`)
          ?.textContent?.trim(),
      donCuaKhach,
    ),
    'Hiện lại',
    'nut phai doi thanh hien lai',
  )

  /* Đánh giá bị ẩn thì món trở lại chưa có điểm ở trang khách. */
  await shop.bringToFront()
  await sleep(400)
  await shop.evaluate(() => {
    location.hash = '#/'
  })
  await sleep(500)
  assert(
    !(await readDishRating()).shown,
    'điểm bị ẩn thì không được hiện trên thẻ món',
  )

  await admin.bringToFront()
  await realClick(admin, `.order-card[data-code="${donCuaKhach}"] [data-action="review-hide"]`)
  await sleep(300)
  assertEqual((await storedReviews())[0].hidden, false)

  await shop.bringToFront()
  await sleep(400)
  assert((await readDishRating()).shown, 'hien lai thi diem phai quay ve')
})

await check('review chi gan vao don cua chinh minh', async () => {
  /* Kho lưu theo orderId+dishKey: nếu ghép nhầm sang đơn khác thì khách sẽ
     thấy điểm của người khác hoặc chấm trộn. */
  const saved = await storedReviews()
  assertEqual(saved.length, 1, 'chi co mot danh gia')
  const don = await shop.evaluate(
    (c) => JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').find((o) => o.code === c),
    donCuaKhach,
  )
  assertEqual(saved[0].orderId, don.id, 'review phai tro ve dung don')
  assertEqual(saved[0].dishKey, don.items[0].key, 'review phai tro ve dung mon')
  assertEqual(saved[0].userId, don.userId, 'review phai thuoc ve chu don')
})

await check('quan tri dang xuat thi khach van giu phien', async () => {
  await realClick(admin, '#admin-logout')
  await sleep(400)
  const state = await shop.evaluate(() => ({
    gate: !!document.querySelector('#myOrders .order-gate'),
    cards: document.querySelectorAll('#myOrders .my-order').length,
    adminSession: localStorage.getItem('cbmfood.session.admin'),
    guestSession: localStorage.getItem('cbmfood.session.shop'),
  }))
  assert(!state.gate, 'khách không bị đá ra khỏi trang')
  assertEqual(state.cards, 1, 'đơn của khách phải còn nguyên')
  assertEqual(state.adminSession, null, 'chỉ xoá phiên quản trị')
  assert(state.guestSession, 'phiên khách phải còn')
})

await check('huỷ don qua hộp xac nhan', async () => {
  const code = await placeOrder()
  await goToMyOrders()
  await realClick(shop, `#myOrders .my-order[data-code="${code}"] [data-action="cancel-order"]`)
  await waitPanel(shop, '.sheet')
  assert(
    await shop.evaluate(() => !!document.querySelector('[data-action="cancel-order-confirm"]')),
    'phai hien hop thoai xac nhan',
  )

  await realClick(shop, '.sheet [data-close]')
  assert(
    await shop.evaluate(
      (c) =>
        JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').find((o) => o.code === c)
          ?.status === 'pending',
      code,
    ),
    'bam "Giu lai" phai giu nguyen don',
  )
  assert((await readMyOrder(code)).canCancel, 'đóng hộp thoại thì vẫn huỷ được')

  await realClick(shop, `#myOrders .my-order[data-code="${code}"] [data-action="cancel-order"]`)
  await waitPanel(shop, '.sheet')
  await realClick(shop, '[data-action="cancel-order-confirm"]')
  await sleep(400)
  const state = await shop.evaluate((c) => {
    const card = document.querySelector(`#myOrders .my-order[data-code="${c}"]`)
    return {
      pill: card?.querySelector('.order-pill')?.textContent ?? null,
      cancelled: !!card?.querySelector('.order-cancelled'),
      canCancel: !!card?.querySelector('[data-action="cancel-order"]'),
      saved: JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').find((o) => o.code === c)
        ?.status,
    }
  }, code)
  assertEqual(state.pill, 'Đã huỷ', 'nhan sau khi huy')
  assert(state.cancelled, 'phai hien dong "Da duoc huy" thay cho duoi moc')
  assert(!state.canCancel, 'khong duoc huy lan nua')
  assertEqual(state.saved, 'cancelled', 'du lieu phai duoc ghi')
})

await check('nhac dang xuat thi o cua don bien mat', async () => {
  await shop.evaluate(() => {
    location.hash = '#my-orders'
  })
  await sleep(200)
  await realClick(shop, '.btn-login')
  await realClick(shop, '[data-action="logout"]')
  await sleep(400)
  const state = await shop.evaluate(() => ({
    gate: !!document.querySelector('#myOrders .order-gate'),
    cards: document.querySelectorAll('#myOrders .my-order').length,
  }))
  assert(state.gate, 'phai quay lai o dang nhap')
  assertEqual(state.cards, 0, 'khong duoc con hien don')
})

await check('trang ban hang khong co loi javascript sau khi them don', async () => {
  const real = shopErrors.filter((e) => !/404|Failed to load resource/.test(e))
  assertEqual(real.length, 0, `loi: ${real.join(' | ')}`)
})

/* ===================== VOUCHER + TỒN KHO ===================== */

console.log('\nVOUCHER + TỒN KHO (admin tạo mã, khách áp, hết hàng)')

/* Bài trước cố tình đăng xuất admin và khách để kiểm tra việc chia phiên. Phần
   này cần cả hai nên phải đăng nhập lại qua giao diện thật. */
await admin.bringToFront()
await loginAdmin(admin)

/** Đăng nhập lại tài khoản khách đã tạo ở mục "Đơn của tôi". */
const loginCustomer = async () => {
  await shop.bringToFront()
  await realClick(shop, '.btn-login')
  await waitPanel(shop, '.sheet')
  await typeInto(shop, '#authForm [name="email"]', KHACH.email)
  await typeInto(shop, '#authForm [name="password"]', KHACH.password)
  await realClick(shop, '#authForm button[type="submit"]')
  await sleep(800)
  assert(
    await shop.evaluate(() => localStorage.getItem('cbmfood.session.shop') !== null),
    'dang nhap lai khach that bai',
  )
}

/* Đơn có voucher phải thuộc khách đã đăng nhập thì "Đơn của tôi" mới hiện. */
await loginCustomer()

await check('phai dang nhap lai truoc khi dung voucher', async () => {
  await admin.evaluate(() => {
    location.hash = '#/vouchers'
  })
  await sleep(400)
  const state = await admin.evaluate(() => ({
    shell: !document.querySelector('#admin-shell').hidden,
    view: !document.querySelector('.view[data-view="vouchers"]')?.hidden,
    nav: !!document.querySelector('[data-nav="vouchers"]'),
    empty: document.querySelectorAll('.voucher-card').length,
  }))
  assert(state.shell, 'phai co lai giao dien quan tri')
  assert(state.view, 'phai hien trang voucher')
  assert(state.nav, 'phai co muc voucher trong menu')
  assertEqual(state.empty, 0, 'chua tao ma nao')
})

await check('admin tao voucher giam 10%', async () => {
  await realClick(admin, '[data-action="voucher-new"]')
  await admin.evaluate(() => !!document.querySelector('#voucher-form'))
  await typeInto(admin, '#voucher-form [name="code"]', 'GIAM10')
  await admin.evaluate(() => {
    document.querySelector('#voucher-form [name="type"]').value = 'percent'
    document.querySelector('#voucher-form [name="value"]').value = '10'
  })
  await realClick(admin, '#voucher-form button[type="submit"]')
  await sleep(500)
  const state = await admin.evaluate(() => {
    const card = document.querySelector('.voucher-card')
    return {
      closed: !document.querySelector('#voucher-form'),
      code: card?.querySelector('.voucher-code')?.textContent ?? null,
      badge: card?.querySelector('.badge')?.textContent ?? null,
      benefit: card?.querySelector('.voucher-benefit')?.textContent ?? null,
      saved: JSON.parse(localStorage.getItem('cbmfood.vouchers') ?? '[]').map((v) => v.code),
    }
  })
  assert(state.closed, 'form phai dong lai')
  assertEqual(state.code, 'GIAM10', 'hien ma vua tao')
  assertEqual(state.badge, 'Đang chạy', 'trang thai mac dinh')
  assert(/10%/.test(state.benefit ?? ''), 'phai hien muc giam')
  assertEqual(state.saved.length, 1, 'phai ghi xuong localStorage')
})

await check('tao trung ma bi tu choi', async () => {
  await realClick(admin, '[data-action="voucher-new"]')
  await typeInto(admin, '#voucher-form [name="code"]', 'giam10')
  await admin.evaluate(() => {
    document.querySelector('#voucher-form [name="value"]').value = '20'
  })
  await realClick(admin, '#voucher-form button[type="submit"]')
  await sleep(300)
  const state = await admin.evaluate(() => ({
    stillOpen: !!document.querySelector('#voucher-form'),
    /* Toast cũ vẫn còn trên màn hình nên phải gộp mọi thông báo, không đọc
       `.toast` đầu tiên. */
    toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent ?? ''),
    count: JSON.parse(localStorage.getItem('cbmfood.vouchers') ?? '[]').length,
  }))
  assert(state.stillOpen, 'form phai mo de sua')
  assert(
    state.toasts.some((t) => /đã tồn tại/i.test(t)),
    `phai bao trung ma, thay vao do la "${state.toasts.join(' / ')}"`,
  )
  assertEqual(state.count, 1, 'khong tao them ban ghi')
  await realClick(admin, '#voucher-form [data-action="close-modal"]')
  await sleep(200)
})

/* Số tiền tạm tính phụ thuộc món đầu tiên còn bán, nên chốt một món riêng có
   tồn kho để các bước sau không phụ thuộc thứ tự dữ liệu. */
const MON_VOUCHER = await admin.evaluate(() => {
  const dishes = JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]')
  const dish = dishes.find((d) => d.status !== 'unavailable' && d.price > 0)
  if (dish) {
    dish.stock = 50
    dish.sold = 0
  }
  localStorage.setItem('cbmfood.dishes', JSON.stringify(dishes))
  return dish ? { code: dish.code, price: dish.price } : null
})
assert(MON_VOUCHER, 'can it nhat mot mon de ap voucher')

await shop.bringToFront()
await shop.evaluate(() => {
  location.hash = '#menu'
  localStorage.removeItem('cbmfood.cart')
  localStorage.removeItem('cbmfood.cartVoucher')
})
await sleep(600)

/** Thêm một món cụ thể vào giỏ và mở ngăn giỏ. */
const addToCart = async (code) => {
  await shop.evaluate(() => {
    location.hash = '#menu'
  })
  await sleep(500)
  await realClick(shop, `[data-add="${code}"]`)
  await realClick(shop, '[data-action="open-cart"]')
  await waitPanel(shop, '.cart-drawer')
}

/** Đọc ô voucher và dòng tiền trong ngăn giỏ. */
const readCartVoucher = () =>
  shop.evaluate(() => {
    const box = document.querySelector('.cart-drawer .voucher-box')
    return {
      hasBox: !!box,
      hasInput: !!box?.querySelector('[name="code"]'),
      tag: box?.querySelector('.voucher-tag')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      remove: !!box?.querySelector('[data-action="voucher-remove"]'),
      error: box?.parentElement?.querySelector('.voucher-error')?.textContent ?? null,
      /* `.is-off` nằm ngay trên `.cart-sum` chứ không phải bên trong nó. */
      off: document.querySelector('.cart-drawer .cart-sum.is-off b')?.textContent ?? null,
      total: document.querySelector('.cart-drawer .cart-sum .is-total b')?.textContent ?? null,
    }
  })

await check('o voucher xuat hien trong gio', async () => {
  await addToCart(MON_VOUCHER.code)
  const state = await readCartVoucher()
  assert(state.hasBox, 'phai co o voucher')
  assert(state.hasInput, 'phai co o nhap ma')
  assert(!state.tag, 'chua ap ma thi khong hien the nao ap dung')
})

await check('ap ma sai thi bao loi va khong giam tien', async () => {
  await typeInto(shop, '.cart-drawer .voucher-box [name="code"]', 'KHONGCO')
  await realClick(shop, '.cart-drawer .voucher-box button[type="submit"]')
  await sleep(400)
  const state = await readCartVoucher()
  assert(state.error, 'phai bao loi')
  assert(!state.tag, 'khong duoc hien ma da ap')
  assert(!state.off, 'khong duoc giam tien')
  assert(state.hasInput, 'phai cho nhap lai')
})

await check('ap ma dung thi giam tien hien tren gio', async () => {
  /* Giỏ lưu khoá/số lượng nên không có đơn giá; lấy tạm tính từ dòng tổng
     mà khách nhìn thấy rồi tính lại 10% để so. */
  const subtotal = await shop.evaluate(() => {
    const text = document.querySelector('.cart-drawer .cart-sum b')?.textContent ?? ''
    return Number(text.replace(/[^\d]/g, ''))
  })
  assert(subtotal > 0, 'phai co tam tinh de so sanh')
  const expected = `−${String(Math.floor((subtotal * 0.1) / 1000) * 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`
  await typeInto(shop, '.cart-drawer .voucher-box [name="code"]', 'giam10')
  await realClick(shop, '.cart-drawer .voucher-box button[type="submit"]')
  await sleep(400)
  const state = await readCartVoucher()
  assert(state.tag, 'phai hien the ma da ap')
  assert(state.remove, 'phai co nut bo ma')
  assert(state.off, 'phai co dong giam gia')
  assertEqual(state.off, expected, 'so tien giam')
  const saved = await shop.evaluate(() => localStorage.getItem('cbmfood.cartVoucher'))
  assertEqual(saved, 'GIAM10', 'ma phai duoc giu lai')
})

await check('bo ma thi tong tien ve day du', async () => {
  await realClick(shop, '.cart-drawer [data-action="voucher-remove"]')
  await sleep(400)
  const state = await readCartVoucher()
  assert(!state.tag, 'the ma phai bien')
  assert(!state.off, 'dong giam gia phai bien')
  assert(state.hasInput, 'phai quay ve o nhap ma')
})

let donVoucher = null
await check('dat mon co giam gia vao don', async () => {
  await typeInto(shop, '.cart-drawer .voucher-box [name="code"]', 'GIAM10')
  await realClick(shop, '.cart-drawer .voucher-box button[type="submit"]')
  await sleep(300)
  await realClick(shop, '[data-action="checkout"]')
  await waitPanel(shop, '.sheet')
  await typeInto(shop, '#checkoutForm [name="name"]', 'Voucher Test')
  await typeInto(shop, '#checkoutForm [name="phone"]', '0905550001')
  await typeInto(shop, '#checkoutForm [name="address"]', '12 Lê Duẩn, Quận 1, TP.HCM')
  await realClick(shop, '#checkoutForm button[type="submit"]')
  await sleep(600)
  const order = await shop.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').find(
        (o) => o.customer.name === 'Voucher Test',
      ) ?? null,
  )
  assert(order, 'phai tao duoc don')
  donVoucher = order.code
  assertEqual(order.voucher?.code, 'GIAM10', 'don phai luu ma')
  /* 1 mon gia P, giam 10% lam tron xuong boi 1.000d. */
  assertEqual(order.discount, Math.floor(order.subtotal / 10 / 1000) * 1000, 'so tien giam')
  assertEqual(
    order.total,
    order.subtotal - order.discount + order.shipping,
    'tong cong phai khop',
  )
  const used = await shop.evaluate(
    () => JSON.parse(localStorage.getItem('cbmfood.vouchers') ?? '[]')[0]?.usedCount ?? -1,
  )
  assertEqual(used, 1, 'phai ghi nhan 1 luot dung')
  await waitPanel(shop, '.sheet.is-success')
  await realClick(shop, '.sheet.is-success [data-close]')
})

await check('don cu hien so tien da giam', async () => {
  await shop.evaluate(() => {
    location.hash = '#my-orders'
  })
  await sleep(500)
  const state = await shop.evaluate((c) => {
    const card = document.querySelector(`#myOrders .my-order[data-code="${c}"]`)
    return {
      found: !!card,
      off: card?.querySelector('.my-order-sum .is-off dd')?.textContent ?? null,
      code: card?.querySelector('.my-order-sum .is-off dt')?.textContent ?? null,
    }
  }, donVoucher)
  assert(state.found, 'phai thay don vua dat')
  assert(state.code?.includes('GIAM10'), 'phai hien ma da ap tren don')
  assert(state.off?.startsWith('−'), `phai hien so tien da giam, thay vao do "${state.off}"`)
})

/* ===================== TỒN KHO ===================== */

await admin.bringToFront()

/** Sửa tồn kho của một món qua form sửa món rồi trả về giá trị mới. */
const editStock = async (code, stock) => {
  await realClick(admin, `.dish-card[data-code="${code}"] [data-action="dish-edit"]`)
  await admin.evaluate(() => !!document.querySelector('#dish-form'))
  await admin.evaluate((s) => {
    document.querySelector('#dish-form [name="stock"]').value = s === null ? '' : String(s)
  }, stock)
  await realClick(admin, '#dish-form button[type="submit"]')
  await sleep(500)
  return admin.evaluate(
    (c) =>
      JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]').find((d) => d.code === c)?.stock ??
      null,
    code,
  )
}

await check('admin dat ton kho qua form mon', async () => {
  await admin.evaluate(() => {
    location.hash = '#/dishes'
  })
  await sleep(400)
  await realClick(admin, '[data-action="dish-new"]')
  await admin.evaluate(() => !!document.querySelector('#dish-form'))
  await typeInto(admin, '#dish-form [name="name"]', 'Mon Ton Kho E2E')
  await admin.evaluate(() => {
    document.querySelector('#dish-form [name="price"]').value = '40000'
  })
  await typeInto(admin, '#dish-form [name="stock"]', '3')
  await realClick(admin, '#dish-form button[type="submit"]')
  await sleep(500)
  const saved = await admin.evaluate(() =>
    JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]').find(
      (d) => d.name === 'Mon Ton Kho E2E',
    ),
  )
  assert(saved, 'phai tao duoc mon')
  assertEqual(saved.stock, 3, 'ton kho phai duoc ghi')
})

await check('khach khong them duoc so luong vuot ton kho', async () => {
  await shop.bringToFront()
  await shop.evaluate(() => {
    location.hash = '#menu'
    localStorage.removeItem('cbmfood.cart')
  })
  await sleep(600)
  const code = await shop.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]').find(
        (d) => d.name === 'Mon Ton Kho E2E',
      )?.code ?? null,
  )
  assert(code, 'phai tim thay mon')
  /* Lần thứ 4 vượt tồn 3 phần nên phải bị chặn. */
  for (let i = 0; i < 4; i += 1) await realClick(shop, `[data-add="${code}"]`)
  await sleep(200)
  const state = await shop.evaluate(() => ({
    cart: JSON.parse(localStorage.getItem('cbmfood.cart') ?? '[]'),
    toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent ?? ''),
  }))
  assertEqual(state.cart[0]?.qty, 3, 'chi them duoc 3 phan')
  assert(
    state.toasts.some((t) => /chỉ còn 3 phần/i.test(t)),
    `phai bao het ton, thay vao do "${state.toasts.join(' / ')}"`,
  )
})

await check('dat het ton kho thi nut dat bi khoa', async () => {
  await realClick(shop, '[data-action="open-cart"]')
  await waitPanel(shop, '.cart-drawer')
  await realClick(shop, '[data-action="checkout"]')
  await waitPanel(shop, '.sheet')
  await typeInto(shop, '#checkoutForm [name="name"]', 'Ton Kho Test')
  await typeInto(shop, '#checkoutForm [name="phone"]', '0905550002')
  await typeInto(shop, '#checkoutForm [name="address"]', '34 Hai Bà Trưng, Quận 1, TP.HCM')
  await realClick(shop, '#checkoutForm button[type="submit"]')
  await sleep(600)
  const left = await admin.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]').find(
        (d) => d.name === 'Mon Ton Kho E2E',
      )?.stock ?? null,
  )
  assertEqual(left, 0, 'ton kho phai ve 0')
  await waitPanel(shop, '.sheet.is-success')
  await realClick(shop, '.sheet.is-success [data-close]')
  await shop.evaluate(() => {
    location.hash = '#menu'
  })
  await sleep(600)
  const state = await shop.evaluate(() => {
    const dishes = JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]')
    const dish = dishes.find((d) => d.name === 'Mon Ton Kho E2E')
    const card = dish
      ? [...document.querySelectorAll('.dish')].find((n) => n.querySelector(`[data-add="${dish.code}"]`))
      : null
    const btn = card?.querySelector(`[data-add="${dish?.code}"]`)
    return {
      code: dish?.code ?? null,
      hasCard: !!card,
      disabled: btn ? btn.disabled : null,
      label: btn?.textContent?.trim() ?? null,
      flag: card?.querySelector('.dish-flag')?.textContent?.trim() ?? null,
    }
  })
  /* Món hết hàng vẫn hiện để khách biết món này tồn tại, nhưng không đặt được
     nữa. Việc "ẩn khỏi danh sách bán" đã có unit test ở tầng store. */
  assert(state.hasCard, 'the mon van phai con tren thuc don')
  assertEqual(state.disabled, true, 'nut dat phai bi khoa')
  assertEqual(state.label, 'Hết hàng', 'nhan tren nut phai la "Het hang"')
  assertEqual(state.flag, 'Hết hàng', 'phai co nhan canh bao het hang')
})

await check('admin thay lai ton kho thi mon hien lai', async () => {
  const code = await admin.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]').find(
        (d) => d.name === 'Mon Ton Kho E2E',
      )?.code ?? null,
  )
  assert(code, 'phai tim thay mon')
  const stock = await editStock(code, 10)
  assertEqual(stock, 10, 'ton kho phai duoc cap lai')

  /* Trang khách phải tự nạp lại khi store đổi ở tab khác. */
  await shop.bringToFront()
  await shop.evaluate(() => {
    location.hash = '#menu'
    window.dispatchEvent(new StorageEvent('storage', { key: 'cbmfood.dishes' }))
  })
  await sleep(600)
  const state = await shop.evaluate((c) => {
    const card = [...document.querySelectorAll('.dish')].find((n) =>
      n.querySelector(`[data-add="${c}"]`),
    )
    const btn = card?.querySelector(`[data-add="${c}"]`)
    return { hasCard: !!card, disabled: btn ? btn.disabled : null }
  }, code)
  assert(state.hasCard, 'phai thay mon')
  assertEqual(state.disabled, false, 'nut dat phai bat lai khi con ton')
})

await check('admin huy don thi ton kho duoc hoan lai', async () => {
  const order = await admin.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cbmfood.orders') ?? '[]').find(
        (o) => o.customer.name === 'Ton Kho Test',
      ) ?? null,
  )
  assert(order, 'phai tim thay don de huy')
  assertEqual(order.items[0]?.qty, 3, 'don lay het 3 phan')
  const readStock = async () =>
    admin.evaluate(
      () =>
        JSON.parse(localStorage.getItem('cbmfood.dishes') ?? '[]').find(
          (d) => d.name === 'Mon Ton Kho E2E',
        )?.stock ?? null,
    )
  const before = await readStock()

  await admin.evaluate(() => {
    location.hash = '#/orders'
  })
  await sleep(400)
  await realClick(admin, `.order-card[data-code="${order.code}"] [data-status="cancelled"]`)
  await sleep(500)
  const after = await readStock()
  assertEqual(after, (before ?? 0) + 3, 'huy don phai hoan lai ton kho')
})

await check('voucher tat thi khong dung duoc nua', async () => {
  await admin.bringToFront()
  await admin.evaluate(() => {
    location.hash = '#/vouchers'
  })
  await sleep(400)
  await realClick(admin, '.voucher-card [data-action="voucher-toggle"]')
  await sleep(400)
  const saved = await admin.evaluate(
    () => JSON.parse(localStorage.getItem('cbmfood.vouchers') ?? '[]')[0]?.active ?? null,
  )
  assertEqual(saved, false, 'phai tat duoc ma')

  await shop.bringToFront()
  await shop.evaluate(() => {
    localStorage.removeItem('cbmfood.cartVoucher')
    location.hash = '#menu'
  })
  await sleep(500)
  await addToCart(MON_VOUCHER.code)
  await typeInto(shop, '.cart-drawer .voucher-box [name="code"]', 'GIAM10')
  await realClick(shop, '.cart-drawer .voucher-box button[type="submit"]')
  await sleep(400)
  const state = await readCartVoucher()
  assert(state.error, 'phai bao loi khi ma da tat')
  assert(!state.off, 'khong duoc giam tien')
})

await check('admin xoa voucher da dung', async () => {
  await admin.bringToFront()
  await admin.evaluate(() => {
    location.hash = '#/vouchers'
  })
  await sleep(400)
  await realClick(admin, '.voucher-card [data-action="voucher-delete"]')
  await sleep(300)
  await realClick(admin, '[data-action="voucher-delete-confirm"]')
  await sleep(400)
  const state = await admin.evaluate(() => ({
    count: JSON.parse(localStorage.getItem('cbmfood.vouchers') ?? '[]').length,
    card: document.querySelectorAll('.voucher-card').length,
  }))
  assertEqual(state.count, 0, 'phai xoa het')
  assertEqual(state.card, 0, 'danh sach phai rong')
})

await check('khong co loi javascript sau khi dung voucher va ton kho', async () => {
  const shopReal = shopErrors.filter((e) => !/404|Failed to load resource/.test(e))
  const adminReal = adminErrors.filter((e) => !/404|Failed to load resource/.test(e))
  assertEqual(shopReal.length, 0, `loi trang ban hang: ${shopReal.join(' | ')}`)
  assertEqual(adminReal.length, 0, `loi trang quan tri: ${adminReal.join(' | ')}`)
})

/* ======================================================================= */

await browser.close()
server.close()

console.log(`\n${'─'.repeat(52)}`)
if (failures.length) {
  console.log(`✘ ${failures.length} that bai / ${passed + failures.length} kiem tra\n`)
  for (const f of failures) console.log(`  · ${f.name}\n    ${f.message}\n`)
  process.exit(1)
}
console.log(`✔ ${passed}/${passed} kiem tra đầu-cuối đều đạt`)
process.exit(0)
