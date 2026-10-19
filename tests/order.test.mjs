import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshModules, STORAGE } from './helpers.mjs'

const validCustomer = {
  name: 'Nguyễn Như Quyết',
  phone: '0901234567',
  address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
}

const setup = async (dishes = [{ name: 'Phở Bò', price: 50000, qty: 2 }]) => {
  const ctx = await freshModules()
  const items = dishes.map((d) => {
    const created = ctx.store.createDish({ name: d.name, price: d.price })
    assert.ok(created && !created.error, `tao mon that bai: ${d.name}`)
    return { key: created.code, qty: d.qty }
  })
  return { ...ctx, items }
}

test('dat hang thanh cong', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: validCustomer, items })
  assert.ok(res.order, `dat hang that bai: ${res.error}`)
  assert.equal(res.order.status, 'pending')
  assert.equal(res.order.items.length, 1)
  assert.equal(res.order.subtotal, 100000)
  assert.equal(res.order.shipping, 15000)
  assert.equal(res.order.total, 115000)
  assert.match(res.order.code, /^DH\d{8}-\d{3}$/, `ma don sai: ${res.order.code}`)
})

test('don hang rong bi tu choi', async () => {
  const { store } = await setup()
  assert.equal(store.createOrder({ customer: validCustomer, items: [] }).error, 'Giỏ hàng đang rỗng')
})

test('thieu ten nguoi nhan bi tu choi', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: { ...validCustomer, name: '  ' }, items })
  assert.ok(res.error, 'phai bao loi')
})

test('so dien thoai sai dinh dang bi tu choi', async () => {
  const { store, items } = await setup()
  for (const phone of ['123', 'abc', '01234567', '0123456789012']) {
    assert.ok(
      store.createOrder({ customer: { ...validCustomer, phone }, items }).error,
      `so ${phone} phai bi tu choi`,
    )
  }
  assert.ok(!store.createOrder({ customer: { ...validCustomer, phone: '0901234567' }, items }).error)
})

test('dia chi qua ngan bi tu choi', async () => {
  const { store, items } = await setup()
  assert.ok(store.createOrder({ customer: { ...validCustomer, address: 'abc' }, items }).error)
})

test('mon khong ton tai trong don bi bo qua', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({
    customer: validCustomer,
    items: [...items, { key: 'KHONG-CO', qty: 3 }],
  })
  assert.equal(res.order.items.length, 1, 'mon rac khong duoc ghi vao don')
})

test('dat hang tang so luot ban cua mon', async () => {
  const { store, items } = await setup([{ name: 'Phở Bò', price: 50000, qty: 3 }])
  const before = store.findDish(items[0].key).sold
  store.createOrder({ customer: validCustomer, items })
  assert.equal(store.findDish(items[0].key).sold, before + 3)
})

test('don lon du 150.000 duoc mien phi ship', async () => {
  const { store, items } = await setup([{ name: 'Set Lẩu', price: 200000, qty: 1 }])
  const res = store.createOrder({ customer: validCustomer, items })
  assert.equal(res.order.shipping, 0)
  assert.equal(res.order.total, 200000)
})

test('ghi nhan user khi dang nhap', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: validCustomer, items, userId: 'u-1' })
  assert.equal(res.order.userId, 'u-1')
})

test('ghi chu duoc luu', async () => {
  const { store, items } = await setup()
  const res = store.createOrder({ customer: validCustomer, items, note: 'Ít cay' })
  assert.equal(res.order.note, 'Ít cay')
})

test('ma don khong trung nhau', async () => {
  const { store, items } = await setup()
  const a = store.createOrder({ customer: validCustomer, items }).order
  const b = store.createOrder({ customer: validCustomer, items }).order
  assert.notEqual(a.code, b.code)
})

test('chuyen trang thai don va ghi lich su', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  const next = store.updateOrderStatus(order.code, 'confirmed')
  assert.equal(next.status, 'confirmed')
  assert.equal(next.history.length, 2)
  assert.equal(next.history.at(-1).status, 'confirmed')
})

test('chuyen trang thai sai bi tu choi', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  assert.equal(store.updateOrderStatus(order.code, 'khong-hop-le'), null)
  assert.equal(store.updateOrderStatus('KHONG-CO', 'confirmed'), null)
})

test('doi trang thai giong hien khong ghi them lich su', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  const same = store.updateOrderStatus(order.code, 'pending')
  assert.equal(same.history.length, 1)
})

