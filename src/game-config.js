/**
 * Cấu hình Mini Game dùng chung cho trang khách và trang quản trị.
 *
 * Dữ liệu được lưu trong localStorage để phù hợp với kiến trúc demo hiện tại:
 * - `cbmfood.gameConfig`   : bật/tắt game, giới hạn lượt, hạn voucher, kho quà,
 *                            bank câu hỏi do admin chỉnh.
 * - `cbmfood.gameRewards`  : lịch sử nhận thưởng (giữ tương thích dữ liệu cũ).
 * - `cbmfood.gamePlays`    : lượt bắt đầu chơi, dùng cho dashboard thật.
 *
 * Module này KHÔNG tự tạo số liệu. Mọi thống kê đều đọc từ lịch sử và kho
 * voucher thật của `store.js`.
 *
 * GIỚI HẠN ĐỒNG BỘ: localStorage chỉ thuộc một trình duyệt/hồ sơ trình duyệt.
 * Cùng một máy, hai tab có thể đồng bộ qua sự kiện `storage`; khác trình duyệt,
 * khác máy hoặc chế độ ẩn danh sẽ có cấu hình/lịch sử riêng. Muốn đồng bộ
 * nhiều máy cần backend + tài khoản quản trị thật.
 */
import * as db from './store.js'

export const GAME_CONFIG_KEY = 'cbmfood.gameConfig'
export const GAME_REWARDS_KEY = 'cbmfood.gameRewards'
export const GAME_PLAYS_KEY = 'cbmfood.gamePlays'

export const GAME_IDS = ['scratch', 'memory', 'quiz']

export const GAME_LABELS = {
  scratch: 'Cào thẻ may mắn',
  memory: 'Lật thẻ tìm cặp',
  quiz: 'Đố vui ẩm thực',
  unknown: 'Không xác định',
}

export const GAME_ICONS = {
  scratch: '🃏',
  memory: '🔄',
  quiz: '🧠',
  unknown: '❓',
}

export const REWARD_TYPE_LABELS = {
  percent: 'Giảm theo %',
  fixed: 'Giảm số tiền',
  freeship: 'Miễn phí vận chuyển',
  none: 'Không trúng thưởng',
}

export const TIER_LABELS = {
  memory: {
    3: '3 sao',
    2: '2 sao',
    1: '1 sao',
  },
  quiz: {
    perfect: 'Xuất sắc (đúng tất cả)',
    good: 'Khá (từ 80%)',
    pass: 'Đạt (từ 60%)',
  },
}

const DAY = 24 * 60 * 60 * 1000
const HISTORY_LIMIT = 300
const PLAY_LIMIT = 500

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

const str = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback)

