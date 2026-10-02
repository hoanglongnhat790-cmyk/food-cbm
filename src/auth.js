const USER_KEY = 'cbmfood.users'
const SESSION_KEY = 'cbmfood.session'

const SEED_ADMIN = {
  id: 'U-admin',
  name: 'Quản trị viên',
  email: 'admin@cbmfood.vn',
  phone: '0900000001',
  role: 'admin',
  password: 'admin123',
}

const SESSION_TTL = 1000 * 60 * 60 * 12

const hasSubtleCrypto = () =>
  typeof globalThis.crypto?.subtle?.importKey === 'function' && typeof TextEncoder === 'function'

const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

const encode = (value) => new TextEncoder().encode(value)

export const hashPassword = async (password, salt) => {
  if (!hasSubtleCrypto()) throw new Error('Trình duyệt không hỗ trợ mã hoá, hãy mở bằng localhost hoặc HTTPS')
  const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encode(salt), iterations: 120000, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)))

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const normalEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

const validPhone = (value) => {
  if (value === '' || value === undefined || value === null) return true
  return /^\d{9,11}$/.test(String(value).trim())
}

let users = read(USER_KEY, [])

const seedAdminIfMissing = async () => {
  const admin = users.find((u) => u.role === 'admin')

  /* Trước đây chỉ cần "đã có admin" là bỏ qua. Nhưng dữ liệu lưu từ
     bản cũ có thể hỏng (salt và hash không khớp), khiến admin không
     đăng nhập được mà không có cách nào khôi phục ngoài việc xoá dữ liệu
     trình duyệt. Nay kiểm tra mật khẩu thật, hỏng thì tạo lại. */
  if (admin?.salt && admin?.hash) {
    try {
      const check = await hashPassword(SEED_ADMIN.password, admin.salt)
      if (check === admin.hash) return
    } catch {
      /* Không kiểm tra được thì cứ tạo lại cho chắc. */
    }
  }

  /* Salt phải là CÙNG một giá trị dùng để hash và để lưu.
     Trước đây hash dùng salt cố định còn lưu salt ngẫu nhiên nên
     mật khẩu admin không bao giờ khớp khi đăng nhập lại. */
  const salt = randomSalt()
  const fresh = {
    id: SEED_ADMIN.id,
    name: SEED_ADMIN.name,
    email: SEED_ADMIN.email,
    phone: SEED_ADMIN.phone,
    role: 'admin',
    salt,
    hash: await hashPassword(SEED_ADMIN.password, salt),
  }
  /* Thay đúng một admin hỏng, giữ nguyên các tài khoản khách đã đăng ký. */
  const index = users.findIndex((u) => u.role === 'admin')
  users = index === -1 ? [fresh, ...users] : users.map((u, i) => (i === index ? fresh : u))
  write(USER_KEY, users)
}

let ready = seedAdminIfMissing()

export const init = () => ready

const persist = () => write(USER_KEY, users)

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
})

export const getUser = () => {
  const session = read(SESSION_KEY, null)
  if (!session?.userId || !session?.expiresAt) return null
  if (session.expiresAt <= Date.now()) {
    write(SESSION_KEY, null)
    return null
  }
  const found = users.find((u) => u.id === session.userId)
  return found ? publicUser(found) : null
}

export const canAccessAdmin = () => getUser()?.role === 'admin'

export const ADMIN_URL = '/admin.html'

/**
 * Sau khi đăng nhập thì đưa người dùng đi đâu.
 * Tài khoản quản trị vào thẳng trang admin, khách thì ở lại trang bán hàng
 * (null = không chuyển trang).
 */
export const landingFor = (user) => (user?.role === 'admin' ? ADMIN_URL : null)

export const register = async ({ name, email, phone = '', password } = {}) => {
  const fullName = typeof name === 'string' ? name.trim() : ''
  const mail = normalEmail(email)
  if (fullName.length < 2) return { error: 'Họ tên quá ngắn' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: 'Email không hợp lệ' }
  if (!validPhone(phone)) return { error: 'Số điện thoại sai định dạng' }
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Mật khẩu phải có ít nhất 6 ký tự' }
  }
  if (users.some((u) => u.email === mail)) return { error: 'Email đã được đăng ký' }

  const salt = randomSalt()
  const hash = await hashPassword(password, salt)
  const user = {
    id: `U-${Date.now()}-${salt.slice(0, 6)}`,
    name: fullName,
    email: mail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    /* Không nhận `role` từ phía gọi: nếu nhận, bất kỳ ai tự POST role:'admin'
       cũng tự phong mình làm quản trị viên. */
    role: 'customer',
    salt,
    hash,
  }
  users = [user, ...users]
  persist()
  return { user: publicUser(user) }
}

export const login = async ({ email, password } = {}) => {
  const mail = normalEmail(email)
  if (!mail || !password) return { error: 'Thiếu email hoặc mật khẩu' }
  const found = users.find((u) => u.email === mail)
  if (!found) return { error: 'Email chưa được đăng ký' }
  const hash = await hashPassword(password, found.salt)
  if (hash !== found.hash) return { error: 'Mật khẩu không đúng' }
  write(SESSION_KEY, { userId: found.id, expiresAt: Date.now() + SESSION_TTL })
  return { user: publicUser(found) }
}

export const logout = () => write(SESSION_KEY, null)

export const updateProfile = async (patch = {}) => {
  const current = getUser()
  if (!current) return { error: 'Chưa đăng nhập' }
  const index = users.findIndex((u) => u.id === current.id)
  if (index === -1) return { error: 'Không tìm thấy tài khoản' }
  const next = { ...users[index] }
  if (patch.name !== undefined) {
    const name = typeof patch.name === 'string' ? patch.name.trim() : ''
    if (name.length < 2) return { error: 'Họ tên quá ngắn' }
    next.name = name
  }
  if (patch.phone !== undefined) {
    if (!validPhone(patch.phone)) return { error: 'Số điện thoại sai định dạng' }
    next.phone = typeof patch.phone === 'string' ? patch.phone.trim() : ''
  }
  users = users.map((u, i) => (i === index ? next : u))
  persist()
  return { user: publicUser(next) }
}

export const listUsers = () => users.map(publicUser)

export const resetUsers = async () => {
  users = []
  write(USER_KEY, users)
  write(SESSION_KEY, null)
  await seedAdminIfMissing()
}