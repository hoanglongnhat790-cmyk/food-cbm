/**
 * Logic của 3 mini game: cào thẻ may mắn, lật thẻ tìm cặp, đố vui ẩm thực.
 *
 * Module này không đụng tới DOM để chạy được trong test Node. Phần thưởng
 * KHÔNG phải mã giả: `claimGameReward` gọi thẳng `db.createVoucher` nên mã
 * trúng là voucher thật, dùng được ở giỏ hàng/checkout với đầy đủ kiểm tra
 * (hạn dùng, lượt dùng, đơn tối thiểu) mà hệ thống đang có.
 */
import * as db from './store.js'
import * as gameConfig from './game-config.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

/* ===================== KHO PHẦN THƯỞNG ===================== */

/**
 * Mỗi phần thưởng mô tả đúng một voucher thật sẽ được tạo ra khi trúng.
 * `weight` chỉ dùng cho bốc thăm; `type: null` là "không trúng" (vẫn có
 * trong pool để tỉ lệ trúng hợp lý).
 *
 * Đây là getter: admin sửa/bật/tắt phần thưởng trong `cbmfood.gameConfig`
 * thì trang khách đọc được ngay ở lần render kế tiếp, không cần tải lại code.
 */
export const REWARD_POOL = {
  /* Cào thẻ: bốc ngẫu nhiên theo tỉ trọng. */
  get scratch() {
    return gameConfig.getRewardPool('scratch')
  },
  /* Lật thẻ: quà an ủi theo số sao đạt được (3, 2, 1 sao). */
  get memory() {
    return ['3', '2', '1']
      .map((tier) => gameConfig.getTierReward('memory', tier))
      .filter(Boolean)
  },
  /* Đố vui: quà theo bậc điểm. */
  get quizPerfect() {
    return gameConfig.getTierReward('quiz', 'perfect')
  },
  get quizGood() {
    return gameConfig.getTierReward('quiz', 'good')
  },
  get quizPass() {
    return gameConfig.getTierReward('quiz', 'pass')
  },
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

/** Số lần còn được nhận quà game trong hôm nay (theo cấu hình admin). */
export const gameClaimsLeft = (now = Date.now()) => {
  const today = startOfToday(now)
  const used = gameConfig.readGameRewards().filter((r) => num(r.at) >= today).length
  return Math.max(0, gameConfig.claimLimitPerDay() - used)
}

/** Danh sách quà đã trúng (mới nhất trước), kèm nhãn voucher để hiển thị. */
export const listGameRewards = () => gameConfig.listGameRewards()

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
export const claimGameReward = (reward, { rng = Math.random, now = Date.now(), game = null } = {}) => {
  if (!reward || typeof reward !== 'object') return { error: 'Phần thưởng không hợp lệ' }
  const gameId = gameConfig.GAME_IDS.includes(game)
    ? game
    : gameConfig.GAME_IDS.includes(reward.game)
      ? reward.game
      : null
  if (gameId && !gameConfig.isGameEnabled(gameId)) {
    return { error: `Mini game ${gameConfig.GAME_LABELS[gameId]} đang tạm tắt` }
  }
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
      expiresAt: now + gameConfig.voucherTtlMs(),
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
    rewardLabel: String(reward.label ?? db.voucherLabel(created)),
    type: created.type,
    at: now,
    expiresAt: created.expiresAt,
    game: gameId ?? 'unknown',
    gameLabel: gameConfig.GAME_LABELS[gameId ?? 'unknown'],
  }
  gameConfig.recordGameReward(record)

  return {
    code: created.code,
    label: record.label,
    type: created.type,
    minOrder: created.minOrder,
    expiresAt: created.expiresAt,
    claimsLeft: gameClaimsLeft(now),
    game: record.game,
  }
}

/* ===================== (1) CÀO THẺ MAY MẮN ===================== */

/** Tỉ lệ cào tối đa để mở thưởng (mặc định, admin có thể chỉnh). */
export const SCRATCH_THRESHOLD = 0.55

/** Ngưỡng cào đang áp dụng từ cấu hình admin (0..1). */
export const scratchThreshold = () => gameConfig.gameThreshold()

/** Tỉ lệ diện tích đã cào (0..1) từ số ô đã cào trên bàn cờ mô phỏng. */
export const scratchRatio = (scratchedCells, totalCells) => {
  const total = Math.max(0, num(totalCells))
  if (total === 0) return 0
  const scratched = Math.min(total, Math.max(0, num(scratchedCells)))
  return scratched / total
}

/** Mở thưởng khi đã cào đủ; thiếu thì giao diện vẫn đang "cào dở". */
export const scratchRevealed = (scratchedCells, totalCells, threshold = null) =>
  scratchRatio(scratchedCells, totalCells) >= (threshold === null ? scratchThreshold() : threshold)

/* ===================== (2) LẬP THẺ TÌM CẶP ===================== */

/**
 * Tạo bàn lật thẻ từ món ăn THẬT trong kho.
 * Mỗi cặp là một món (tên + emoji/ảnh thật), xáo trộn bằng Fisher–Yates
 * với `rng` nhận vào để test bàn cờ xác định được.
 */
export const createMemoryBoard = ({ dishes = null, pairs = null, rng = Math.random } = {}) => {
  const source = (Array.isArray(dishes) && dishes.length ? dishes : db.listDishes()).filter(Boolean)
  const count = Math.max(2, Math.min(12, Math.floor(num(pairs ?? gameConfig.gamePairCount(), 6))))
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

/** Quà của màn lật thẻ theo số sao; admin tắt hết quà bậc đó thì trả null. */
export const memoryReward = (stars) => {
  const level = Math.max(1, Math.min(3, num(stars, 1)))
  const reward = gameConfig.getTierReward('memory', String(level))
  return reward ? { ...reward } : null
}

/* ===================== (3) ĐỐ VUI ẨM THỰC ===================== */

/** Bank câu hỏi mặc định (bản đang dùng do admin quản lý nằm trong game-config). */
export const QUIZ_QUESTIONS = gameConfig.DEFAULT_GAME_CONFIG.quizQuestions

/** Chọn bộ câu hỏi không trùng, xáo trộn thứ tự. */
export const createQuizSet = ({ bank = null, count = null, rng = Math.random } = {}) => {
  const source = Array.isArray(bank) ? bank : gameConfig.listQuizQuestions()
  const valid = source.filter(
    (q) => q && typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length >= 2 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
  )
  const size = Math.max(1, Math.min(valid.length, Math.floor(num(count ?? gameConfig.gameQuestionCount(), 5))))
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
  if (score >= max) return { tier: 'perfect', reward: gameConfig.getTierReward('quiz', 'perfect') }
  if (score >= Math.ceil(max * 0.8)) return { tier: 'good', reward: gameConfig.getTierReward('quiz', 'good') }
  if (score >= Math.ceil(max * 0.6)) return { tier: 'pass', reward: gameConfig.getTierReward('quiz', 'pass') }
  return { tier: 'fail', reward: null }
}
