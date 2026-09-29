import { SEED_ADMIN } from './seed.js'

const USERS_KEY = 'cbmfood.auth.users.v1'
const SESSION_KEY = 'cbmfood.auth.session.v1'

const PBKDF2_ITERATIONS = 150_000
const PBKDF2_BITS = 256
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

const listeners = new Set()

export class AuthError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'AuthError'
    this.field = field
  }
}

const hasSubtleCrypto = () =>
  typeof crypto !== 'undefined' && Boolean(crypto.subtle)

const encodeBase64 = (bytes) => {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const decodeBase64 = (value) => {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const randomId = () => crypto.randomUUID()

const randomSalt = () => encodeBase64(crypto.getRandomValues(new Uint8Array(16)))

const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* localStorage bị chặn - phiên chỉ tồn tại trong bộ nhớ */
  }
}

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase()

const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value) && value.length <= 120

const isPhone = (value) => value === '' || /^0\d{9,10}$/.test(value)

const state = {
  users: read(USERS_KEY, []),
  session: read(SESSION_KEY, null),
  ready: false,
}

function publish() {
  write(USERS_KEY, state.users)
  listeners.forEach((listener) => listener(currentUser()))
}

const sanitizeUser = (user) => {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    createdAt: user.createdAt,
  }
}

function currentUser() {
  const session = state.session
  if (!session?.userId || !session.expiresAt) return null
  if (session.expiresAt <= Date.now()) {
    state.session = null
    write(SESSION_KEY, null)
    return null
  }
  return sanitizeUser(state.users.find((user) => user.id === session.userId) ?? null)
}

export const getUser = () => currentUser()
export const isLoggedIn = () => Boolean(currentUser())
export const isAdmin = () => currentUser()?.role === 'admin'

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function hashPassword(password, salt) {
  if (!hasSubtleCrypto()) {
    throw new AuthError(
      'Trình duyệt không hỗ trợ bảo mật (cần HTTPS hoặc localhost). Hãy chạy bằng "npm run dev".',
    )
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: decodeBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    PBKDF2_BITS,
  )

  return encodeBase64(new Uint8Array(bits))
}

function startSession(user) {
  state.session = {
    userId: user.id,
    token: randomId(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  }
  write(SESSION_KEY, state.session)
  publish()
  return sanitizeUser(user)
}

export async function init() {
  if (state.ready) return

  if (!hasSubtleCrypto()) {
    state.ready = true
    publish()
    return
  }

  if (!state.users.some((user) => user.role === 'admin')) {
    const salt = randomSalt()
    state.users.push({
      id: randomId(),
      name: SEED_ADMIN.name,
      email: SEED_ADMIN.email,
      phone: SEED_ADMIN.phone,
      role: 'admin',
      salt,
      hash: await hashPassword(SEED_ADMIN.password, salt),
      createdAt: new Date().toISOString(),
    })
    write(USERS_KEY, state.users)
  }

  state.ready = true
  publish()
}

export async function register({ name, email, password, confirm, phone = '' }) {
  await init()

  const cleanName = String(name ?? '').trim()
  const cleanEmail = normalizeEmail(email)
  const cleanPhone = String(phone ?? '').trim()
  const pass = String(password ?? '')

  if (cleanName.length < 2) {
    throw new AuthError('Họ tên phải có ít nhất 2 ký tự.', 'name')
  }
  if (cleanName.length > 60) {
    throw new AuthError('Họ tên quá dài (tối đa 60 ký tự).', 'name')
  }
  if (!isEmail(cleanEmail)) {
    throw new AuthError('Email không hợp lệ.', 'email')
  }
  if (pass.length < 6) {
    throw new AuthError('Mật khẩu phải có ít nhất 6 ký tự.', 'password')
  }
  if (pass.length > 128) {
    throw new AuthError('Mật khẩu quá dài (tối đa 128 ký tự).', 'password')
  }
  if (pass !== String(confirm ?? '')) {
    throw new AuthError('Xác nhận mật khẩu không khớp.', 'confirm')
  }
  if (!isPhone(cleanPhone)) {
    throw new AuthError('Số điện thoại phải gồm 10-11 chữ số, bắt đầu bằng 0.', 'phone')
  }
  if (state.users.some((user) => user.email === cleanEmail)) {
    throw new AuthError('Email này đã được đăng ký.', 'email')
  }

  const salt = randomSalt()
  const user = {
    id: randomId(),
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    role: 'customer',
    salt,
    hash: await hashPassword(pass, salt),
    createdAt: new Date().toISOString(),
  }

  state.users = [...state.users, user]
  write(USERS_KEY, state.users)
  return startSession(user)
}

export async function login({ email, password }) {
  await init()

  const cleanEmail = normalizeEmail(email)
  const pass = String(password ?? '')

  if (!cleanEmail) throw new AuthError('Vui lòng nhập email.', 'email')
  if (!pass) throw new AuthError('Vui lòng nhập mật khẩu.', 'password')

  const user = state.users.find((item) => item.email === cleanEmail)
  const hash = user ? await hashPassword(pass, user.salt) : ''

  if (!user || hash !== user.hash) {
    throw new AuthError('Email hoặc mật khẩu không đúng.', 'email')
  }

  return startSession(user)
}

export function logout() {
  state.session = null
  write(SESSION_KEY, null)
  publish()
}

export function updateProfile({ name, phone }) {
  const user = currentUser()
  if (!user) throw new AuthError('Bạn chưa đăng nhập.')

  const cleanName = String(name ?? '').trim()
  const cleanPhone = String(phone ?? '').trim()

  if (cleanName.length < 2) {
    throw new AuthError('Họ tên phải có ít nhất 2 ký tự.', 'name')
  }
  if (!isPhone(cleanPhone)) {
    throw new AuthError('Số điện thoại phải gồm 10-11 chữ số, bắt đầu bằng 0.', 'phone')
  }

  state.users = state.users.map((item) =>
    item.id === user.id ? { ...item, name: cleanName, phone: cleanPhone } : item,
  )
  write(USERS_KEY, state.users)
  publish()
  return currentUser()
}

export function listUsers() {
  return state.users.map(sanitizeUser)
}

export function canAccessAdmin() {
  return isAdmin()
}
