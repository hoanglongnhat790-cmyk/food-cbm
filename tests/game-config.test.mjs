import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { freshModules } from './helpers.mjs'
import * as gameConfig from '../src/game-config.js'

const games = await import('../src/games.js')

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const adminHtml = readFileSync(resolve(root, 'admin.html'), 'utf8')
const adminJs = readFileSync(resolve(root, 'src/admin.js'), 'utf8')
const gamesJs = readFileSync(resolve(root, 'src/games.js'), 'utf8')
const gamesUiJs = readFileSync(resolve(root, 'src/games-ui.js'), 'utf8')

const DAY = 24 * 60 * 60 * 1000

const settings = (overrides = {}) => ({
  enabled: true,
  claimLimitPerDay: 5,
  voucherTtlDays: 7,
  games: {
    scratch: { enabled: true, threshold: 55 },
    memory: { enabled: true, pairs: 6 },
    quiz: { enabled: true, questionCount: 5 },
    ...(overrides.games ?? {}),
  },
  ...overrides,
})

test('cau hinh mac dinh duoc ghi vao dung key localStorage', async () => {
  await freshModules()
  const config = gameConfig.getGameConfig()
  assert.equal(config.enabled, true)
  assert.equal(config.claimLimitPerDay, 5)
  assert.equal(config.voucherTtlDays, 7)
  assert.equal(config.games.scratch.threshold, 55)
  assert.equal(config.games.memory.pairs, 6)
  assert.equal(config.games.quiz.questionCount, 5)
  assert.ok(config.rewards.length >= 10, 'co kho qua mac dinh')
  assert.ok(config.quizQuestions.length >= 5, 'co bank cau hoi mac dinh')
  assert.ok(JSON.parse(localStorage.getItem('cbmfood.gameConfig')), 'key cbmfood.gameConfig phai ton tai')
})

test('luu cau hinh va doc lai sau khi tai trang', async () => {
  await freshModules()
  const saved = gameConfig.saveGameConfig(settings({
    enabled: false,
    claimLimitPerDay: 2,
    voucherTtlDays: 3,
    games: {
      scratch: { enabled: false, threshold: 80 },
      memory: { enabled: true, pairs: 4 },
      quiz: { enabled: false, questionCount: 2 },
    },
  }))
  assert.ok(saved.config, saved.error)
  const reloaded = gameConfig.getGameConfig()
  assert.equal(reloaded.enabled, false)
  assert.equal(reloaded.claimLimitPerDay, 2)
  assert.equal(reloaded.voucherTtlDays, 3)
  assert.deepEqual(reloaded.games, {
    scratch: { enabled: false, threshold: 80 },
    memory: { enabled: true, pairs: 4 },
    quiz: { enabled: false, questionCount: 2 },
  })
})

test('cau hinh sai bi tu choi va khong ghi de cau hinh cu', async () => {
  await freshModules()
  assert.ok(gameConfig.saveGameConfig(settings({ claimLimitPerDay: -1 })).error)
  assert.ok(gameConfig.saveGameConfig(settings({ voucherTtlDays: 0 })).error)
  assert.ok(gameConfig.saveGameConfig(settings({
    games: { scratch: { enabled: true, threshold: 101 }, memory: { enabled: true, pairs: 6 }, quiz: { enabled: true, questionCount: 5 } },
  })).error)
  const config = gameConfig.getGameConfig()
  assert.equal(config.claimLimitPerDay, 5, 'cau hinh cu duoc giu')
  assert.equal(config.games.scratch.threshold, 55)
})

test('bat/tat toan bo va tung game thuc su chan claim', async () => {
  const { store } = await freshModules()
  const prize = gameConfig.listRewards('scratch', { includeInactive: false }).find((reward) => reward.type)

  gameConfig.saveGameConfig({ enabled: false })
  assert.equal(gameConfig.isGameEnabled('scratch'), false)
  const blocked = games.claimGameReward(prize, { game: 'scratch' })
  assert.ok(blocked.error, 'tat toan bo thi khong nhan duoc')
  assert.equal(store.listVouchers().filter((voucher) => voucher.code.startsWith('GAME')).length, 0)

  gameConfig.saveGameConfig({ enabled: true, games: { scratch: { enabled: false } } })
  assert.equal(gameConfig.isGameEnabled('scratch'), false)
  assert.equal(gameConfig.isGameEnabled('memory'), true)
  assert.ok(games.claimGameReward(prize, { game: 'scratch' }).error, 'tat rieng game cao the thi chan')

  gameConfig.saveGameConfig({ games: { scratch: { enabled: true } } })
  assert.equal(gameConfig.isGameEnabled('scratch'), true)
  assert.ok(games.claimGameReward(prize, { game: 'scratch' }).code)
})