const clampInt = (value, min, max, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

/* ===================== CẤU HÌNH MẶC ĐỊNH ===================== */

const DEFAULT_QUIZ_QUESTIONS = [
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

const DEFAULT_REWARDS = [
  { id: 's-freeship', game: 'scratch', tier: '', type: 'freeship', value: 0, maxDiscount: 0, minOrder: 80000, weight: 25, label: 'Miễn phí giao hàng', active: true },
  { id: 's-pct10', game: 'scratch', tier: '', type: 'percent', value: 10, maxDiscount: 30000, minOrder: 100000, weight: 22, label: 'Giảm 10%', active: true },
  { id: 's-fixed20', game: 'scratch', tier: '', type: 'fixed', value: 20000, maxDiscount: 0, minOrder: 150000, weight: 18, label: 'Giảm 20.000đ', active: true },
  { id: 's-pct20', game: 'scratch', tier: '', type: 'percent', value: 20, maxDiscount: 50000, minOrder: 200000, weight: 8, label: 'Giảm 20%', active: true },
  { id: 's-fixed50', game: 'scratch', tier: '', type: 'fixed', value: 50000, maxDiscount: 0, minOrder: 300000, weight: 5, label: 'Giảm 50.000đ', active: true },
  { id: 's-none', game: 'scratch', tier: '', type: null, value: 0, maxDiscount: 0, minOrder: 0, weight: 22, label: 'Chúc bạn may mắn lần sau', active: true },

  { id: 'm-pct10', game: 'memory', tier: '3', type: 'percent', value: 10, maxDiscount: 30000, minOrder: 100000, weight: 1, label: 'Giảm 10%', active: true },
  { id: 'm-freeship', game: 'memory', tier: '2', type: 'freeship', value: 0, maxDiscount: 0, minOrder: 60000, weight: 1, label: 'Miễn phí giao hàng', active: true },
  { id: 'm-fixed10', game: 'memory', tier: '1', type: 'fixed', value: 10000, maxDiscount: 0, minOrder: 80000, weight: 1, label: 'Giảm 10.000đ', active: true },

  { id: 'q-pct20', game: 'quiz', tier: 'perfect', type: 'percent', value: 20, maxDiscount: 50000, minOrder: 150000, weight: 1, label: 'Giảm 20%', active: true },
  { id: 'q-pct10', game: 'quiz', tier: 'good', type: 'percent', value: 10, maxDiscount: 30000, minOrder: 100000, weight: 1, label: 'Giảm 10%', active: true },
  { id: 'q-freeship', game: 'quiz', tier: 'pass', type: 'freeship', value: 0, maxDiscount: 0, minOrder: 50000, weight: 1, label: 'Miễn phí giao hàng', active: true },
]

export const DEFAULT_GAME_CONFIG = {
  enabled: true,
  claimLimitPerDay: 5,
  voucherTtlDays: 7,
  games: {
    scratch: { enabled: true, threshold: 55 },
    memory: { enabled: true, pairs: 6 },
    quiz: { enabled: true, questionCount: 5 },
  },
  rewards: DEFAULT_REWARDS,
  quizQuestions: DEFAULT_QUIZ_QUESTIONS,
}

const defaultConfig = () => clone(DEFAULT_GAME_CONFIG)

/* ===================== CHUẨN HOÁ CẤU HÌNH ===================== */

const normalizeType = (value) => {
  if (value === 'none' || value === null || value === '' || typeof value === 'undefined') return null
  return ['percent', 'fixed', 'freeship'].includes(value) ? value : null
}

const inferGameFromId = (id) => {
  const value = str(id)
  if (value.startsWith('s-')) return 'scratch'
  if (value.startsWith('m-')) return 'memory'
  if (value.startsWith('q-')) return 'quiz'
  return 'unknown'
}

const defaultTierFor = (game) => {
  if (game === 'memory') return '3'
  if (game === 'quiz') return 'perfect'
  return ''
}

const normalizeTier = (game, tier) => {
  if (game === 'memory') return ['3', '2', '1'].includes(String(tier)) ? String(tier) : '3'
  if (game === 'quiz') return ['perfect', 'good', 'pass'].includes(String(tier)) ? String(tier) : 'perfect'
  return ''
}

const normalizeReward = (raw, index = 0) => {
  if (!raw || typeof raw !== 'object') return null
  const game = GAME_IDS.includes(raw.game) ? raw.game : inferGameFromId(raw.id)
  if (!GAME_IDS.includes(game)) return null
  const type = normalizeType(raw.type)
  const label = str(raw.label)
  if (!label) return null
  return {
    id: str(raw.id) || `reward-${game}-${index}`,
    game,
    tier: normalizeTier(game, raw.tier),
    type,
    value: type === 'percent' || type === 'fixed' ? num(raw.value) : 0,
    maxDiscount: type === 'percent' ? num(raw.maxDiscount) : 0,
    minOrder: num(raw.minOrder),
    weight: Math.max(0, num(raw.weight, 1)),
    label,
    active: raw.active !== false,
  }
}

const normalizeQuestion = (raw, index = 0) => {
  if (!raw || typeof raw !== 'object') return null
  const prompt = str(raw.prompt)
  const options = Array.isArray(raw.options)
    ? raw.options.map((option) => str(option)).filter(Boolean).slice(0, 6)
    : []
  const answer = Math.floor(Number(raw.answer))
  if (!prompt || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return null
  }
  return {
    id: str(raw.id) || `q-${Date.now()}-${index}`,
    prompt,
    options,
    answer,
  }
}

const normalizeGameRules = (raw = {}, fallback = DEFAULT_GAME_CONFIG.games) => ({
  scratch: {
    enabled: raw?.scratch?.enabled !== false,
    threshold: clampInt(raw?.scratch?.threshold ?? fallback.scratch.threshold, 5, 100, fallback.scratch.threshold),
  },
  memory: {
    enabled: raw?.memory?.enabled !== false,
    pairs: clampInt(raw?.memory?.pairs ?? fallback.memory.pairs, 2, 12, fallback.memory.pairs),
  },
  quiz: {
    enabled: raw?.quiz?.enabled !== false,
    questionCount: clampInt(raw?.quiz?.questionCount ?? fallback.quiz.questionCount, 1, 50, fallback.quiz.questionCount),
  },
})

const normalizeConfig = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {}
  const rewards = Array.isArray(source.rewards)
    ? source.rewards.map(normalizeReward).filter(Boolean)
    : clone(DEFAULT_REWARDS)
  const quizQuestions = Array.isArray(source.quizQuestions)
    ? source.quizQuestions.map(normalizeQuestion).filter(Boolean)
    : clone(DEFAULT_QUIZ_QUESTIONS)
  return {
    enabled: source.enabled !== false,
    claimLimitPerDay: clampInt(source.claimLimitPerDay, 0, 100, DEFAULT_GAME_CONFIG.claimLimitPerDay),
    voucherTtlDays: clampInt(source.voucherTtlDays, 1, 365, DEFAULT_GAME_CONFIG.voucherTtlDays),
    games: normalizeGameRules(source.games),
    rewards,
    quizQuestions,
  }
}

const writeConfig = (config) => {
  const normalized = normalizeConfig(config)
  write(GAME_CONFIG_KEY, normalized)
  return clone(normalized)
}

/** Đọc cấu hình hiện tại. Lần đầu chưa có key thì ghi cấu hình mặc định. */
export const getGameConfig = () => {
  const stored = read(GAME_CONFIG_KEY, null)
  if (!stored || typeof stored !== 'object') {
    return writeConfig(defaultConfig())
  }
  return normalizeConfig(stored)
}

const mutateConfig = (fn) => {
  const current = getGameConfig()
  const next = fn(clone(current)) || current
  return writeConfig(next)
}

const mergedConfigInput = (input = {}) => {
  const current = getGameConfig()
  return {
    ...current,
    ...input,
    games: {
      ...current.games,
      ...(input.games && typeof input.games === 'object' ? input.games : {}),
      scratch: { ...current.games.scratch, ...(input.games?.scratch ?? {}) },
      memory: { ...current.games.memory, ...(input.games?.memory ?? {}) },
      quiz: { ...current.games.quiz, ...(input.games?.quiz ?? {}) },
    },
    rewards: Array.isArray(input.rewards) ? input.rewards : current.rewards,
    quizQuestions: Array.isArray(input.quizQuestions) ? input.quizQuestions : current.quizQuestions,
  }
}

export const validateGameConfig = (input = {}) => {
  if (!input || typeof input !== 'object') return 'Cấu hình không hợp lệ'
  if (typeof input.enabled !== 'boolean') return 'Trạng thái mini game không hợp lệ'
  if (!Number.isInteger(Number(input.claimLimitPerDay)) || Number(input.claimLimitPerDay) < 0 || Number(input.claimLimitPerDay) > 100) {
    return 'Số lượt nhận thưởng mỗi ngày phải từ 0 đến 100'
  }
  if (!Number.isInteger(Number(input.voucherTtlDays)) || Number(input.voucherTtlDays) < 1 || Number(input.voucherTtlDays) > 365) {
    return 'Hạn sử dụng voucher phải từ 1 đến 365 ngày'
  }
  const games = input.games
  if (!games || typeof games !== 'object') return 'Thiếu cấu hình từng game'
  for (const id of GAME_IDS) {
    if (!games[id] || typeof games[id] !== 'object' || typeof games[id].enabled !== 'boolean') {
      return `Cấu hình ${GAME_LABELS[id]} không hợp lệ`
    }
  }
  if (!Number.isInteger(Number(games.scratch.threshold)) || Number(games.scratch.threshold) < 5 || Number(games.scratch.threshold) > 100) {
    return 'Ngưỡng cào thẻ phải từ 5% đến 100%'
  }
  if (!Number.isInteger(Number(games.memory.pairs)) || Number(games.memory.pairs) < 2 || Number(games.memory.pairs) > 12) {
    return 'Số cặp thẻ phải từ 2 đến 12'
  }
  if (!Number.isInteger(Number(games.quiz.questionCount)) || Number(games.quiz.questionCount) < 1 || Number(games.quiz.questionCount) > 50) {
    return 'Số câu hỏi quiz phải từ 1 đến 50'
  }
  return null
}

/** Lưu cấu hình (merge với cấu hình đang có). */
export const saveGameConfig = (input = {}) => {
  try {
    const merged = mergedConfigInput(input)
    const error = validateGameConfig(merged)
    if (error) return { error }
    return { config: writeConfig(merged) }
  } catch {
    return { error: 'Không lưu được cấu hình' }
  }
}

/** Khôi phục cấu hình mặc định. Lịch sử/voucher đã phát KHÔNG bị xoá. */
export const resetGameConfig = () => writeConfig(defaultConfig())

export const isGameEnabled = (gameId) => {
  if (!GAME_IDS.includes(gameId)) return false
  const config = getGameConfig()
  return config.enabled && config.games[gameId].enabled
}

export const gameThreshold = () => getGameConfig().games.scratch.threshold / 100
export const gamePairCount = () => getGameConfig().games.memory.pairs
export const gameQuestionCount = () => getGameConfig().games.quiz.questionCount
export const claimLimitPerDay = () => getGameConfig().claimLimitPerDay
export const voucherTtlMs = () => getGameConfig().voucherTtlDays * DAY

/* ===================== PHẦN THƯỞNG ===================== */

export const listRewards = (game = null, { includeInactive = true } = {}) => {
  const rewards = getGameConfig().rewards
  return rewards
    .filter((reward) => (!game || reward.game === game) && (includeInactive || reward.active))
    .map((reward) => ({ ...reward }))
}

export const findReward = (id) => {
  const reward = getGameConfig().rewards.find((item) => item.id === id)
  return reward ? { ...reward } : null
}

/** Pool đang bật của một game. `tier` dùng cho lật thẻ/quiz. */
export const getRewardPool = (game, tier = null) => {
  const normalizedTier = tier === null || typeof tier === 'undefined' ? null : String(tier)
  return listRewards(game, { includeInactive: false }).filter(
    (reward) => normalizedTier === null || reward.tier === normalizedTier,
  )
}

const pickWeighted = (list, rng = Math.random) => {
  if (!list.length) return null
  const total = list.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0)
  if (total <= 0) return { ...list[0] }
  let roll = rng() * total
  for (const item of list) {
    roll -= Math.max(0, Number(item.weight) || 0)
    if (roll < 0) return { ...item }
  }
  return { ...list[list.length - 1] }
}