test('chay day duoc luong pending den completed', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  for (const status of ['confirmed', 'delivering', 'completed']) {
    assert.equal(store.updateOrderStatus(order.code, status).status, status)
  }
  assert.equal(store.listOrdersByStatus('completed').length, 1)
  assert.equal(store.listOrdersByStatus('pending').length, 0)
})

test('doanh thu chi tinh don hoan thanh', async () => {
  const { store, items } = await setup()
  const a = store.createOrder({ customer: validCustomer, items }).order
  store.updateOrderStatus(a.code, 'completed')
  const b = store.createOrder({ customer: validCustomer, items }).order
  const stats = store.stats()
  assert.equal(stats.revenue, a.total, 'doanh thu phai bang tong don da hoan thanh')
  assert.notEqual(stats.revenue, a.total + b.total, 'don chua hoan thanh khong duoc tinh')
  assert.equal(stats.pendingCount, 1)
})

test('thong ke tong hop phan anh du lieu', async () => {
  const { store, items } = await setup()
  const dishCount = store.listDishes().length
  store.createOrder({ customer: validCustomer, items })
  const stats = store.stats()
  assert.equal(stats.dishCount, dishCount)
  assert.equal(stats.orderCount, 1)
  assert.equal(stats.pendingCount, 1)
  assert.equal(stats.top.length, 5)
  assert.ok(stats.sold > 0, 'phai co so luot ban')
})

test('tim don theo ma va theo id', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  assert.equal(store.findOrder(order.code).code, order.code)
  assert.equal(store.findOrder(order.id).code, order.code)
  assert.equal(store.findOrder('KHONG-CO'), null)
})

test('chi chuyen tiep theo duoc trang thai hop le', async () => {
  const { store } = await freshModules()
  /* Admin trước đây render đúng 5 nút cho mọi đơn nên đơn đã hoàn thành
     vẫn bị kéo ngược về "Chờ xác nhận". */
  assert.deepEqual(store.nextOrderStatuses('pending'), ['confirmed', 'cancelled'])
  assert.deepEqual(store.nextOrderStatuses('confirmed'), ['delivering', 'cancelled'])
  assert.deepEqual(store.nextOrderStatuses('delivering'), ['completed', 'cancelled'])
  assert.deepEqual(store.nextOrderStatuses('completed'), [], 'don hoan thanh la trang thai cuoi')
  assert.deepEqual(store.nextOrderStatuses('cancelled'), [], 'don da huy la trang thai cuoi')
  assert.deepEqual(store.nextOrderStatuses('khong-hop-le'), [])
})

test('nextOrderStatuses tra ve ban sao khong sua duoc don', async () => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items })
  const options = store.nextOrderStatuses(order.status)
  options.push('completed')
  assert.deepEqual(store.nextOrderStatuses(order.status), ['confirmed', 'cancelled'])
})

test('dat nhieu mon vao mot don', async () => {
  const { store } = await setup([
    { name: 'Phở Bò', price: 50000, qty: 1 },
    { name: 'Bánh Mì', price: 20000, qty: 2 },
    { name: 'Cà Phê', price: 25000, qty: 1 },
  ])
  const items = store
    .listDishes()
    .slice(0, 3)
    .map((d) => ({ key: d.code, qty: 1 }))
  const res = store.createOrder({ customer: validCustomer, items })
  assert.equal(res.order.items.length, 3)
  assert.equal(res.order.subtotal, 50000 + 20000 + 25000)
})

/* ---------------- Đơn của tôi ---------------- */

const KHACH_A = 'KH-A'
const KHACH_B = 'KH-B'

const datNhieuDon = async () => {
  const { store, items } = await setup()
  const a1 = store.createOrder({ customer: validCustomer, items, userId: KHACH_A }).order
  const a2 = store.createOrder({ customer: validCustomer, items, userId: KHACH_A }).order
  const b1 = store.createOrder({ customer: validCustomer, items, userId: KHACH_B }).order
  const khachVangLai = store.createOrder({ customer: validCustomer, items }).order
  return { store, a1, a2, b1, khachVangLai }
}