test('cau hinh nguong cao the, so cap the va so cau hoi co hieu luc', async () => {
  const { store } = await freshModules()
  gameConfig.saveGameConfig(settings({
    games: {
      scratch: { enabled: true, threshold: 80 },
      memory: { enabled: true, pairs: 3 },
      quiz: { enabled: true, questionCount: 2 },
    },
  }))
  assert.equal(games.scratchThreshold(), 0.8)
  assert.equal(games.scratchRevealed(79, 100), false)
  assert.equal(games.scratchRevealed(80, 100), true)

  const board = games.createMemoryBoard()
  assert.equal(board.cards.length, 6, '3 cap = 6 the')
  assert.equal(board.pairs, 3)

  const quiz = games.createQuizSet()
  assert.equal(quiz.length, 2, 'dung so cau admin cau hinh')
  assert.ok(store.listDishes().length >= 3)
})

test('so luot nhan thuong va han voucher lay tu cau hinh', async () => {
  const { store } = await freshModules()
  gameConfig.saveGameConfig(settings({ claimLimitPerDay: 1, voucherTtlDays: 2 }))
  const prize = gameConfig.getTierReward('memory', '3')
  const now = Date.now()
  const result = games.claimGameReward(prize, { now, game: 'memory' })
  assert.ok(result.code, result.error)
  const voucher = store.findVoucher(result.code)
  assert.ok(voucher.expiresAt >= now + 2 * DAY - 1000, 'han voucher theo cau hinh 2 ngay')
  assert.ok(voucher.expiresAt < now + 3 * DAY, 'khong dung mac dinh 7 ngay')
  assert.equal(result.claimsLeft, 0)
  assert.ok(games.claimGameReward(prize, { now, game: 'memory' }).error, 'het luot cau hinh')
})

test('CRUD phan thuong, bat/tat va validate du lieu', async () => {
  await freshModules()
  const created = gameConfig.createReward({
    game: 'scratch',
    tier: '',
    type: 'fixed',
    label: 'Giảm 30.000đ',
    value: 30000,
    weight: 7,
    minOrder: 120000,
    maxDiscount: 0,
    active: true,
  })
  assert.ok(created.reward, created.error)
  const id = created.reward.id
  assert.equal(gameConfig.findReward(id).value, 30000)

  const updated = gameConfig.updateReward(id, { label: 'Giảm 35.000đ', value: 35000 })
  assert.ok(updated.reward, updated.error)
  assert.equal(gameConfig.findReward(id).label, 'Giảm 35.000đ')

  const off = gameConfig.setRewardActive(id, false)
  assert.ok(off.reward, off.error)
  assert.equal(gameConfig.getRewardPool('scratch').some((reward) => reward.id === id), false, 'tat thi khong vao pool')
  gameConfig.setRewardActive(id, true)
  assert.equal(gameConfig.getRewardPool('scratch').some((reward) => reward.id === id), true)

  assert.ok(gameConfig.deleteReward(id).reward)
  assert.equal(gameConfig.findReward(id), null)

  assert.ok(gameConfig.createReward({ game: 'scratch', label: '', type: 'fixed', value: 1, weight: 1 }).error)
  assert.ok(gameConfig.createReward({ game: 'scratch', label: 'Sai %', type: 'percent', value: 150, weight: 1 }).error)
  assert.ok(gameConfig.createReward({ game: 'scratch', label: 'Sai trong so', type: 'fixed', value: 1, weight: 0 }).error)
  assert.ok(gameConfig.createReward({ game: 'khong-co', label: 'Sai game', type: 'fixed', value: 1, weight: 1 }).error)
  assert.ok(gameConfig.createReward({ game: 'memory', tier: '', label: 'Thieu bac', type: 'fixed', value: 1, weight: 1 }).error)
})

