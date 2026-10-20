import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { freshModules } from './helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const mainJs = readFileSync(resolve(root, 'src/main.js'), 'utf8')
const gamesUiJs = readFileSync(resolve(root, 'src/games-ui.js'), 'utf8')

const games = await import('../src/games.js')

const DAY = 24 * 60 * 60 * 1000

/** RNG xác định: lặp vô hạn một chuỗi số đã cho. */
const fixedRng = (seq) => {
  let i = 0
  return () => {
    const value = seq[i % seq.length]
    i += 1
    return value
  }
}

/* ===================== CÀO THẺ ===================== */

test('scratchRatio tinh dung ty le da cao', () => {
  assert.equal(games.scratchRatio(0, 100), 0)
  assert.equal(games.scratchRatio(55, 100), 0.55)
  assert.equal(games.scratchRatio(150, 100), 1, 'bi chan o 1')
  assert.equal(games.scratchRatio(10, 0), 0, 'tong 0 thi ratio 0')
  assert.equal(games.scratchRatio(-5, 100), 0, 'am thi ve 0')
})

test('scratch chi mo thuong khi cao du dien tich', () => {
  assert.equal(games.scratchRevealed(54, 100), false, 'thieu 1% van chua mo')
  assert.equal(games.scratchRevealed(55, 100), true, 'dat nguong la mo')
  assert.equal(games.scratchRevealed(80, 100), true)
  assert.equal(games.scratchRevealed(0, 0), false, 'chua cao gi khong mo thuong')
})

/* ===================== BỐC THƯỞNG ===================== */

test('pickReward tra ve phan thuong thuoc pool theo trong so', () => {
  const pool = [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 1 },
    { id: 'c', weight: 1 },
  ]
  assert.equal(games.pickReward(pool, fixedRng([0])).id, 'a', 'rng=0 chon phan tu dau')
  assert.equal(games.pickReward(pool, fixedRng([0.5])).id, 'b', 'rng=0.5 chon phan tu giua')
  assert.equal(games.pickReward(pool, fixedRng([0.9999])).id, 'c')
})

test('pickReward tra pool rong / trong so 0 thi null', () => {
  assert.equal(games.pickReward([], Math.random), null)
  assert.equal(games.pickReward([{ id: 'x', weight: 0 }], Math.random), null)
})

test('pool cao the co ca ba kieu voucher that: giam %, giam tien, mien phi ship', () => {
  const types = new Set(games.REWARD_POOL.scratch.map((r) => r.type).filter(Boolean))
  assert.ok(types.has('percent'), 'co muc giam phan tram')
  assert.ok(types.has('fixed'), 'co muc giam tien')
  assert.ok(types.has('freeship'), 'co muc mien phi giao hang')
  const none = games.REWARD_POOL.scratch.filter((r) => !r.type)
  assert.ok(none.length >= 1, 'co muc khong trung de ty le hop ly')
})

/* ===================== TRAO THƯỞNG = VOUCHER THẬT ===================== */

test('trung thuong tao ra voucher THAT dung duoc o gio hang (giam %)', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Phở bò tái', price: 200000 })
  cart.add(dish.code, 1)

  const prize = games.REWARD_POOL.scratch.find((r) => r.type === 'percent' && r.value === 10)
  const result = games.claimGameReward(prize)
  assert.ok(result.code, `ma thuong phai co, thay ${JSON.stringify(result)}`)

  /* Voucher nam trong kho store — admin quan ly duoc, khach dung duoc. */
  const live = store.findVoucher(result.code)
  assert.ok(live, 'voucher phai nam trong kho store')
  assert.equal(live.type, 'percent')
  assert.equal(live.value, 10)
  assert.equal(live.usageLimit, 1, 'qua game dung 1 lan')

  assert.ok(cart.applyVoucher(result.code).ok, 'ap vao gio thanh cong')
  assert.equal(cart.discount(), 20000, 'giam 10% cua 200.000 = 20.000')
})

