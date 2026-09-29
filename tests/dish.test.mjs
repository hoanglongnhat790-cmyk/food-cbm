import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { installGlobals } from './setup.mjs'

const storage = installGlobals()
const db = await import('../src/store.js')
const cart = await import('../src/cart.js')
const { CATEGORIES, DISH_STATUS, DISH_TAGS } = await import('../src/seed.js')

const reset = () => {
  db.resetData()
  cart.clear()
}

const SEED_COUNT = db.getDishes().length
const SEED_MAX_ID = db.getDishes().at(-1).id
const nextId = (offset = 1) => `MH-${String(Number(SEED_MAX_ID.slice(3)) + offset).padStart(3, '0')}`

const newDish = (overrides = {}) => ({
  name: 'Mì Quảng',
  category: 'Ăn vặt',
  price: 55000,
  description: 'Mì Quảng đặc sản Quảng Nam.',
  accent: 'ocean',
  emoji: '🍜',
  status: 'available',
  ...overrides,
})

describe('dish - thêm món', () => {
  beforeEach(reset)

  it('thêm món thành công', () => {
    const dish = db.createDish(newDish())

    assert.equal(dish.name, 'Mì Quảng')
    assert.equal(dish.price, 55000)
    assert.equal(dish.sold, 0, 'món mới bắt đầu lượt bán bằng 0')
    assert.ok(dish.id)
    assert.ok(dish.createdAt)
  })

  it('mã món tăng dần và không trùng', () => {
    const first = db.createDish(newDish())
    const second = db.createDish(newDish({ name: 'Bánh xèo' }))

    assert.notEqual(first.id, second.id)
    const ids = db.getDishes().map((dish) => dish.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it('món mới xuất hiện đầu danh sách', () => {
    const dish = db.createDish(newDish())
    assert.equal(db.getDishes()[0].id, dish.id)
  })

  it('loại bỏ khoảng trắng thừa trong tên', () => {
    const dish = db.createDish(newDish({ name: '   Mì Quảng   ' }))
    assert.equal(dish.name, 'Mì Quảng')
  })

  it('chuyển giá dạng chuỗi thành số', () => {
    const dish = db.createDish(newDish({ price: '72000' }))
    assert.equal(dish.price, 72000)
    assert.equal(typeof dish.price, 'number')
  })

  it('làm tròn giá về số nguyên', () => {
    const dish = db.createDish(newDish({ price: 55555.7 }))
    assert.equal(dish.price, 55556)
  })

  it('giá âm thành 0 thay vì âm', () => {
    const dish = db.createDish(newDish({ price: -1000 }))
    assert.equal(dish.price, 0)
  })

  it('giá không hợp lệ thành 0', () => {
    assert.equal(db.createDish(newDish({ price: 'abc' })).price, 0)
    assert.equal(db.createDish(newDish({ price: null })).price, 0)
  })

  it('trạng thái lạ thì mặc định đang bán', () => {
    const dish = db.createDish(newDish({ status: 'bi-lo' }))
    assert.equal(dish.status, 'available')
  })

  it('màu lạ thì dùng màu mặc định', () => {
    const dish = db.createDish(newDish({ accent: 'khong-ton-tai' }))
    assert.equal(dish.accent, 'orange')
  })

  it('danh mục rỗng thì lấy danh mục đầu tiên', () => {
    const dish = db.createDish(newDish({ category: '' }))
    assert.equal(dish.category, CATEGORIES[0])
  })

  it('không cho nhập tên rỗng', () => {
    const dish = db.createDish(newDish({ name: '   ' }))
    assert.equal(dish.name, '', 'tầng lưu trữ không tự chặn, UI chặn trước')
  })
})

describe('dish - sửa món', () => {
  beforeEach(reset)

  it('sửa được thông tin cơ bản', () => {
    const before = db.getDish('MH-001')
    db.updateDish('MH-001', { ...before, name: 'Phở bò cuối tuần', price: 75000 })

    const after = db.getDish('MH-001')
    assert.equal(after.name, 'Phở bò cuối tuần')
    assert.equal(after.price, 75000)
  })

  it('giữ nguyên lượt bán và ngày tạo khi sửa', () => {
    const before = db.getDish('MH-001')
    db.updateDish('MH-001', { ...before, name: 'Tên mới' })

    const after = db.getDish('MH-001')
    assert.equal(after.sold, before.sold, 'không được mất lượt bán')
    assert.equal(after.createdAt, before.createdAt, 'không được đổi ngày tạo')
  })

  it('giữ nguyên mã món khi sửa', () => {
    db.updateDish('MH-001', { ...db.getDish('MH-001'), name: 'Tên mới' })
    assert.equal(db.getDish('MH-001').id, 'MH-001')
  })

  it('tạm ngưng món qua trạng thái', () => {
    db.updateDish('MH-001', { ...db.getDish('MH-001'), status: 'unavailable' })
    assert.equal(db.getDish('MH-001').status, 'unavailable')
  })

  it('trả về null khi sửa món không tồn tại', () => {
    assert.equal(db.updateDish('MH-999', newDish()), null)
  })

  it('sửa trạng thái vẫn qua được kiểm tra dữ liệu', () => {
    const updated = db.updateDish('MH-001', {
      ...db.getDish('MH-001'),
      price: -50,
    })
    assert.equal(updated.price, 0)
  })

  it('form admin không gửi giá gốc thì giữ nguyên giá gốc cũ', () => {
    const before = db.getDish('MH-001')
    assert.ok(before.originalPrice > before.price, 'dữ liệu mẫu phải có giá gốc')

    const updated = db.updateDish('MH-001', {
      name: before.name,
      category: before.category,
      price: before.price,
      description: before.description,
      accent: before.accent,
      emoji: before.emoji,
      status: before.status,
    })

    assert.equal(updated.originalPrice, before.originalPrice, 'không được mất giá gốc')
  })

  it('giá bán tăng vượt giá gốc cũ thì bỏ luôn giá gốc', () => {
    const before = db.getDish('MH-001')
    const updated = db.updateDish('MH-001', {
      name: before.name,
      category: before.category,
      price: before.originalPrice + 5000,
      description: before.description,
      accent: before.accent,
      emoji: before.emoji,
      status: before.status,
    })

    assert.equal(updated.originalPrice, 0, 'không được hiện giá gốc thấp hơn giá bán')
  })

  it('giá gốc nhập vào luôn được nâng lên trên giá bán', () => {
    const before = db.getDish('MH-001')
    const updated = db.updateDish('MH-001', {
      ...before,
      originalPrice: 1000,
    })

    assert.ok(updated.originalPrice > updated.price)
  })
})

describe('dish - xoá món', () => {
  beforeEach(reset)

  it('xoá được món khỏi thực đơn', () => {
    assert.equal(db.removeDish('MH-001'), true)
    assert.equal(db.getDish('MH-001'), undefined)
    assert.equal(db.getDishes().length, SEED_COUNT - 1)
  })

  it('xoá món không tồn tại trả về false', () => {
    assert.equal(db.removeDish('MH-999'), false)
  })

  it('không xoá nhầm món khác', () => {
    db.removeDish('MH-001')
    assert.ok(db.getDish('MH-002'), 'món khác phải còn nguyên')
    assert.equal(db.getDishes().length, SEED_COUNT - 1)
  })

  it('lịch sử đơn hàng cũ vẫn giữ tên món đã xoá', () => {
    db.removeDish('MH-001')
    const order = db.getOrders().find((item) =>
      item.items.some((line) => line.name === 'Phở bò đặc biệt'),
    )
    assert.ok(order, 'phải còn đơn chứa món đã xoá')
  })

  it('mã món mới không bị tái sử dụng sau khi xoá', () => {
    db.removeDish(SEED_MAX_ID)
    const created = db.createDish(newDish())
    assert.equal(created.id, nextId(), 'không được cấp lại mã của món đã xoá')
  })

  it('xoá món cuối rồi thêm lại vẫn tăng đều', () => {
    db.removeDish(SEED_MAX_ID)
    db.removeDish(nextId(-1))
    const a = db.createDish(newDish())
    const b = db.createDish(newDish({ name: 'Bánh xèo' }))

    assert.equal(a.id, nextId())
    assert.equal(b.id, nextId(2))
  })

  it('mã không bị tái sử dụng sau khi tải lại trang', async () => {
    reset()
    db.createDish(newDish())
    const fresh = await import('../src/store.js?reload=seq')
    const created = fresh.createDish(newDish())

    assert.equal(created.id, nextId(2), 'bộ đếm phải được lưu xuống storage')
  })
})

describe('dish - ảnh hưởng tới giỏ hàng', () => {
  beforeEach(reset)

  it('xoá món khỏi thực đơn thì giỏ cũng bỏ theo', () => {
    cart.add('MH-001', 2)
    db.removeDish('MH-001')
    assert.equal(cart.detailed().length, 0)
  })

  it('tạm ngưng món thì không cho thêm mới vào giỏ', () => {
    cart.add('MH-001', 1)
    db.updateDish('MH-001', { ...db.getDish('MH-001'), status: 'unavailable' })

    assert.equal(cart.add('MH-001').ok, false)
    assert.equal(cart.setQty('MH-001', 5).ok, false)
    assert.equal(cart.totals().missingForCheckout, 1, 'UI phải cảnh báo khi chốt đơn')
  })

  it('mở lại bán thì cho thêm vào giỏ trở lại', () => {
    db.updateDish('MH-001', { ...db.getDish('MH-001'), status: 'unavailable' })
    db.updateDish('MH-001', { ...db.getDish('MH-001'), status: 'available' })

    assert.equal(cart.add('MH-001').ok, true)
  })
})

describe('dish - dữ liệu và bảo toàn', () => {
  it('thực đơn mẫu đầy đủ và hợp lệ', () => {
    reset()
    const dishes = db.getDishes()

    assert.equal(dishes.length, 16)
    dishes.forEach((dish) => {
      assert.ok(dish.id && dish.name, 'thiếu id hoặc tên')
      assert.ok(Number.isFinite(dish.price) && dish.price >= 0, `giá sai: ${dish.id}`)
      assert.ok(dish.sold >= 0, `lượt bán âm: ${dish.id}`)
      assert.ok(Object.keys(DISH_STATUS).includes(dish.status), `trạng thái lạ: ${dish.id}`)
      assert.ok(dish.rating >= 0 && dish.rating <= 5, `điểm sai: ${dish.id}`)
      assert.ok(dish.ratingCount > 0, `thiếu số đánh giá: ${dish.id}`)
      assert.ok(Array.isArray(dish.tags), `thiếu nhãn: ${dish.id}`)
      dish.tags.forEach((tag) => {
        assert.ok(Object.keys(DISH_TAGS).includes(tag), `nhãn lạ "${tag}" ở ${dish.id}`)
      })
      if (dish.originalPrice) {
        assert.ok(
          dish.originalPrice > dish.price,
          `giá gốc phải lớn hơn giá bán: ${dish.id}`,
        )
      }
    })
  })

  it('mỗi danh mục đều có món để hiển thị', () => {
    reset()
    const counts = db.getDishes().reduce((acc, dish) => {
      acc[dish.category] = (acc[dish.category] ?? 0) + 1
      return acc
    }, {})
    CATEGORIES.forEach((category) => {
      assert.ok(counts[category] >= 2, `danh mục "${category}" chỉ có ${counts[category] ?? 0} món`)
    })
  })

  it('món được lưu xuống localStorage', () => {
    reset()
    const dish = db.createDish(newDish())
    const raw = JSON.parse(storage.getItem('cbmfood.admin.dishes.v1'))
    assert.ok(raw.some((item) => item.id === dish.id))
  })

  it('khôi phục dữ liệu mẫu xoá món do admin thêm', () => {
    reset()
    db.createDish(newDish())
    assert.equal(db.getDishes().length, SEED_COUNT + 1)

    db.resetData()
    assert.equal(db.getDishes().length, SEED_COUNT)
  })

  it('danh mục trong seed khớp với món đang có', () => {
    reset()
    const used = new Set(db.getDishes().map((dish) => dish.category))
    CATEGORIES.forEach((category) => {
      assert.ok(used.has(category), `danh mục "${category}" không món nào dùng`)
    })
  })
})

describe('dish - nâng cấp kho lưu từ bản cũ', () => {
  const legacy = [
    {
      id: 'MH-001',
      name: 'Phở bò đặc biệt',
      category: 'Cơm & Bún',
      price: 65000,
      description: 'Nước dùng ninh xương 12 tiếng.',
      accent: 'orange',
      emoji: '🍜',
      status: 'available',
      sold: 320,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'MH-099',
      name: 'Bánh xèo của tôi',
      category: 'Ăn vặt',
      price: 20000,
      description: 'Món tự thêm trong admin.',
      status: 'available',
      sold: 0,
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ]

  it('bổ sung metadata hiển thị mà không thêm hay xoá món', async () => {
    storage.setItem('cbmfood.admin.dishes.v1', JSON.stringify(legacy))
    const fresh = await import('../src/store.js?reload=migrate')

    const dishes = fresh.getDishes()
    assert.equal(dishes.length, 2, 'không được tự thêm hoặc xoá món của người dùng')

    dishes.forEach((dish) => {
      assert.ok(Array.isArray(dish.tags), `thiếu nhãn: ${dish.id}`)
      assert.ok(dish.rating >= 0 && dish.rating <= 5, `thiếu điểm đánh giá: ${dish.id}`)
      assert.ok(Number.isInteger(dish.ratingCount), `thiếu số đánh giá: ${dish.id}`)
      assert.ok(dish.accent, `thiếu màu: ${dish.id}`)
      assert.ok(dish.emoji, `thiếu biểu tượng: ${dish.id}`)
      assert.ok(!dish.originalPrice || dish.originalPrice > dish.price, `giá gốc sai: ${dish.id}`)
    })
  })

  it('giữ nguyên phần admin đã chỉnh sửa', async () => {
    storage.setItem('cbmfood.admin.dishes.v1', JSON.stringify(legacy))
    const fresh = await import('../src/store.js?reload=migrate-keep')

    assert.equal(fresh.getDish('MH-099').name, 'Bánh xèo của tôi')
    assert.equal(fresh.getDish('MH-099').price, 20000)
    assert.equal(fresh.getDish('MH-001').price, 65000)
    assert.equal(fresh.getDish('MH-001').sold, 320)
  })

  it('ghi kho đã nâng cấp xuống localStorage', async () => {
    storage.setItem('cbmfood.admin.dishes.v1', JSON.stringify(legacy))
    await import('../src/store.js?reload=migrate-save')

    const saved = JSON.parse(storage.getItem('cbmfood.admin.dishes.v1'))
    assert.ok(saved.every((dish) => Array.isArray(dish.tags)), 'phải lưu lại kho đã bổ sung')
    assert.ok(saved.find((dish) => dish.id === 'MH-001').originalPrice > 0)

    reset()
  })
})