test('qua theo bac (lat the/do vui) boc theo trong so cau hinh', async () => {
  await freshModules()
  const created = gameConfig.createReward({
    game: 'memory',
    tier: '3',
    type: 'fixed',
    label: 'Quà 3 sao kiểm thử',
    value: 50000,
    weight: 9,
  })
  assert.ok(created.reward, created.error)
  const low = gameConfig.getTierReward('memory', '3', { rng: () => 0 })
  const high = gameConfig.getTierReward('memory', '3', { rng: () => 0.95 })
  assert.equal(low.id, created.reward.id, 'roll dau roi vao qua moi co trong so 9')
  assert.equal(high.id, 'm-pct10', 'roll cuoi roi vao qua mac dinh trong so 1')

  gameConfig.setRewardActive(created.reward.id, false)
  const onlyDefault = gameConfig.getTierReward('memory', '3', { rng: () => 0 })
  assert.equal(onlyDefault.id, 'm-pct10', 'qua da tat khong duoc boc')
})

test('bank cau hoi rong khong lam hong bo cau hoi', async () => {
  await freshModules()
  gameConfig.saveGameConfig({ quizQuestions: [] })
  assert.deepEqual(gameConfig.listQuizQuestions(), [])
  assert.deepEqual(games.createQuizSet(), [])
})

test('tat het qua cua mot bac thi game tra null, khong tao qua gia', async () => {
  await freshModules()
  const reward = gameConfig.getTierReward('memory', '3')
  gameConfig.setRewardActive(reward.id, false)
  assert.equal(games.memoryReward(3), null)
  assert.ok(games.memoryReward(2), 'bac 2 van con qua')

  const perfect = gameConfig.getTierReward('quiz', 'perfect')
  gameConfig.setRewardActive(perfect.id, false)
  assert.equal(games.quizScoreTier(5, 5).reward, null)
})

test('CRUD cau hoi quiz va validate dap an', async () => {
  await freshModules()
  const created = gameConfig.createQuizQuestion({
    prompt: 'Món nào là đặc sản Hà Nội?',
    options: ['Bún chả', 'Cơm tấm', 'Bún bò Huế', 'Bánh xèo'],
    answer: 0,
  })
  assert.ok(created.question, created.error)
  const id = created.question.id
  assert.equal(gameConfig.listQuizQuestions().some((question) => question.id === id), true)

  const updated = gameConfig.updateQuizQuestion(id, {
    prompt: 'Món nào là đặc sản Hà Nội (cập nhật)?',
    options: ['Bún chả', 'Phở', 'Cơm tấm'],
    answer: 1,
  })
  assert.ok(updated.question, updated.error)
  assert.equal(gameConfig.findQuizQuestion(id).answer, 1)

  assert.ok(gameConfig.createQuizQuestion({ prompt: '', options: ['A', 'B'], answer: 0 }).error)
  assert.ok(gameConfig.createQuizQuestion({ prompt: 'Thiếu đáp án', options: ['A'], answer: 0 }).error)
  assert.ok(gameConfig.createQuizQuestion({ prompt: 'Đáp án trùng', options: ['A', 'A'], answer: 0 }).error)
  assert.ok(gameConfig.createQuizQuestion({ prompt: 'Sai đáp án', options: ['A', 'B'], answer: 5 }).error)

  assert.ok(gameConfig.deleteQuizQuestion(id).question)
  assert.equal(gameConfig.findQuizQuestion(id), null)
})