test('chi thay don cua chinh khach dang nhap', async () => {
  const { store, a1, a2, b1, khachVangLai } = await datNhieuDon()
  const cuaA = store.listOrdersByUser(KHACH_A)
  assert.equal(cuaA.length, 2, 'khach A phai thay dung 2 don cua minh')
  assert.deepEqual(
    cuaA.map((o) => o.code).sort(),
    [a1.code, a2.code].sort(),
  )
  assert.ok(!cuaA.some((o) => o.code === b1.code), 'khong duoc lo don cua khach B')
  assert.ok(
    !cuaA.some((o) => o.code === khachVangLai.code),
    'don cua khach vang lai khong thuoc ve tai khoan nao',
  )
})

test('khach vang lai khong thay duoc don nao', async () => {
  const { store } = await datNhieuDon()
  /* userId null là đơn không chủ; nếu lọc sai thì mọi khách đều thấy đơn này. */
  assert.deepEqual(store.listOrdersByUser(null), [])
  assert.deepEqual(store.listOrdersByUser(undefined), [])
  assert.deepEqual(store.listOrdersByUser(''), [])
})

test('khach khong co don thi ra danh sach rong', async () => {
  const { store } = await setup()
  assert.deepEqual(store.listOrdersByUser('KH-KHONG-CO'), [])
})

test('don cua toi sap xep moi nhat truoc', async () => {
  const { store, a1, a2 } = await datNhieuDon()
  const cuaA = store.listOrdersByUser(KHACH_A)
  assert.equal(cuaA[0].code, a2.code, 'don tao sau phai len dau')
  assert.equal(cuaA[1].code, a1.code)
  assert.ok(cuaA[0].createdAt >= cuaA[1].createdAt)
})

test('listOrdersByUser tra ve ban sao khong sua duoc don', async () => {
  const { store } = await datNhieuDon()
  const cuaA = store.listOrdersByUser(KHACH_A)
  cuaA[0].status = 'completed'
  cuaA[0].items.push({ key: 'GIA-MAO', name: 'xo', price: 1, qty: 99 })
  const lai = store.listOrdersByUser(KHACH_A)
  assert.notEqual(lai[0].status, 'completed', 'trang thái don bi sua qua ban sao')
  assert.equal(lai[0].items.length, 1, 'danh sach mon bi them qua ban sao')
})

test('khach huỷ duoc don khi nhà hàng chưa xác nhận', async () => {
  const { store, a1 } = await datNhieuDon()
  const result = store.cancelOrder(a1.code)
  assert.ok(!result.error, `huỷ đơn phai thành công: ${result.error}`)
  assert.equal(result.status, 'cancelled')
  assert.equal(result.cancelledBy, 'customer')
  assert.equal(store.findOrder(a1.code).status, 'cancelled', 'phai ghi xuong du lieu')
  const history = store.findOrder(a1.code).history
  assert.equal(history.at(-1).status, 'cancelled', 'phai ghi vao lich su')
  assert.equal(history.length, 2)
})

test('huỷ duoc theo ma don va theo id', async () => {
  const { store, a1 } = await datNhieuDon()
  assert.equal(store.cancelOrder(a1.id).status, 'cancelled')
})

test('không huỷ được đơn nhà hàng đã nhận', async () => {
  /* Trước đây khách có thể kéo đơn đang giao về "Đã huỷ", lệch với thực tế
     và làm sai thống kê. */
  for (const next of ['confirmed', 'delivering', 'completed']) {
    const { store, items } = await setup()
    const { order } = store.createOrder({ customer: validCustomer, items, userId: KHACH_A })
    store.updateOrderStatus(order.code, next)
    const result = store.cancelOrder(order.code)
    assert.ok(result.error, `đơn đang ${next} phải bị từ chối huỷ`)
    assert.equal(store.findOrder(order.code).status, next, 'trạng thái phai giữ nguyen')
  }
})

test('huỷ đơn không tồn tại phải báo lỗi', async () => {
  const { store } = await datNhieuDon()
  assert.ok(store.cancelOrder('DH00000000-999').error)
})

test('huỷ đơn đã huỷ thì không ghi thêm lich su', async () => {
  const { store, a1 } = await datNhieuDon()
  store.cancelOrder(a1.code)
  const before = store.findOrder(a1.code).history.length
  const again = store.cancelOrder(a1.code)
  assert.ok(!again.error)
  assert.equal(store.findOrder(a1.code).history.length, before, 'khong ghi lai lich su')
})