/** Bốc phần thưởng theo bậc và trọng số; admin tắt hết thì trả null. */
export const getTierReward = (game, tier, { rng = Math.random } = {}) =>
  pickWeighted(getRewardPool(game, tier), rng)

export const validateRewardInput = (input = {}) => {
  if (!input || typeof input !== 'object') return 'Dữ liệu phần thưởng không hợp lệ'
  const game = input.game
  if (!GAME_IDS.includes(game)) return 'Vui lòng chọn game áp dụng'
  if (game === 'memory' && !['3', '2', '1'].includes(String(input.tier))) {
    return 'Vui lòng chọn bậc sao cho phần thưởng'
  }
  if (game === 'quiz' && !['perfect', 'good', 'pass'].includes(String(input.tier))) {
    return 'Vui lòng chọn mức điểm cho phần thưởng'
  }
  const type = normalizeType(input.type)
  if (input.type !== 'none' && input.type !== null && input.type !== '' && typeof input.type !== 'undefined' && !type) {
    return 'Loại phần thưởng không hợp lệ'
  }
  if (!str(input.label)) return 'Vui lòng nhập tên phần thưởng'
  if (str(input.label).length > 80) return 'Tên phần thưởng tối đa 80 ký tự'
  const value = Number(input.value)
  if (type === 'percent') {
    if (!Number.isFinite(value) || value <= 0 || value > 100) return 'Mức giảm % phải lớn hơn 0 và không vượt quá 100'
  }
  if (type === 'fixed' && (!Number.isFinite(value) || value <= 0)) {
    return 'Số tiền giảm phải lớn hơn 0'
  }
  if (input.maxDiscount !== undefined && input.maxDiscount !== '' && (!Number.isFinite(Number(input.maxDiscount)) || Number(input.maxDiscount) < 0)) {
    return 'Mức giảm tối đa không hợp lệ'
  }
  if (input.minOrder !== undefined && input.minOrder !== '' && (!Number.isFinite(Number(input.minOrder)) || Number(input.minOrder) < 0)) {
    return 'Đơn hàng tối thiểu không hợp lệ'
  }
  const weight = Number(input.weight)
  if (!Number.isFinite(weight) || weight <= 0) return 'Trọng số trúng thưởng phải lớn hơn 0'
  if (weight > 1000000) return 'Trọng số trúng thưởng quá lớn'
  return null
}

