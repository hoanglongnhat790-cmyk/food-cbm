/**
 * Logic của 3 mini game: cào thẻ may mắn, lật thẻ tìm cặp, đố vui ẩm thực.
 *
 * Module này không đụng tới DOM để chạy được trong test Node. Phần thưởng
 * KHÔNG phải mã giả: `claimGameReward` gọi thẳng `db.createVoucher` nên mã
 * trúng là voucher thật, dùng được ở giỏ hàng/checkout với đầy đủ kiểm tra
 * (hạn dùng, lượt dùng, đơn tối thiểu) mà hệ thống đang có.
 */
import * as db from './store.js'

const REWARD_KEY = 'cbmfood.gameRewards'
const CLAIM_LIMIT_PER_DAY = 5
const REWARD_TTL_MS = 7 * 24 * 60 * 60 * 1000

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

const readRewards = () => {
  try {
    const raw = localStorage.getItem(REWARD_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r === 'object') : []
  } catch {
    return []
  }
}

const writeRewards = (list) => {
  try {
    localStorage.setItem(REWARD_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

/* ===================== KHO PHẦN THƯỞNG ===================== */

/**
 * Mỗi phần thưởng mô tả đúng một voucher thật sẽ được tạo ra khi trúng.
 * `weight` chỉ dùng cho bốc thăm; `claimable: false` là "không trúng" (vẫn
 * có trong pool để tỉ lệ trúng hợp lý).
 */
export const REWARD_POOL = {
  /* Cào thẻ: bốc ngẫu nhiên theo tỉ trọng. */
  scratch: [
    { id: 's-freeship', type: 'freeship', value: 0, maxDiscount: 0, minOrder: 80000, weight: 25, label: 'Miễn phí giao hàng' },
    { id: 's-pct10', type: 'percent', value: 10, maxDiscount: 30000, minOrder: 100000, weight: 22, label: 'Giảm 10%' },
    { id: 's-fixed20', type: 'fixed', value: 20000, maxDiscount: 0, minOrder: 150000, weight: 18, label: 'Giảm 20.000đ' },
    { id: 's-pct20', type: 'percent', value: 20, maxDiscount: 50000, minOrder: 200000, weight: 8, label: 'Giảm 20%' },
    { id: 's-fixed50', type: 'fixed', value: 50000, maxDiscount: 0, minOrder: 300000, weight: 5, label: 'Giảm 50.000đ' },
    { id: 's-none', type: null, weight: 22, label: 'Chúc bạn may mắn lần sau' },
  ],
  /* Lật thẻ: quà an ủi theo số sao đạt được. */
  memory: [
    { id: 'm-pct10', type: 'percent', value: 10, maxDiscount: 30000, minOrder: 100000, weight: 1, label: 'Giảm 10%' },
    { id: 'm-freeship', type: 'freeship', value: 0, maxDiscount: 0, minOrder: 60000, weight: 1, label: 'Miễn phí giao hàng' },
    { id: 'm-fixed10', type: 'fixed', value: 10000, maxDiscount: 0, minOrder: 80000, weight: 1, label: 'Giảm 10.000đ' },
  ],
  /* Đố vui: quà theo bậc điểm. */
  quizPerfect: { id: 'q-pct20', type: 'percent', value: 20, maxDiscount: 50000, minOrder: 150000, label: 'Giảm 20%' },
  quizGood: { id: 'q-pct10', type: 'percent', value: 10, maxDiscount: 30000, minOrder: 100000, label: 'Giảm 10%' },
  quizPass: { id: 'q-freeship', type: 'freeship', value: 0, maxDiscount: 0, minOrder: 50000, label: 'Miễn phí giao hàng' },
}

/** Bốc một phần thưởng theo tỉ trọng. Nhận `rng` để test chạy xác định. */
export const pickReward = (pool, rng = Math.random) => {
  if (!Array.isArray(pool) || !pool.length) return null
  const total = pool.reduce((sum, r) => sum + Math.max(0, num(r.weight)), 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const reward of pool) {
    roll -= Math.max(0, num(reward.weight))
    if (roll < 0) return { ...reward }
  }
  return { ...pool[pool.length - 1] }
}

/* ===================== TRAO THƯỞNG THẬT ===================== */

const startOfToday = (now = Date.now()) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Số lần còn được nhận quà game trong hôm nay. */
export const gameClaimsLeft = (now = Date.now()) => {
  const today = startOfToday(now)
  const used = readRewards().filter((r) => num(r.at) >= today).length
  return Math.max(0, CLAIM_LIMIT_PER_DAY - used)
}

/** Danh sách quà đã trúng (mới nhất trước), kèm nhãn voucher để hiển thị. */
export const listGameRewards = () =>
  readRewards()
    .slice()
    .sort((a, b) => num(b.at) - num(a.at))
    .map((r) => ({ ...r }))

const randomCode = (rng) => {
  let out = 'GAME'
  for (let i = 0; i < 5; i += 1) {
    out += ALPHABET[Math.floor(rng() * ALPHABET.length) % ALPHABET.length]
  }
  return out
}

/**
 * Đổi một phần thưởng trúng thành voucher thật trong kho.
 * Voucher đi qua `db.createVoucher` nên admin thấy ngay trong danh sách
 * voucher và khách dùng được y như mã khuyến mãi bình thường.
 */
export const claimGameReward = (reward, { rng = Math.random, now = Date.now() } = {}) => {
  if (!reward || typeof reward !== 'object') return { error: 'Phần thưởng không hợp lệ' }
  if (!reward.type) return { error: 'Lần này chưa trúng thưởng, chúc bạn may mắn lần sau' }
  if (!['percent', 'fixed', 'freeship'].includes(reward.type)) {
    return { error: 'Phần thưởng không hợp lệ' }
  }
  if (gameClaimsLeft(now) <= 0) {
    return { error: 'Đã hết số lần nhận quà hôm nay, quay lại vào ngày mai nhé' }
  }

  /* Mã phải khác mọi mã đang có: đâm sầm thì thử lại, sau vài lần vẫn
     trùng thì báo lỗi thay vì ghi đè voucher của khách khác. */
  let created = null
  for (let attempt = 0; attempt < 6 && !created; attempt += 1) {
    const code = randomCode(rng)
    if (db.findVoucher(code)) continue
    const result = db.createVoucher({
      code,
      type: reward.type,
      value: num(reward.value),
      maxDiscount: num(reward.maxDiscount),
      minOrder: num(reward.minOrder),
      startsAt: now,
      expiresAt: now + REWARD_TTL_MS,
      usageLimit: 1,
      perUserLimit: 1,
      active: true,
    })
    if (result.voucher) created = result.voucher
    else if (result.error && !String(result.error).includes('đã tồn tại')) return { error: result.error }
  }
  if (!created) return { error: 'Không tạo được mã thưởng, bạn thử lại giúp mình nhé' }

  const record = {
    code: created.code,
    rewardId: String(reward.id ?? ''),
    label: db.voucherLabel(created),
    type: created.type,
    at: now,
    expiresAt: created.expiresAt,
  }
  writeRewards([record, ...readRewards()].slice(0, 100))

  return {
    code: created.code,
    label: record.label,
    type: created.type,
    minOrder: created.minOrder,
    expiresAt: created.expiresAt,
    claimsLeft: gameClaimsLeft(now) - 1,
  }
}

/* ===================== (1) CÀO THẺ MAY MẮN ===================== */

/** Tỉ lệ cào tối đa để mở thưởng. Cào dưới mức này giữ nguyên "chưa mở". */
export const SCRATCH_THRESHOLD = 0.55

/** Tỉ lệ diện tích đã cào (0..1) từ số ô đã cào trên bàn cờ mô phỏng. */
export const scratchRatio = (scratchedCells, totalCells) => {
  const total = Math.max(0, num(totalCells))
  if (total === 0) return 0
  const scratched = Math.min(total, Math.max(0, num(scratchedCells)))
  return scratched / total
}

/** Mở thưởng khi đã cào đủ; thiếu thì giao diện vẫn đang "cào dở". */
export const scratchRevealed = (scratchedCells, totalCells, threshold = SCRATCH_THRESHOLD) =>
  scratchRatio(scratchedCells, totalCells) >= threshold

/* ===================== (2) LẬP THẺ TÌM CẶP ===================== */

/**
 * Tạo bàn lật thẻ từ món ăn THẬT trong kho.
 * Mỗi cặp là một món (tên + emoji/ảnh thật), xáo trộn bằng Fisher–Yates
 * với `rng` nhận vào để test bàn cờ xác định được.
 */
export const createMemoryBoard = ({ dishes = null, pairs = 6, rng = Math.random } = {}) => {
  const source = (Array.isArray(dishes) && dishes.length ? dishes : db.listDishes()).filter(Boolean)
  const count = Math.max(2, Math.min(12, Math.floor(num(pairs, 6))))
  if (source.length < count) return null

  const picked = [...source]
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }

  const cards = []
  for (const dish of picked.slice(0, count)) {
    const pairKey = String(dish.code ?? dish.id ?? dish.name)
    for (const copy of [0, 1]) {
      cards.push({
        id: `${pairKey}-${copy}`,
        pairKey,
        name: String(dish.name ?? 'Món ngon'),
        emoji: String(dish.emoji ?? '🍽️'),
        image: String(dish.image ?? ''),
        flipped: false,
        matched: false,
      })
    }
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }

  return { cards, first: null, moves: 0, matches: 0, pairs: count, done: false }
}

/**
 * Lật một thẻ. Trả `event` để giao diện biết phải làm gì:
 * - ignore: thẻ đã lật/matched, hoặc đang có hai thẻ mở — bỏ qua.
 * - first: thẻ đầu tiên của cặp, chờ l tiếp theo.
 * - match: hai thẻ trùng cặp — giữ mở, tăng lượt.
 * - miss: hai thẻ khác nhau — giao diện tự úp lại sau một nhịp.
 */
export const flipMemoryCard = (game, cardId) => {
  if (!game || !Array.isArray(game.cards)) return { game, event: 'ignore' }
  if (game.done) return { game, event: 'ignore' }
  const card = game.cards.find((c) => c.id === cardId)
  if (!card || card.flipped || card.matched) return { game, event: 'ignore' }

  const cards = game.cards.map((c) => (c.id === cardId ? { ...c, flipped: true } : c))

  if (game.first === null) {
    return { game: { ...game, cards, first: cardId }, event: 'first' }
  }

  const firstCard = cards.find((c) => c.id === game.first)
  const moves = game.moves + 1
  if (firstCard && firstCard.pairKey === card.pairKey) {
    const matched = cards.map((c) =>
      c.pairKey === card.pairKey ? { ...c, matched: true, flipped: true } : c,
    )
    const matches = game.matches + 1
    const done = matches >= game.pairs
    return {
      game: { ...game, cards: matched, first: null, moves, matches, done },
      event: 'match',
    }
  }
  return { game: { ...game, cards, first: null, moves }, event: 'miss' }
}

/** Úp lại hai thẻ vừa lật sai sau khi giao diện hiện một nhịp cho khách xem. */
export const closeMemoryPair = (game) => {
  if (!game || !Array.isArray(game.cards)) return game
  const cards = game.cards.map((c) => (c.flipped && !c.matched ? { ...c, flipped: false } : c))
  return { ...game, cards }
}

/** 3 sao: gần như không lật nhầm; 2 sao: chơi ổn; 1 sao: về đích. */
export const memoryStars = (moves, pairs) => {
  const total = Math.max(1, num(pairs, 6))
  const steps = Math.max(total, num(moves, total))
  if (steps <= Math.ceil(total * 1.2)) return 3
  if (steps <= Math.ceil(total * 1.8)) return 2
  return 1
}

/** Quà của màn lật thẻ theo số sao. */
export const memoryReward = (stars) => {
  const level = Math.max(1, Math.min(3, num(stars, 1)))
  return { ...REWARD_POOL.memory[3 - level] }
}

/* ===================== (3) ĐỐ VUI ẨM THỰC ===================== */

/** Bank câu hỏi trắc nghiệm ẩm thực Việt Nam. */
export const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'Phở là món ăn đặc sản của vùng miền nào?',
    options: ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Tây Nguyên'],
    answer: 0,
  },
  {
    id: 'q2',
    prompt: 'Bún bò Huế có nguồn gốc từ đâu?',
    options: ['Hà Nội', 'Huế', 'Đà Nẵng', 'Sài Gòn'],
    answer: 1,
  },
  {
    id: 'q3',
    prompt: 'Cơm tấm là đặc sản của vùng nào?',
    options: ['Bắc Ninh', 'Cần Thơ', 'Sài Gòn (TP.HCM)', 'Đà Lạt'],
    answer: 2,
  },
  {
    id: 'q4',
    prompt: 'Gỏi cuốn (bò bía tươi) thường gồm nhân gì?',
    options: ['Tôm, thịt, bún, rau', 'Chả cá', 'Thịt kho trứng', 'Bánh xèo'],
    answer: 0,
  },
  {
    id: 'q5',
    prompt: 'Bánh mì Việt Nam nổi tiếng thế giới với đặc điểm gì?',
    options: ['Không nhân', 'Vỏ dày cứng', 'Vỏ giòn nhẹ, nhân đa dạng', 'Chỉ ngọt'],
    answer: 2,
  },
  {
    id: 'q6',
    prompt: 'Cà phê sữa đá là thức uống phổ biến của vùng nào?',
    options: ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Cao nguyên'],
    answer: 2,
  },
  {
    id: 'q7',
    prompt: 'Món "bánh xèo" có hình dạng như thế nào?',
    options: ['Bánh hấp tròn', 'Bánh chảo mỏng giòn vàng', 'Bánh nướng nhân ngọt', 'Bánh luộc'],
    answer: 1,
  },
  {
    id: 'q8',
    prompt: 'Nước dùng của món bún riêu thường được nấu từ nguyên liệu chính nào?',
    options: ['Xương heo', 'Cua đồng', 'Gà ác', 'Cá basa'],
    answer: 1,
  },
  {
    id: 'q9',
    prompt: 'Chả giò (spring roll) của Việt Nam được làm bằng gì để cuốn?',
    options: ['Bánh phở', 'Lá chuối', 'Bánh tráng (bánh đa)', 'Rong biển'],
    answer: 2,
  },
  {
    id: 'q10',
    prompt: 'Món tráng miệng "chè" của Việt Nam thường có đặc điểm gì?',
    options: ['Chỉ mặn', 'Ngọt, dùng đá bào hoặc nước cốt dừa', 'Không đường', 'Luôn nóng'],
    answer: 1,
  },
  {
    id: 'q11',
    prompt: 'Món bún chả là đặc sản của thành phố nào?',
    options: ['Hải Phòng', 'Hà Nội', 'Ninh Bình', 'Thanh Hóa'],
    answer: 1,
  },
  {
    id: 'q12',
    prompt: 'Món "phá lấu" của Việt Nam bắt nguồn từ cách nấu nào?',
    options: ['Kho/tầm với gia vị tàu (phiên bản Việt hoá)', 'Ẩm thực Pháp', 'Ẩm thực Nhật Bản', 'Nướng than nguyên con'],
    answer: 0,
  },
]

