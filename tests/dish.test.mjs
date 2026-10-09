import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshSeed, foodsRaw } from './helpers.mjs'

const { store } = await freshSeed()

test('seed tu foods.json cua nhom', () => {
  const list = store.listDishes()
  assert.equal(list.length, foodsRaw.dishes.length)
  assert.equal(store.CATEGORIES.length, foodsRaw.categories.length)
})

test('moi mon co id, code va ten hop le', () => {
  for (const dish of store.listDishes()) {
    assert.ok(dish.id, 'thieu id')
    assert.ok(dish.code.startsWith('MH'), `code sai: ${dish.code}`)
    assert.ok(dish.name.length > 0, 'thieu ten')
    assert.ok(Number.isInteger(dish.price), 'gia khong phai so nguyen')
  }
})

test('code la duy nhat', () => {
  const codes = store.listDishes().map((d) => d.code)
  assert.equal(new Set(codes).size, codes.length)
})

test('moi mon thuoc danh muc co trong du lieu', () => {
  const valid = new Set(store.CATEGORIES.map((c) => c.id))
  for (const dish of store.listDishes()) {
    assert.ok(valid.has(dish.category), `danh muc la: ${dish.category}`)
  }
})

test('mon khong co gia am hoac gia khong hop le', () => {
  for (const dish of store.listDishes()) {
    assert.ok(dish.price >= 0, `gia am: ${dish.name}`)
    assert.ok(Number.isInteger(dish.price), `gia la so thuc: ${dish.name}`)
  }
})

test('mon ngung ban khong xuat hien trong listActiveDishes', () => {
  const target = store.listDishes()[0]
  store.setDishStatus(target.code, 'unavailable')
  const activeCodes = store.listActiveDishes().map((d) => d.code)
  assert.ok(!activeCodes.includes(target.code), 'mon da ngung van con active')
  store.setDishStatus(target.code, 'available')
  assert.ok(store.listActiveDishes().map((d) => d.code).includes(target.code))
})

test('an gia duoc normalize ve chuoi rong', () => {
  assert.equal(store.normalizeImage('https://example.com/a.jpg'), 'https://example.com/a.jpg')
  assert.equal(store.normalizeImage('/img/a.jpg'), '/img/a.jpg')
  assert.equal(store.normalizeImage('http://example.com/a.jpg'), 'http://example.com/a.jpg')
  assert.equal(store.normalizeImage('javascript:alert(1)'), '')
  assert.equal(store.normalizeImage('data:text/html,<script>'), '')
  assert.equal(store.normalizeImage('//evil.com/a.jpg'), '')
  assert.equal(store.normalizeImage(''), '')
})

test('promotions lay tu foods.json', () => {
  const promos = store.promotions()
  assert.equal(promos.length, (foodsRaw.promotions ?? []).length)
})