const newRewardId = (game) => `g-${game}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`

export const createReward = (input = {}) => {
  const error = validateRewardInput(input)
  if (error) return { error }
  const reward = normalizeReward({ ...input, id: input.id || newRewardId(input.game) })
  if (!reward) return { error: 'Không tạo được phần thưởng' }
  mutateConfig((config) => ({ ...config, rewards: [reward, ...config.rewards] }))
  return { reward }
}

export const updateReward = (id, input = {}) => {
  const current = findReward(id)
  if (!current) return { error: 'Không tìm thấy phần thưởng' }
  const merged = { ...current, ...input, id: current.id }
  const error = validateRewardInput(merged)
  if (error) return { error }
  const reward = normalizeReward(merged)
  if (!reward) return { error: 'Dữ liệu phần thưởng không hợp lệ' }
  mutateConfig((config) => ({
    ...config,
    rewards: config.rewards.map((item) => (item.id === id ? reward : item)),
  }))
  return { reward }
}

export const setRewardActive = (id, active) => {
  const current = findReward(id)
  if (!current) return { error: 'Không tìm thấy phần thưởng' }
  mutateConfig((config) => ({
    ...config,
    rewards: config.rewards.map((item) => (item.id === id ? { ...item, active: Boolean(active) } : item)),
  }))
  return { reward: { ...current, active: Boolean(active) } }
}