test('trung thuong tao voucher giam tien that', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Cơm sườn', price: 150000 })
  cart.add(dish.code, 1)

  const prize = games.REWARD_POOL.scratch.find((r) => r.type === 'fixed')
  const result = games.claimGameReward(prize)
  assert.ok(result.code)
  assert.equal(store.findVoucher(result.code).type, 'fixed')

  assert.ok(cart.applyVoucher(result.code).ok)
  assert.equal(cart.discount(), prize.value, 'giam truc tiep so tien thuong')
})

test('trung thuong tao voucher mien phi giao hang that', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Bún chả', price: 80000 })
  cart.add(dish.code, 1)
  assert.ok(cart.shipping() > 0, 'truoc do van co phi ship')

  const prize = games.REWARD_POOL.scratch.find((r) => r.type === 'freeship')
  const result = games.claimGameReward(prize)
  assert.ok(result.code)
  assert.equal(store.findVoucher(result.code).type, 'freeship')

  assert.ok(cart.applyVoucher(result.code).ok)
  assert.equal(cart.shipping(), 0, 'phi giao hang = 0 sau khi ap')
  assert.equal(cart.total(), 80000)
})

test('qua game ton tai that han va dung 1 lan', async () => {
  const { store } = await freshModules()
  const now = Date.now()
  const result = games.claimGameReward(games.REWARD_POOL.memory[0], { now })
  const live = store.findVoucher(result.code)
  assert.ok(live.expiresAt >= now + 6 * DAY, 'han su dung toi thieu gan 7 ngay')
  assert.equal(live.perUserLimit, 1)
  assert.equal(live.active, true)
})

test('ma thuong khong trung nhau sau nhieu lan nhan', async () => {
  const { store } = await freshModules()
  const codes = new Set()
  for (let i = 0; i < 4; i += 1) {
    const result = games.claimGameReward(games.REWARD_POOL.memory[0])
    assert.ok(result.code, `lan ${i} phai tao duoc ma`)
    codes.add(result.code)
  }
  assert.equal(codes.size, 4, '4 lan nhan ra 4 ma khac nhau')
  assert.equal(store.listVouchers().length, 4)
})

test('khong trung (type null) thi bao loi va khong tru luot ngay', async () => {
  const { store } = await freshModules()
  const before = games.gameClaimsLeft()
  const result = games.claimGameReward(games.REWARD_POOL.scratch.find((r) => !r.type))
  assert.ok(result.error)
  assert.equal(store.listVouchers().length, 0, 'khong tao voucher nao')
  assert.equal(games.gameClaimsLeft(), before, 'khong tru luot nhan qua')
})

test('claim thuong khong hop le thi bao loi', async () => {
  await freshModules()
  assert.ok(games.claimGameReward(null).error)
  assert.ok(games.claimGameReward({ type: 'voucher-he-nat' }).error)
})

test('gioi han 5 qua moi ngay: qua luot thi loi, sang ngay moi nhan lai', async () => {
  const { store } = await freshModules()
  const now = Date.now()
  for (let i = 0; i < 5; i += 1) {
    const result = games.claimGameReward(games.REWARD_POOL.memory[0], { now })
    assert.ok(result.code, `lan ${i} van nhan duoc`)
  }
  assert.equal(games.gameClaimsLeft(now), 0)
  const denied = games.claimGameReward(games.REWARD_POOL.memory[0], { now })
  assert.ok(denied.error, 'lan thu 6 phai loi')
  assert.equal(store.listVouchers().length, 5)

  /* Sang hôm sau thì hạn mức mới. */
  const tomorrow = now + DAY
  assert.equal(games.gameClaimsLeft(tomorrow), 5)
  assert.ok(games.claimGameReward(games.REWARD_POOL.memory[0], { now: tomorrow }).code)
})