test('lich su nhan thuong, tim kiem/loc va thong ke doc du lieu that', async () => {
  const { store } = await freshModules()
  const now = Date.now()
  const liveCode = 'GAMELIVE1'
  const expiredCode = 'GAMEEXP1'
  store.createVoucher({ code: liveCode, type: 'fixed', value: 10000, startsAt: now - 1000, expiresAt: now + DAY, usageLimit: 1, active: true })
  store.createVoucher({ code: expiredCode, type: 'fixed', value: 10000, startsAt: now - 2 * DAY, expiresAt: now - DAY, usageLimit: 1, active: true })

  gameConfig.writeGameRewards([
    { code: liveCode, rewardId: 's-fixed20', label: 'Giảm 10.000đ', type: 'fixed', at: now, game: 'scratch', gameLabel: 'Cào thẻ may mắn' },
    { code: expiredCode, rewardId: 'm-fixed10', label: 'Giảm 10.000đ', type: 'fixed', at: now - 5000, game: 'memory', gameLabel: 'Lật thẻ tìm cặp' },
    { code: 'GAMEMISSING', rewardId: 'q-pct20', label: 'Giảm 20%', type: 'percent', at: now - 8000 },
  ])
  gameConfig.recordGamePlay('scratch', { at: now })
  gameConfig.recordGamePlay('quiz', { at: now })

  const all = gameConfig.listGameHistory()
  assert.equal(all.length, 3)
  assert.equal(all.find((record) => record.code === liveCode).status, 'live')
  assert.equal(all.find((record) => record.code === expiredCode).status, 'expired')
  assert.equal(all.find((record) => record.code === 'GAMEMISSING').status, 'deleted')
  assert.equal(all.find((record) => record.code === 'GAMEMISSING').game, 'quiz', 'suy ra game tu rewardId cu')

  assert.equal(gameConfig.listGameHistory({ query: 'giam 10' }).length, 2)
  assert.equal(gameConfig.listGameHistory({ status: 'expired' }).length, 1)
  assert.equal(gameConfig.listGameHistory({ game: 'memory' }).length, 1)

  const stats = gameConfig.gameStats({ now })
  assert.equal(stats.claims, 3)
  assert.equal(stats.vouchersIssued, 3)
  assert.equal(stats.live, 1)
  assert.equal(stats.expired, 1)
  assert.equal(stats.deleted, 1)
  assert.equal(stats.plays, 2)
  assert.equal(stats.byGame.scratch.claims, 1)
  assert.equal(stats.byGame.memory.claims, 1)
  assert.equal(stats.byGame.quiz.claims, 1)
})

test('khoi phuc cau hinh mac dinh khong xoa lich su', async () => {
  await freshModules()
  gameConfig.saveGameConfig(settings({ enabled: false, claimLimitPerDay: 1 }))
  gameConfig.writeGameRewards([{ code: 'GAMEOLD1', rewardId: 's-pct10', label: 'Giảm 10%', type: 'percent', at: Date.now(), game: 'scratch' }])
  gameConfig.resetGameConfig()
  const config = gameConfig.getGameConfig()
  assert.equal(config.enabled, true)
  assert.equal(config.claimLimitPerDay, 5)
  assert.equal(gameConfig.listGameRewards().length, 1, 'lich su duoc giu')
})

test('admin co menu, du 5 tab va cac thao tac that', () => {
  assert.match(adminHtml, /data-nav="games"/, 'sidebar co muc Mini Game')
  assert.match(adminHtml, /data-view="games"/, 'co view quan ly mini game')
  for (const tab of ['overview', 'config', 'rewards', 'questions', 'history']) {
    assert.match(adminHtml, new RegExp(`data-tab="${tab}"`), `thieu tab ${tab}`)
  }
  assert.match(adminJs, /from '\.\/game-config\.js'/, 'admin dung chung module cau hinh')
  assert.match(adminJs, /game-global-toggle/, 'co bat/tat toan bo')
  assert.match(adminJs, /game-toggle/, 'co bat/tat tung game')
  assert.match(adminJs, /game-reward-new/, 'co them phan thuong')
  assert.match(adminJs, /game-reward-delete/, 'co xoa phan thuong')
  assert.match(adminJs, /game-question-new/, 'co them cau hoi')
  assert.match(adminJs, /game-config-reset-confirm/, 'co xac nhan khoi phuc cau hinh')
  assert.match(adminJs, /game-history-search/, 'co tim kiem lich su')
  assert.match(gamesJs, /gameConfig\.isGameEnabled|isGameEnabled/, 'game chan claim khi bi tat')
  assert.match(gamesUiJs, /isGameEnabled|getGameConfig/, 'giao dien khach doc cau hinh')
})
