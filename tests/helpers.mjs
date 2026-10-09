import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

export const foodsRaw = JSON.parse(readFileSync(resolve(root, 'src/data/foods.json'), 'utf8'))

class MemoryStorage {
  constructor() {
    this.map = new Map()
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null
  }

  setItem(key, value) {
    this.map.set(key, String(value))
  }

  removeItem(key) {
    this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }

  key(i) {
    return [...this.map.keys()][i] ?? null
  }

  get length() {
    return this.map.size
  }
}

export const STORAGE = new MemoryStorage()
globalThis.localStorage = STORAGE
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto

/**
 * store.js chỉ được nạp MỘT lần cho cả file test.
 * cart.js import './store.js' không có query nên nếu store bị cache-bust
 * theo query, cart sẽ trỏ sang instance store khác và luôn trả 'not-found'.
 * Vì vậy chỉ cart.js được cache-bust, còn store dùng chung instance này.
 */
export const store = await import('../src/store.js')

let round = 0

export const freshModules = async () => {
  STORAGE.clear()
  store.resetDishes()
  round += 1
  const cart = await import(`../src/cart.js?r=${round}`)
  cart.clear()
  return { store, cart }
}

export const freshSeed = async () => {
  STORAGE.clear()
  store.resetDishes()
  return { store }
}