test('listGameRewards tra qua moi nhat truoc va ton trong localStorage', async () => {
  await freshModules()
  const now = Date.now()
  games.claimGameReward(games.REWARD_POOL.memory[0], { now: now - 1000 })
  games.claimGameReward(games.REWARD_POOL.memory[1], { now })
  const list = games.listGameRewards()
  assert.equal(list.length, 2)
  assert.ok(list[0].at >= list[1].at, 'moi nhat len dau')
  assert.ok(list[0].code && list[0].label, 'co ma va nhan de hien thi')
})

/* ===================== LẬP THẺ TÌM CẶP ===================== */

test('ban lap the lay mon THAT tu kho va moi cap xuat hien dung 2 lan', async () => {
  const { store } = await freshModules()
  const dishes = store.listDishes()
  const board = games.createMemoryBoard({ dishes, pairs: 6, rng: Math.random })
  assert.ok(board, 'kho du mon thi tao duoc ban')
  assert.equal(board.cards.length, 12, '6 cap = 12 the')
  assert.equal(board.moves, 0)
  assert.equal(board.done, false)

  const counts = {}
  for (const card of board.cards) counts[card.pairKey] = (counts[card.pairKey] ?? 0) + 1
  assert.equal(Object.keys(counts).length, 6, 'dung 6 cap khac nhau')
  for (const [key, times] of Object.entries(counts)) {
    assert.equal(times, 2, `cap ${key} phai xuat hien dung 2 lan`)
    const dish = dishes.find((d) => d.code === key)
    assert.ok(dish, 'pairKey la code mon that trong kho')
  }
})

test('ban lap the tra ve null khi khong du mon', () => {
  const few = [
    { code: 'A', name: 'Món 1' },
    { code: 'B', name: 'Món 2' },
    { code: 'C', name: 'Món 3' },
  ]
  assert.equal(games.createMemoryBoard({ dishes: few, pairs: 6 }), null)
})

test('lat the: lan dau first, trung cap thi match, lech thi miss va tang luot', () => {
  const dishes = [
    { code: 'A', name: 'Món A' },
    { code: 'B', name: 'Món B' },
  ]
  /* rng xao nhung chon theo pairKey nen khong phu thuoc thu tu ngau nhien. */
  const board = games.createMemoryBoard({ dishes, pairs: 2, rng: fixedRng([0]) })
  const aCards = board.cards.filter((c) => c.pairKey === 'A')
  const bCards = board.cards.filter((c) => c.pairKey === 'B')

  let step = games.flipMemoryCard(board, aCards[0].id)
  assert.equal(step.event, 'first')
  assert.equal(step.game.first, aCards[0].id)

  /* Lat cung the bi ignore. */
  assert.equal(games.flipMemoryCard(step.game, aCards[0].id).event, 'ignore')

  /* Cung cap -> match. */
  step = games.flipMemoryCard(step.game, aCards[1].id)
  assert.equal(step.event, 'match')
  assert.equal(step.game.matches, 1)
  assert.equal(step.game.moves, 1, 'cap dung van dem 1 luot lat')
  assert.ok(step.game.cards.filter((c) => c.pairKey === 'A').every((c) => c.matched))

  /* Khac cap -> miss... */
  step = games.flipMemoryCard(step.game, bCards[0].id)
  assert.equal(step.event, 'first')
  /* The da matched khong lat tiep duoc nua. */
  assert.equal(games.flipMemoryCard(step.game, aCards[0].id).event, 'ignore')

  /* Lat dung the con lai thi ket thuc. */
  const done = games.flipMemoryCard(step.game, bCards[1].id)
  assert.equal(done.event, 'match')
  assert.equal(done.game.done, true, 'het cap thi xong ban')
  assert.equal(games.flipMemoryCard(done.game, bCards[0].id).event, 'ignore', 'xong roi khong lat nua')
})