export const deleteReward = (id) => {
  const current = findReward(id)
  if (!current) return { error: 'Không tìm thấy phần thưởng' }
  mutateConfig((config) => ({
    ...config,
    rewards: config.rewards.filter((item) => item.id !== id),
  }))
  return { reward: current }
}

/* ===================== CÂU HỎI QUIZ ===================== */

export const listQuizQuestions = () => getGameConfig().quizQuestions.map((question) => ({
  ...question,
  options: [...question.options],
}))

export const findQuizQuestion = (id) => {
  const question = getGameConfig().quizQuestions.find((item) => item.id === id)
  return question ? { ...question, options: [...question.options] } : null
}

export const validateQuestionInput = (input = {}) => {
  if (!input || typeof input !== 'object') return 'Dữ liệu câu hỏi không hợp lệ'
  const prompt = str(input.prompt)
  if (!prompt) return 'Vui lòng nhập nội dung câu hỏi'
  if (prompt.length > 500) return 'Nội dung câu hỏi tối đa 500 ký tự'
  const options = Array.isArray(input.options) ? input.options.map((option) => str(option)) : []
  if (options.length < 2) return 'Câu hỏi phải có ít nhất 2 đáp án'
  if (options.length > 6) return 'Câu hỏi tối đa 6 đáp án'
  if (options.some((option) => !option)) return 'Đáp án không được để trống'
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    return 'Các đáp án không được trùng nhau'
  }
  const answer = Number(input.answer)
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return 'Vui lòng chọn một đáp án đúng'
  }
  return null
}

export const createQuizQuestion = (input = {}) => {
  const error = validateQuestionInput(input)
  if (error) return { error }
  const question = normalizeQuestion({
    ...input,
    id: input.id || `q-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`,
  })
  if (!question) return { error: 'Không tạo được câu hỏi' }
  mutateConfig((config) => ({ ...config, quizQuestions: [...config.quizQuestions, question] }))
  return { question }
}

export const updateQuizQuestion = (id, input = {}) => {
  const current = findQuizQuestion(id)
  if (!current) return { error: 'Không tìm thấy câu hỏi' }
  const merged = { ...current, ...input, id: current.id }
  const error = validateQuestionInput(merged)
  if (error) return { error }
  const question = normalizeQuestion(merged)
  if (!question) return { error: 'Dữ liệu câu hỏi không hợp lệ' }
  mutateConfig((config) => ({
    ...config,
    quizQuestions: config.quizQuestions.map((item) => (item.id === id ? question : item)),
  }))
  return { question }
}

export const deleteQuizQuestion = (id) => {
  const current = findQuizQuestion(id)
  if (!current) return { error: 'Không tìm thấy câu hỏi' }
  mutateConfig((config) => ({
    ...config,
    quizQuestions: config.quizQuestions.filter((item) => item.id !== id),
  }))
  return { question: current }
}