/** Chọn bộ câu hỏi không trùng, xáo trộn thứ tự. */
export const createQuizSet = ({ bank = QUIZ_QUESTIONS, count = 5, rng = Math.random } = {}) => {
  const valid = (Array.isArray(bank) ? bank : []).filter(
    (q) => q && typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length >= 2 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
  )
  const size = Math.max(1, Math.min(valid.length, Math.floor(num(count, 5))))
  const pool = [...valid]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, size).map((q) => ({ id: q.id, prompt: q.prompt, options: [...q.options], answer: q.answer }))
}

/** Chấm một câu trả lời (chỉ số option). */
export const gradeQuizAnswer = (question, optionIndex) => {
  if (!question) return { correct: false }
  const picked = Math.floor(num(optionIndex, -1))
  return { correct: picked === question.answer, correctIndex: question.answer }
}

/** 4/5 trở lên: khá; 5/5: hoàn hảo; dưới 4: thử lại. */
export const quizScoreTier = (correct, total) => {
  const score = Math.max(0, num(correct))
  const max = Math.max(1, num(total, 1))
  if (score >= max) return { tier: 'perfect', reward: { ...REWARD_POOL.quizPerfect } }
  if (score >= Math.ceil(max * 0.8)) return { tier: 'good', reward: { ...REWARD_POOL.quizGood } }
  if (score >= Math.ceil(max * 0.6)) return { tier: 'pass', reward: { ...REWARD_POOL.quizPass } }
  return { tier: 'fail', reward: null }
}