test('lat lech roi closeMemoryPair an hai the sai, giu the matched', () => {
  const dishes = [
    { code: 'A', name: 'Món A' },
    { code: 'B', name: 'Món B' },
  ]
  const board = games.createMemoryBoard({ dishes, pairs: 2, rng: fixedRng([0]) })
  const aCards = board.cards.filter((c) => c.pairKey === 'A')
  const bCards = board.cards.filter((c) => c.pairKey === 'B')

  /* Lat lech: A doi voi B -> miss, ca hai the deu dang mo. */
  const first = games.flipMemoryCard(board, aCards[0].id).game
  const miss = games.flipMemoryCard(first, bCards[0].id)
  assert.equal(miss.event, 'miss')

  const closed = games.closeMemoryPair(miss.game)
  assert.equal(closed.cards.find((c) => c.id === aCards[0].id).flipped, false, 'the A bi an lai')
  assert.equal(closed.cards.find((c) => c.id === bCards[0].id).flipped, false, 'the B bi an lai')

  /* Trung cap A roi, closeMemoryPair van giu matched mo. */
  const matched = games.flipMemoryCard(first, aCards[1].id)
  assert.equal(matched.event, 'match')
  const afterClose = games.closeMemoryPair(matched.game)
  assert.ok(afterClose.cards.filter((c) => c.matched).every((c) => c.flipped), 'matched van mo')
})

test('memoryStars theo so luot lat', () => {
  assert.equal(games.memoryStars(6, 6), 3, 'gần như không lật nhầm')
  assert.equal(games.memoryStars(8, 6), 3, '6*1.2 = 7.2 -> ceil 8, van 3 sao')
  assert.equal(games.memoryStars(9, 6), 2, 'vuot nguong 3 sao')
  assert.equal(games.memoryStars(11, 6), 2, '6*1.8 = 10.8 -> ceil 11, van 2 sao')
  assert.equal(games.memoryStars(12, 6), 1, 'vuot nguong 2 sao')
  assert.equal(games.memoryStars(0, 6), 3, 'mac dinh khong di het 6 luot')
})

test('memoryReward cang nhieu sao qua cang gia tri hon', () => {
  const stars3 = games.memoryReward(3)
  const stars1 = games.memoryReward(1)
  assert.equal(stars3.id, 'm-pct10', '3 sao nhan voucher giam 10%')
  assert.equal(stars1.id, 'm-fixed10', '1 sao nhan giam 10.000d')
  assert.notEqual(stars3.type, stars1.type)
  assert.ok(['percent', 'fixed', 'freeship'].includes(stars3.type))
  assert.ok(['percent', 'fixed', 'freeship'].includes(stars1.type))
})

/* ===================== ĐỐ VUI ===================== */

test('bank cau hoi hop le: phai co trac nghiem, dap an nam trong lua chon', () => {
  assert.ok(games.QUIZ_QUESTIONS.length >= 5, 'it nhat 5 cau de rut')
  for (const q of games.QUIZ_QUESTIONS) {
    assert.ok(q.prompt.length > 0, `cau ${q.id} thieu noi dung`)
    assert.ok(q.options.length >= 2, `cau ${q.id} thieu lua chon`)
    assert.ok(Number.isInteger(q.answer), `cau ${q.id} dap an phai la chi so nguyen`)
    assert.ok(q.answer >= 0 && q.answer < q.options.length, `cau ${q.id} dap an vuot lua chon`)
  }
})

test('createQuizSet chon cau khong trung va copy options (khong doi bank)', () => {
  const set = games.createQuizSet({ count: 5, rng: Math.random })
  assert.equal(set.length, 5)
  const ids = new Set(set.map((q) => q.id))
  assert.equal(ids.size, 5, 'khong trung cau')
  set[0].options[0] = 'ĐÃ SỬA'
  const bank = games.QUIZ_QUESTIONS.find((q) => q.id === set[0].id)
  assert.notEqual(bank.options[0], 'ĐÃ SỬA', 'options phai la ban sao')
})

