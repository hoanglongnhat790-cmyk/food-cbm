import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshSeed } from './helpers.mjs'
import { suggest } from '../src/suggest.js'

const codes = (reply) => (reply.dishes ?? []).map((d) => d.code)

test('câu hỏi rỗng vẫn trả lời được, không văng exception', async () => {
  const { store } = await freshSeed()
  const reply = suggest('', store)
  assert.equal(typeof reply.text, 'string')
  assert.ok(reply.text.length > 0)
  assert.equal(reply.dishes, undefined)
})

test('khong biet an gi -> goi y 1 den 3 mon co day du thong tin', async () => {
  const { store } = await freshSeed()
  const reply = suggest('hôm nay mình không biết ăn gì', store)
  const dishes = reply.dishes ?? []
  assert.ok(dishes.length >= 1 && dishes.length <= 3, `goi ${dishes.length} mon`)
  for (const dish of dishes) {
    assert.ok(dish.code && dish.name && Number(dish.price) > 0, 'mon thieu thong tin')
    assert.ok(store.isPurchasable(dish), 'goi mon khong ban duoc')
  }
})

test('loc theo danh muc: "do uong" chi ra mon do uong', async () => {
  const { store } = await freshSeed()
  const reply = suggest('gợi ý đồ uống giải khát', store)
  assert.ok((reply.dishes ?? []).length > 0, 'khong goi y duoc mon nao')
  for (const dish of reply.dishes) assert.equal(dish.category, 'do-uong')
})

test('loc theo danh muc: "an vat" chi ra mon an vat', async () => {
  const { store } = await freshSeed()
  const reply = suggest('món ăn vặt nào ngon?', store)
  assert.ok((reply.dishes ?? []).length > 0)
  for (const dish of reply.dishes) assert.equal(dish.category, 'an-vat')
})

test('loc theo gia: "duoi 50k" khong dua mon lon hon 50.000d', async () => {
  const { store } = await freshSeed()
  const reply = suggest('gợi ý món dưới 50k', store)
  assert.ok((reply.dishes ?? []).length > 0)
  for (const dish of reply.dishes) assert.ok(dish.price <= 50000, `${dish.name} gia ${dish.price}`)
})

test('ket hop danh muc + gia: "phe bo duoi 60k" va thuoc nhom pho/bun', async () => {
  const { store } = await freshSeed()
  const reply = suggest('gợi ý món phở bò dưới 60k', store)
  const dishes = reply.dishes ?? []
  assert.ok(dishes.length > 0)
  for (const dish of dishes) {
    assert.equal(dish.category, 'pho-bun', `${dish.name} sai danh muc`)
    assert.ok(dish.price <= 60000, `${dish.name} gia ${dish.price}`)
  }
})

test('goi y mon cay khong rong', async () => {
  const { store } = await freshSeed()
  const reply = suggest('món gì cay cay?', store)
  assert.ok((reply.dishes ?? []).length > 0, 'khong tim thay mon cay nao')
})

test('yeu cau vong quay tra ve co hieu vong quay', async () => {
  const { store } = await freshSeed()
  for (const text of ['mở vòng quay đi', 'quay số ngẫu nhiên giúp mình', 'vòng quay may mắn']) {
    const reply = suggest(text, store)
    assert.equal(reply.wheel, true, `"${text}" khong mo vong quay`)
  }
})

test('chao hoi va loi on tra loi co van de, khong can mon', async () => {
  const { store } = await freshSeed()
  for (const text of ['xin chào', 'cảm ơn bạn nhiều', 'bạn là ai vậy', 'hướng dẫn cách dùng']) {
    const reply = suggest(text, store)
    assert.ok(reply.text.length > 0, `"${text}" khong co cau tra loi`)
    assert.equal(reply.dishes, undefined, `"${text}" khong nen goi mon`)
  }
})

test('liet ke thuc don qua tat ca ten danh muc', async () => {
  const { store } = await freshSeed()
  const reply = suggest('thực đơn của quán có gì?', store)
  for (const cat of store.CATEGORIES) {
    /* Tên danh mục được escape HTML nên "Phở & Bún" thành "Phở &amp; Bún". */
    const shown = cat.name.replace(/&/g, '&amp;')
    assert.ok(reply.text.includes(shown), `thieu danh muc ${cat.name}`)
  }
})

test('the mon trong cau tra loi co nut data-add dung ma mon', async () => {
  const { store } = await freshSeed()
  const reply = suggest('gợi ý đồ uống', store)
  for (const dish of reply.dishes) {
    assert.ok(reply.text.includes(`data-add="${dish.code}"`), `thieu nut them ${dish.code}`)
    assert.ok(reply.text.includes(dish.name), 'thieu ten mon trong the')
  }
})

test('khong goi y mon tam ngung hay het hang', async () => {
  const { store } = await freshSeed()
  const drinks = store.listActiveDishes().filter((d) => d.category === 'do-uong')
  store.setDishStatus(drinks[0].code, 'unavailable')
  const reply = suggest('gợi ý đồ uống', store)
  assert.ok(!codes(reply).includes(drinks[0].code), 'van goi mon tam ngung')
  for (const dish of reply.dishes) assert.ok(store.isPurchasable(dish))
})

test('ten mon dac biet duoc escape HTML trong cau tra loi', async () => {
  const { store } = await freshSeed()
  const created = store.createDish({ name: 'Món <b>thí nghiệm</b>', price: 10000, category: 'com' })
  const reply = suggest('thí nghiệm', store)
  assert.ok(codes(reply).includes(created.code), 'khong goi y duoc mon vua them')
  assert.ok(!reply.text.includes('<b>thí nghiệm</b>'), 'ten mon chua duoc escape')
  assert.ok(reply.text.includes('&lt;b&gt;thí nghiệm&lt;/b&gt;'), 'thieu the escape cua ten mon')
})

test('tim theo ten mon khong dau van khop ( "phe bo" -> Phe Bo )', async () => {
  const { store } = await freshSeed()
  const reply = suggest('phe bo', store)
  assert.ok((reply.dishes ?? []).length > 0, 'khong tim thay mon khong dau')
  assert.ok(
    reply.dishes.some((d) => /phở bò/i.test(d.name)),
    'khong co mon pho bo nao trong goi y',
  )
})