test('canCancelOrder chi cho phep o buoc cho xac nhan', async () => {
  const { store } = await freshModules()
  assert.equal(store.canCancelOrder('pending'), true)
  for (const status of ['confirmed', 'delivering', 'completed', 'cancelled', 'khong-hop-le']) {
    assert.equal(store.canCancelOrder(status), false, `${status} phai khong huỷ duoc`)
  }
})

test('không huỷ được đơn của khách khác', async () => {
  /* Biết mã đơn là đủ để huỷ hộ nếu không kiểm tra chủ đơn. */
  const { store, a1 } = await datNhieuDon()
  const result = store.cancelOrder(a1.code, KHACH_B)
  assert.ok(result.error, 'khách B phải bị chặn')
  assert.equal(store.findOrder(a1.code).status, 'pending', 'trạng thái phải giữ nguyên')
  assert.ok(!store.cancelOrder(a1.code, KHACH_A).error, 'chủ đơn vẫn huỷ được')
})

test('huỷ đơn của khách vãng lai thi không cần userId', async () => {
  /* Đơn không chủ thì không tài khoản nào huỷ được, nhưng cũng không được
     chặn nhầm luồng huỷ của chính hệ thống khi không truyền userId. */
  const { store, khachVangLai } = await datNhieuDon()
  assert.ok(!store.cancelOrder(khachVangLai.code).error)
})

test('huỷ đơn không làm doi doanh thu', async () => {
  const { store, a1 } = await datNhieuDon()
  store.updateOrderStatus(a1.code, 'confirmed')
  store.updateOrderStatus(a1.code, 'delivering')
  store.updateOrderStatus(a1.code, 'completed')
  assert.equal(store.stats().revenue, store.findOrder(a1.code).total)
  const huy = store.createOrder({ customer: validCustomer, items: [{ key: a1.items[0].key, qty: 1 }] })
  assert.equal(huy.order.status, 'pending')
  store.cancelOrder(huy.order.code)
  assert.equal(store.stats().revenue, store.findOrder(a1.code).total, 'đơn huỷ khong tinh doanh thu')
})

/* ===================== ĐÁNH GIÁ MÓN ===================== */

/** Tạo một đơn của KHACH_A ở trạng thái `status` (mặc định đã giao xong). */
const donDeDanhGia = async (status = 'completed', userId = KHACH_A) => {
  const { store, items } = await setup()
  const { order } = store.createOrder({ customer: validCustomer, items, userId })
  if (status !== 'pending') store.updateOrderStatus(order.code, status)
  return { store, order, dishKey: items[0].key }
}

test('khach chua giao xong thi chua duoc danh gia', async () => {
  const { store, order, dishKey } = await donDeDanhGia('pending')
  for (const status of ['pending', 'confirmed', 'delivering', 'cancelled']) {
    if (store.findOrder(order.code).status !== status) {
      store.updateOrderStatus(order.code, status)
    }
    const res = store.saveReview({ orderId: order.id, dishKey, rating: 5, userId: KHACH_A })
    assert.ok(res.error, `đơn ${status} phải bị chặn đánh giá`)
  }
  assert.equal(store.canRateOrder('completed'), true)
  assert.equal(store.canRateOrder('delivering'), false)
})

test('cham sao 1 den 5 va luu duoc', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  for (const rating of [1, 2, 3, 4, 5]) {
    const res = store.saveReview({ orderId: order.id, dishKey, rating, userId: KHACH_A })
    assert.ok(res.review, `chấm ${rating} sao phải được: ${res.error}`)
    assert.equal(res.review.rating, rating)
  }
})

test('sao ngoai 1 den 5 bi tu choi', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  for (const rating of [0, -1, 6, 3.5, 4.2, null, NaN, true, false, {}, [], '']) {
    assert.ok(
      store.saveReview({ orderId: order.id, dishKey, rating, userId: KHACH_A }).error,
      `số sao ${JSON.stringify(rating)} phải bị từ chối`,
    )
  }
  /* Form gửi giá trị textarea/dataset dưới dạng chuỗi nên '4' phải hợp lệ. */
  const ok = store.saveReview({ orderId: order.id, dishKey, rating: '4', userId: KHACH_A })
  assert.ok(ok.review, `chuỗi số phải nhận được: ${ok.error}`)
  assert.equal(ok.review.rating, 4)
})

