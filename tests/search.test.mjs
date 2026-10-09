import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripDiacritics, normalizeQuery, matchesQuery, filterDishes } from '../src/search.js'

const categories = [
  { id: 'pho-bun', name: 'Phở & Bún' },
  { id: 'com', name: 'Cơm' },
  { id: 'nuot', name: 'Nước' },
]

const dishes = [
  {
    code: 'MH001',
    name: 'Phở Bò Tái',
    description: 'Phở bò tái chính vị Hà Nội',
    category: 'pho-bun',
    tags: ['Món chính'],
  },
  {
    code: 'MH002',
    name: 'Bún Chả Hà Nội',
    description: 'Bún chả truyền thống',
    category: 'pho-bun',
    tags: ['Đặc sản'],
  },
  {
    code: 'MH003',
    name: 'Cơm Tấm Sườn',
    description: 'Cơm tấm ăn kèm sườn nướng',
    category: 'com',
    tags: ['Món chính'],
  },
  {
    code: 'MH004',
    name: 'Trà Đá',
    description: 'Trà đá mát lạnh',
    category: 'nuot',
    tags: ['Giải khát'],
  },
]

test('bo dau tieng Viet', () => {
  assert.equal(stripDiacritics('Phở Bò'), 'pho bo')
  assert.equal(stripDiacritics('Bún Chả'), 'bun cha')
  assert.equal(stripDiacritics('Đặc Sản'), 'dac san')
  assert.equal(stripDiacritics('  Cà Phê  '), 'ca phe')
  assert.equal(stripDiacritics(null), '')
  assert.equal(stripDiacritics(undefined), '')
})

test('chuan hoa tu khoa gon khoang trang', () => {
  assert.equal(normalizeQuery('  Pho   Bo  '), 'pho bo')
  assert.equal(normalizeQuery(''), '')
})

test('tim theo ten co dau', () => {
  const hits = filterDishes(dishes, { query: 'Phở Bò' }, categories)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].name, 'Phở Bò Tái')
})

test('tim khi go khong dau van ra', () => {
  const hits = filterDishes(dishes, { query: 'pho bo' }, categories)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].code, 'MH001')
})

test('tim nhieu tu khoa theo thu tu bat ky', () => {
  assert.equal(filterDishes(dishes, { query: 'bo pho' }, categories).length, 1)
  assert.equal(filterDishes(dishes, { query: 'com tam' }, categories).length, 1)
})

test('tu khoa khong ton tai tra ve rong', () => {
  assert.equal(filterDishes(dishes, { query: 'pizza' }, categories).length, 0)
  assert.equal(filterDishes(dishes, { query: 'xyzzy' }, categories).length, 0)
})

test('tim theo mo ta', () => {
  const hits = filterDishes(dishes, { query: 'sườn nướng' }, categories)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].code, 'MH003')
})

test('tim theo the loai', () => {
  const hits = filterDishes(dishes, { query: 'đặc sản' }, categories)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].code, 'MH002')
})

test('tim theo ten danh muc', () => {
  const hits = filterDishes(dishes, { query: 'nuoc' }, categories)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].code, 'MH004')
})

test('tu khoa rong thi tra ve tat ca', () => {
  assert.equal(filterDishes(dishes, { query: '' }, categories).length, 4)
  assert.equal(filterDishes(dishes, {}, categories).length, 4)
  assert.equal(filterDishes(dishes, { query: '   ' }, categories).length, 4)
})

test('loc theo danh muc', () => {
  const hits = filterDishes(dishes, { category: 'pho-bun' }, categories)
  assert.equal(hits.length, 2)
  assert.ok(hits.every((d) => d.category === 'pho-bun'))
})

test('ket hop danh muc voi tu khoa', () => {
  const hits = filterDishes(dishes, { category: 'pho-bun', query: 'bun' }, categories)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].code, 'MH002')
})

test('ket hop danh muc voi tu khoa khong khop', () => {
  const hits = filterDishes(dishes, { category: 'nuot', query: 'bun' }, categories)
  assert.equal(hits.length, 0, 'khong duoc tra mon o danh muc khac')
})

test('mot tu khoa co the ra nhieu danh muc', () => {
  const hits = filterDishes(dishes, { query: 'chính' }, categories)
  const cats = new Set(hits.map((d) => d.category))
  assert.ok(hits.length >= 2, 'phai ra it nhat 2 mon')
  assert.equal(cats.size, 2, 'phai tra ve mon tu nhieu danh muc khac nhau')
})

test('mot chu cai vô nghia thi khop het', () => {
  /* "a" xuat hien o hau het ten mon, dung la tim theo ky tu don le khong dung. */
  assert.ok(filterDishes(dishes, { query: 'a' }, categories).length >= 1)
})

test('matchesQuery bo qua khi khong co tu khoa', () => {
  assert.equal(matchesQuery(dishes[0], '', categories), true)
  assert.equal(matchesQuery(dishes[0], '  ', categories), true)
})

test('matchesQuery khong loi khi thieu truong', () => {
  const bare = { name: 'Phở Bò', category: 'pho-bun' }
  assert.equal(matchesQuery(bare, 'pho', categories), true)
})

test('khong loi khi danh muc khong ton tai', () => {
  const orphan = { name: 'Món lạ', category: 'khong-co', description: '', tags: [] }
  assert.equal(matchesQuery(orphan, 'mon', categories), true)
  assert.equal(matchesQuery(orphan, 'laz', categories), false)
})

test('loc khong sua doi mang cu', () => {
  const before = dishes.map((d) => d.code)
  filterDishes(dishes, { query: 'pho' }, categories)
  assert.deepEqual(
    dishes.map((d) => d.code),
    before,
    'khong duoc sap xep lai mang goc',
  )
})