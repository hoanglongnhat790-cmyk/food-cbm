/**
 * Máy chủ tĩnh cho bản demo — KHÔNG cần cài thêm gói nào.
 *
 *   node scripts/demo.mjs            -> build rồi phục vụ http://localhost:4173
 *   node scripts/demo.mjs --no-build -> chỉ phục vụ thư mục dist/ đã có sẵn
 *   node scripts/demo.mjs --port 5000
 *
 * Chỉ phục vụ file nằm trong dist/ để không lộ file ngoài dự án.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const port = Number(opt('--port', process.env.PORT ?? 4173))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const exists = async (p) => {
  try {
    return await stat(p)
  } catch {
    return null
  }
}

if (!flag('--no-build')) {
  console.log('▸ Đang build bản demo...')
  /* Gọi npm qua .cmd trên Windows, không bật shell để tránh
     cảnh báo chèn lệnh (DEP0190). */
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const build = spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit' })
  if (build.status !== 0) {
    console.error('\n✗ Build thất bại. Sửa lỗi ở trên rồi chạy lại.')
    process.exit(build.status ?? 1)
  }
}

if (!(await exists(dist))) {
  console.error(`\n✗ Không thấy thư mục ${dist}. Hãy bỏ cờ --no-build.`)
  process.exit(1)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.endsWith('/')) pathname += 'index.html'

    /* Chặn truy cập ra ngoài dist/ (path traversal). */
    const target = normalize(join(dist, pathname))
    if (!target.startsWith(dist + sep) && target !== dist) {
      res.writeHead(403).end('403 - Truy cập bị từ chối')
      return
    }

    let file = target
    if (!(await exists(file))?.isFile?.()) {
      /* Với đường dẫn không có đuôi file, thử lại kèm .html
         để /admin.html và các route tĩnh hoạt động. */
      if (!extname(file)) {
        const asHtml = `${file}.html`
        if ((await exists(asHtml))?.isFile?.()) file = asHtml
      }
    }

    const info = await exists(file)
    if (!info?.isFile?.()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h1>404</h1><p>Không tìm thấy trang. <a href="/">Về trang chủ</a></p>')
      return
    }

    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`500 - ${err.message}`)
  }
})

server.listen(port, () => {
  console.log(`
  CBM FOOD - bản demo đang chạy

    Cửa hàng   http://localhost:${port}/
    Quản trị   http://localhost:${port}/admin.html

    Tài khoản admin   admin@cbmfood.vn / admin123
    Khách            tự đăng ký, mật khẩu từ 6 ký tự

  Nhấn Ctrl+C để tắt.
`)
})