test('khach khong danh gia duoc don cua nguoi khac', async () => {
  /* Biết mã đơn là đủ để chấm sao hộ nếu không kiểm tra chủ đơn. */
  const { store, order, dishKey } = await donDeDanhGia('completed', KHACH_A)
  const res = store.saveReview({ orderId: order.id, dishKey, rating: 1, userId: KHACH_B })
  assert.ok(res.error, 'phải chặn khách B chấm cho đơn của khách A')
  assert.deepEqual(store.listReviewsByOrder(order.id), [], 'không được ghi review')
})

test('khach vang lai khong danh gia duoc', async () => {
  const { store, order, dishKey } = await donDeDanhGia('completed', null)
  assert.ok(store.saveReview({ orderId: order.id, dishKey, rating: 5, userId: null }).error)
})

test('mon khong co trong don thi khong danh gia duoc', async () => {
  const { store, order } = await donDeDanhGia()
  const res = store.saveReview({ orderId: order.id, dishKey: 'MON-KHONG-CO', rating: 5, userId: KHACH_A })
  assert.ok(res.error, 'phải chặn món không có trong đơn')
})

test('sua danh gia cua chinh minh va giu nguyen id', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  const first = store.saveReview({
    orderId: order.id,
    dishKey,
    rating: 3,
    comment: 'ngon',
    userId: KHACH_A,
  }).review
  const again = store.saveReview({
    orderId: order.id,
    dishKey,
    rating: 5,
    comment: 'ngon hơn',
    userId: KHACH_A,
  }).review
  assert.equal(again.id, first.id, 'sửa phải ghi đè chứ không tạo bản mới')
  assert.equal(again.rating, 5)
  assert.equal(again.comment, 'ngon hơn')
  assert.equal(store.listReviewsByOrder(order.id).length, 1, 'mỗi món một đánh giá')
  assert.ok(again.updatedAt >= first.updatedAt)
})

test('khoa danh gia thi khong sua duoc', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  const saved = store.saveReview({ orderId: order.id, dishKey, rating: 4, userId: KHACH_A }).review
  const locked = store.setReviewLock({ orderId: order.id, dishKey, locked: true, userId: KHACH_A })
  assert.ok(!locked.error, `khoá phải được: ${locked.error}`)
  assert.equal(locked.review.locked, true)
  assert.equal(locked.review.id, saved.id)

  const edit = store.saveReview({ orderId: order.id, dishKey, rating: 1, userId: KHACH_A })
  assert.ok(edit.error, 'đánh giá đã khoá thì chặn ghi đè')
  assert.equal(store.findReview({ orderId: order.id, dishKey, userId: KHACH_A }).rating, 4)

  const opened = store.setReviewLock({ orderId: order.id, dishKey, locked: false, userId: KHACH_A })
  assert.equal(opened.review.locked, false, 'mở khoá để khách sửa lại')
  assert.ok(store.saveReview({ orderId: order.id, dishKey, rating: 5, userId: KHACH_A }).review)
})

test('khoa danh gia cua nguoi khac bi tu choi', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  store.saveReview({ orderId: order.id, dishKey, rating: 4, userId: KHACH_A })
  assert.ok(store.setReviewLock({ orderId: order.id, dishKey, locked: true, userId: KHACH_B }).error)
})

test('khoa danh gia chua ton tai bi tu choi', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  assert.ok(store.setReviewLock({ orderId: order.id, dishKey, locked: true, userId: KHACH_A }).error)
})

test('diem trung binh tinh tren danh gia dang an', async () => {
  const { store, items } = await setup()
  const ghi = async (key, rating, userId) => {
    const { order } = store.createOrder({ customer: validCustomer, items: [{ key, qty: 1 }], userId })
    store.updateOrderStatus(order.code, 'completed')
    return store.saveReview({ orderId: order.id, dishKey: key, rating, userId }).review
  }
  const rv1 = await ghi(items[0].key, 5, KHACH_A)
  await ghi(items[0].key, 4, KHACH_B)
  assert.deepEqual(store.dishRating(items[0].key), { average: 4.5, count: 2 })

  /* Ẩn đi 1 đánh giá 5 sao thì điểm phải tụt xuống 4, số lượt còn lại 1. */
  store.setReviewHidden(rv1.id, true)
  assert.deepEqual(store.dishRating(items[0].key), { average: 4, count: 1 })
  assert.equal(store.listReviews({ includeHidden: false }).length, 1)
  assert.equal(store.listReviews().length, 2, 'mặc định vẫn thấy review bị ẩn')

  store.setReviewHidden(rv1.id, false)
  assert.deepEqual(store.dishRating(items[0].key), { average: 4.5, count: 2 })
})