test('createQuizSet loc cau hoi hu va gioi han theo bank', () => {
  const broken = [
    { id: 'ok', prompt: 'Câu tốt?', options: ['A', 'B'], answer: 1 },
    { id: 'bad-answer', prompt: 'Sai đáp án', options: ['A', 'B'], answer: 5 },
    { id: 'no-options', prompt: 'Không lựa chọn', options: [], answer: 0 },
    null,
  ]
  const set = games.createQuizSet({ bank: broken, count: 10, rng: Math.random })
  assert.equal(set.length, 1, 'chi con cau hop le')
  assert.equal(set[0].id, 'ok')
})

test('cham diem tung cau va xep loai phan thuong', () => {
  const q = { id: 'x', prompt: '?', options: ['Đúng', 'Sai'], answer: 0 }
  assert.equal(games.gradeQuizAnswer(q, 0).correct, true)
  assert.equal(games.gradeQuizAnswer(q, 1).correct, false)
  assert.equal(games.gradeQuizAnswer(q, 1).correctIndex, 0, 'tra loi sai van biet dap an')
  assert.equal(games.gradeQuizAnswer(null, 0).correct, false)

  assert.equal(games.quizScoreTier(5, 5).tier, 'perfect')
  assert.equal(games.quizScoreTier(4, 5).tier, 'good')
  assert.equal(games.quizScoreTier(3, 5).tier, 'pass')
  assert.equal(games.quizScoreTier(2, 5).tier, 'fail')
  assert.equal(games.quizScoreTier(2, 5).reward, null, 'duoi 60% khong co thuong')

  /* Moi bac thuong deu doi thanh voucher that duoc. */
  for (const tier of ['perfect', 'good', 'pass']) {
    const prize = games.quizScoreTier(tier === 'perfect' ? 5 : tier === 'good' ? 4 : 3, 5).reward
    assert.ok(['percent', 'freeship'].includes(prize.type), `bac ${tier} co voucher hop le`)
  }
})

test('diem vong qua thuong do bai bang voucher that ap duoc vao gio', async () => {
  const { store, cart } = await freshModules()
  const dish = store.createDish({ name: 'Phở gà', price: 200000 })
  cart.add(dish.code, 1)

  /* Voucher hoàn hảo có đơn tối thiểu 150.000đ — giỏ 200.000đ là đủ. */
  const prize = games.quizScoreTier(5, 5).reward
  assert.ok(prize.minOrder <= 200000, 'don test phai dat don toi thieu cua thuong')
  const result = games.claimGameReward(prize)
  assert.ok(result.code)
  assert.ok(cart.applyVoucher(result.code).ok)
  assert.ok(cart.discount() > 0, 'gia tri thuong duoc tru vao don')
})

/* ===================== TÍCH HỢP GIAO DIỆN ===================== */

test('trang ban hang co section game va mount tu main.js', () => {
  assert.match(mainJs, /id="gamesMount"/, 'shell() phai co khung #gamesMount')
  assert.match(mainJs, /mountGames\(\{/, 'main.js phai goi mountGames')
  assert.match(mainJs, /<a href="#games">/, 'navbar co link toi mini game')
})

test('giao dien game ung voucher bang cart.applyVoucher (khong phai ma gia)', () => {
  assert.match(gamesUiJs, /cart\.applyVoucher\(/, 'games-ui phai ap voucher qua cart')
  assert.match(gamesUiJs, /games\.claimGameReward\(/, 'games-ui phai doi qua bang claimGameReward')
})

test('giao dien cao the dung pointer events (chuot va cam ung)', () => {
  const styleCss = readFileSync(resolve(root, 'src/style.css'), 'utf8')
  assert.match(gamesUiJs, /pointerdown/, 'co su kien pointerdown cho chuot/cam ung')
  assert.match(styleCss, /touch-action/, 'CSS co touch-action de cham khong cuon trang')
})
