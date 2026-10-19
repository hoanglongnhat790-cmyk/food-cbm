import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshModules } from './helpers.mjs'

const added = (result, msg) => {
  assert.ok(result && !result.error, msg ?? `them mon that bai: ${result?.error}`)
  return result
}

test('them mon moi thanh cong', async () => {
  const { store } = await freshModules()
  const before = store.listDishes().length
  const dish = added(
    store.createDish({
      name: 'Mì Quảng Tôm',
      description: 'Mì Quảng đặc sản Đà Nẵng',
      category: store.CATEGORIES[0].id,
      price: 75000,
      status: 'available',
      image: 'https://example.com/mi-quang.jpg',
    }),
  )
  assert.equal(dish.name, 'Mì Quảng Tôm')
  assert.equal(dish.price, 75000)
  assert.equal(dish.image, 'https://example.com/mi-quang.jpg')
  assert.equal(store.listDishes().length, before + 1)
})

test('them mon khong co ten bi tu choi', async () => {
  const { store } = await freshModules()
  const before = store.listDishes().length
  const result = store.createDish({ name: '   ', price: 1000 })
  assert.ok(result.error, 'phai bao loi')
  assert.equal(store.listDishes().length, before)
})

test('gia am bi tu choi thay vi tu chuan thanh 0', async () => {
  const { store } = await freshModules()
  const result = store.createDish({ name: 'Mon gia am', price: -5000 })
  assert.ok(result.error, 'gia am phai bi tu choi')
  assert.equal(store.findDish('Mon gia am'), null)
})

test('gia khong phai so bi tu choi', async () => {
  const { store } = await freshModules()
  assert.ok(store.createDish({ name: 'Mon gia rac', price: 'abc' }).error)
})

test('mon moi co code duy nhat khong trung mon cu', async () => {
  const { store } = await freshModules()
  const a = added(store.createDish({ name: 'Mon A', price: 10000 }))
  const b = added(store.createDish({ name: 'Mon B', price: 10000 }))
  assert.notEqual(a.code, b.code)
  assert.match(a.code, /^MH\d{3}$/, `code khong hop le: ${a.code}`)
  const codes = store.listDishes().map((d) => d.code)
  assert.equal(new Set(codes).size, codes.length)
})

test('sua mon giu nguyen ma va so luot ban', async () => {
  const { store } = await freshModules()
  const original = added(store.createDish({ name: 'Mon Goc', price: 30000 }))
  const updated = added(store.updateDish(original.code, { name: 'Mon Da Sua', price: 45000 }))
  assert.equal(updated.name, 'Mon Da Sua')
  assert.equal(updated.price, 45000)
  assert.equal(updated.code, original.code, 'ma khong duoc doi')
  assert.equal(updated.sold, original.sold, 'so luot ban khong duoc doi')
})

test('sua mon khong ton tai bao loi', async () => {
  const { store } = await freshModules()
  assert.ok(store.updateDish('MH999', { name: 'Khong ton tai' }).error)
})

test('sua gia am bi tu choi', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Gia Am', price: 10000 }))
  assert.ok(store.updateDish(dish.code, { price: -1 }).error)
  assert.equal(store.findDish(dish.code).price, 10000, 'gia bi doi')
})

test('sua danh muc sai bi tu choi', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Danh Muc', price: 10000 }))
  assert.ok(store.updateDish(dish.code, { category: 'khong-ton-tai' }).error)
})

test('xoa mon that bai', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Can Xoa', price: 20000 }))
  const before = store.listDishes().length
  assert.equal(store.deleteDish(dish.code), true)
  assert.equal(store.listDishes().length, before - 1)
  assert.equal(store.findDish(dish.code), null)
})

test('xoa mon khong ton tai tra false', async () => {
  const { store } = await freshModules()
  assert.equal(store.deleteDish('KHONG-CO'), false)
})

test('dat trang thai hop le va tu choi trang thai sai', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Trang Thai', price: 10000 }))
  assert.equal(added(store.setDishStatus(dish.code, 'runningOut')).status, 'runningOut')
  assert.equal(added(store.setDishStatus(dish.code, 'unavailable')).status, 'unavailable')
  assert.equal(store.setDishStatus(dish.code, 'khong-hop-le'), null)
})

test('doi trang thai khong lam mat mon', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Giu Nguyen', price: 10000 }))
  const before = store.listDishes().length
  store.setDishStatus(dish.code, 'unavailable')
  assert.equal(store.listDishes().length, before)
  assert.equal(store.findDish(dish.code).status, 'unavailable')
})

test('anh khong hop le bi loai bo chu khong lam hong mon', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Anh Xau', price: 10000, image: 'javascript:x' }))
  assert.equal(dish.image, '')
})

test('khoi phuc du lieu mau xoa moi them', async () => {
  const { store } = await freshModules()
  const seedCount = store.listDishes().length
  store.createDish({ name: 'Mon Tam Thoi', price: 10000 })
  store.deleteDish(store.listDishes()[0].code)
  store.resetDishes()
  assert.equal(store.listDishes().length, seedCount)
})

test('dung chung ma ma khong ghi de mon khac', async () => {
  const { store } = await freshModules()
  const a = added(store.createDish({ name: 'Mon A', price: 10000 }))
  const b = added(store.createDish({ name: 'Mon B', price: 20000 }))
  store.updateDish(a.code, { code: b.code, name: 'Mon A Sua' })
  assert.equal(store.findDish(a.code).name, 'Mon A Sua', 'mon A bi doi ten')
  assert.equal(store.findDish(b.code).name, 'Mon B', 'mon B bi ghi de')
})

test('gui originalPrice null thi xoa duoc gia goc', async () => {
  /* Form sửa món gửi null khi ô "Giá gốc" bị xoá trống. Trước đây gửi
     undefined nên updateDish giữ luôn giá cũ và không bao giờ xoá được. */
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Gia Goc', price: 40000, originalPrice: 90000 }))
  assert.equal(dish.originalPrice, 90000)
  const cleared = added(store.updateDish(dish.code, { originalPrice: null }))
  assert.equal(cleared.originalPrice, null, 'gia goc phai bi xoa')
})

test('khong gui originalPrice thi giu nguyen gia goc', async () => {
  const { store } = await freshModules()
  const dish = added(store.createDish({ name: 'Mon Giu Gia Goc', price: 40000, originalPrice: 90000 }))
  /* setDishStatus chỉ gửi { status }, cập nhật một phần không được xoá
     nhầm giá gốc. */
  added(store.setDishStatus(dish.code, 'runningOut'))
  assert.equal(store.findDish(dish.code).originalPrice, 90000, 'gia goc bi mat o cap nhat mot phan')
})

test('mon seed khong co hai the giong nhau', async () => {
  const { store } = await freshModules()
  for (const dish of store.listDishes()) {
    assert.equal(
      new Set(dish.tags).size,
      dish.tags.length,
      `mon ${dish.code} (${dish.name}) lap lai the: ${dish.tags.join(', ')}`,
    )
  }
})