test('mon chua co danh gia thi diem bang 0', async () => {
  const { store, items } = await setup()
  assert.deepEqual(store.dishRating(items[0].key), { average: 0, count: 0 })
  assert.deepEqual(store.dishRatings()[items[0].key], { average: 0, count: 0 })
})

test('an danh gia khong tinh vao thong ke mon', async () => {
  const { store, items } = await setup()
  const goc = items[0].key
  const { order } = store.createOrder({ customer: validCustomer, items, userId: KHACH_A })
  store.updateOrderStatus(order.code, 'completed')
  const rv = store.saveReview({ orderId: order.id, dishKey: goc, rating: 5, userId: KHACH_A }).review

  const xem = () => store.dishRatings()[goc].average
  const giaBanDau = xem()
  store.setReviewHidden(rv.id, true)
  assert.equal(xem(), 0, 'đánh giá bị ẩn thì món trở lại chưa có điểm')
  store.setReviewHidden(rv.id, false)
  assert.equal(xem(), giaBanDau)
  assert.equal(store.setReviewHidden('RV-KHONG-CO', true), null, 'id sai trả null')
})

test('nhac xinh duoc cat ngan', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  const long = 'a'.repeat(500)
  const res = store.saveReview({ orderId: order.id, dishKey, rating: 4, comment: long, userId: KHACH_A })
  assert.equal(res.review.comment.length, 300)
})

test('findReview tra review rong khi chua cham', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  const review = store.findReview({ orderId: order.id, dishKey, userId: KHACH_A })
  assert.equal(review.rating, null)
  assert.equal(review.locked, false)
})

test('reloadFromStorage nap lai danh gia tu localStorage', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  /* Ghi thẳng vào kho rồi nạp lại: đó đúng là đường đi của sự kiện `storage`
     khi một tab khác ghi đánh giá. Bản ghi cũ thiếu `locked`/`hidden` nên phải
     được chuẩn hoá chứ không đổ nguyên xuống giao diện. */
  STORAGE.setItem(
    'cbmfood.reviews',
    JSON.stringify([{ id: 'RV-TAB-KHAC', orderId: order.id, dishKey, userId: KHACH_A, rating: 2 }]),
  )
  store.reloadFromStorage()
  const danhGia = store.listReviewsByOrder(order.id)
  assert.equal(danhGia.length, 1, 'phai nạp lại review từ kho')
  assert.equal(danhGia[0].rating, 2)
  assert.equal(danhGia[0].locked, false)
  assert.equal(danhGia[0].hidden, false)
})

test('ban ghi hong bi bo qua khi nap kho', async () => {
  const { store, order, dishKey } = await donDeDanhGia()
  STORAGE.setItem(
    'cbmfood.reviews',
    JSON.stringify([
      { id: 'RV-SAI-SAO', orderId: order.id, dishKey, userId: KHACH_A, rating: 99 },
      { id: null, orderId: order.id, dishKey, userId: KHACH_B, rating: 'x' },
      { id: 'RV-OK', orderId: order.id, dishKey, userId: KHACH_B, rating: 5 },
    ]),
  )
  store.reloadFromStorage()
  const con = store.listReviewsByOrder(order.id)
  assert.equal(con.length, 1, 'chi ban ghi hop le duoc giu lai')
  assert.equal(con[0].id, 'RV-OK')
  assert.deepEqual(store.dishRating(dishKey), { average: 5, count: 1 }, 'khong con so hong hong')
})

test('dan g gia giu nguyen khi sua mon', async () => {
  /* Đánh giá gắn theo mã món, không theo tên hay vị trí trong danh sách,
     nên sửa tên/giá món không làm mất điểm. */
  const { store, order, dishKey } = await donDeDanhGia()
  store.saveReview({ orderId: order.id, dishKey, rating: 4, userId: KHACH_A })
  store.updateDish(dishKey, { name: 'Phở Bò đặc biệt', price: 60000 })
  assert.equal(store.findReview({ orderId: order.id, dishKey, userId: KHACH_A }).rating, 4)
  assert.equal(store.dishRating(dishKey).average, 4)
})