/* ===================== LỊCH SỬ & THỐNG KÊ ===================== */

export const readGameRewards = () => {
  const value = read(GAME_REWARDS_KEY, [])
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

export const writeGameRewards = (list) => {
  const trimmed = (Array.isArray(list) ? list : []).filter((item) => item && typeof item === 'object').slice(0, HISTORY_LIMIT)
  return write(GAME_REWARDS_KEY, trimmed)
}

export const recordGameReward = (record) => {
  if (!record || typeof record !== 'object') return false
  return writeGameRewards([record, ...readGameRewards()])
}

export const listGameRewards = () => readGameRewards()
  .slice()
  .sort((a, b) => num(b.at) - num(a.at))
  .map((item) => ({ ...item }))

export const readGamePlays = () => {
  const value = read(GAME_PLAYS_KEY, [])
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

export const recordGamePlay = (gameId, { outcome = 'started', at = Date.now() } = {}) => {
  if (!GAME_IDS.includes(gameId)) return false
  const next = [{ game: gameId, outcome: str(outcome, 'started'), at: num(at, Date.now()) }, ...readGamePlays()].slice(0, PLAY_LIMIT)
  return write(GAME_PLAYS_KEY, next)
}

export const voucherStatusOf = (voucher, now = Date.now()) => {
  if (!voucher) return 'deleted'
  if (!voucher.active) return 'inactive'
  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) return 'used'
  if (voucher.expiresAt && now > voucher.expiresAt) return 'expired'
  if (voucher.startsAt && now < voucher.startsAt) return 'scheduled'
  return 'live'
}

export const VOUCHER_STATUS_META = {
  live: { label: 'Còn hạn', tone: 'ok' },
  used: { label: 'Đã sử dụng', tone: 'info' },
  expired: { label: 'Hết hạn', tone: 'off' },
  scheduled: { label: 'Chưa tới hạn', tone: 'warn' },
  inactive: { label: 'Đã tắt', tone: 'off' },
  deleted: { label: 'Đã xoá', tone: 'off' },
}

export const gameOfReward = (record) => {
  if (!record) return 'unknown'
  if (GAME_IDS.includes(record.game)) return record.game
  return inferGameFromId(record.rewardId ?? record.id)
}

const enrichHistoryRecord = (record, now = Date.now()) => {
  const game = gameOfReward(record)
  const voucher = db.findVoucher(record.code)
  const status = voucherStatusOf(voucher, now)
  const meta = VOUCHER_STATUS_META[status]
  return {
    ...record,
    game,
    gameLabel: GAME_LABELS[game] ?? GAME_LABELS.unknown,
    status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    voucher,
  }
}

export const listGameHistory = ({ query = '', status = 'all', game = 'all', now = Date.now() } = {}) => {
  const words = str(query)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  return listGameRewards()
    .map((record) => enrichHistoryRecord(record, now))
    .filter((record) => {
      if (status !== 'all' && record.status !== status) return false
      if (game !== 'all' && record.game !== game) return false
      if (!words.length) return true
      const haystack = str(`${record.code} ${record.label} ${record.gameLabel}`)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return words.every((word) => haystack.includes(word))
    })
}

export const gameStats = ({ now = Date.now() } = {}) => {
  const history = listGameRewards().map((record) => enrichHistoryRecord(record, now))
  const plays = readGamePlays()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const stats = {
    claims: history.length,
    plays: plays.length,
    vouchersIssued: history.length,
    todayClaims: history.filter((record) => num(record.at) >= today.getTime()).length,
    live: 0,
    used: 0,
    expired: 0,
    scheduled: 0,
    inactive: 0,
    deleted: 0,
    byGame: {},
    now,
  }
  for (const id of [...GAME_IDS, 'unknown']) {
    stats.byGame[id] = { claims: 0, live: 0, used: 0, expired: 0 }
  }
  for (const record of history) {
    if (Object.prototype.hasOwnProperty.call(stats, record.status)) stats[record.status] += 1
    if (!stats.byGame[record.game]) stats.byGame[record.game] = { claims: 0, live: 0, used: 0, expired: 0 }
    stats.byGame[record.game].claims += 1
    if (['live', 'used', 'expired'].includes(record.status)) stats.byGame[record.game][record.status] += 1
  }
  stats.wins = stats.claims
  stats.winRate = stats.plays > 0 ? stats.claims / stats.plays : 0
  return stats
}
