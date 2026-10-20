/**
 * Giao diện 3 mini game cho trang bán hàng: cào thẻ may mắn, lật thẻ tìm
 * cặp món ăn thật, đố vui ẩm thực.
 *
 * Toàn bộ logic thuần nằm ở `games.js` (có test Node); file này chỉ lo DOM.
 * Phần thưởng trúng là voucher THẬT do `games.claimGameReward` tạo trong kho,
 * khách bấm "Áp dụng vào giỏ" là `cart.applyVoucher` áp y hệt mã nhập tay.
 */
import * as db from './store.js'
import * as cart from './cart.js'
import * as auth from './auth.js'
import * as games from './games.js'

const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`

const timeText = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* Trạng thái game hiện tại, chỉ sống trong phiên trang. */
const state = {
  tab: 'scratch',
  scratch: null,
  memory: null,
  memoryTimer: null,
  memorySeconds: 0,
  quiz: null,
}

let root = null
let toastFn = () => {}
let refreshCartFn = () => {}

/* ===================== PHẦN THƯỞNG & VOUCHER THẬT ===================== */

/** Áp voucher trúng vào giỏ bằng đúng đường code khách nhập tay dùng. */
const applyRewardToCart = (code) => {
  const result = cart.applyVoucher(code, { userId: auth.getUser()?.id ?? null })
  if (result.error) {
    toastFn(result.error, 'err')
    return false
  }
  refreshCartFn()
  toastFn(`Đã áp ${code} vào giỏ hàng`)
  return true
}

const rewardCodeHtml = (reward) => `
  <div class="reward-pop" role="status">
    <span class="reward-pop-emoji">🎉</span>
    <div class="reward-pop-main">
      <strong>${escape(reward.label)}</strong>
      <code>${escape(reward.code)}</code>
      <small>Hạn dùng tới ${new Date(reward.expiresAt).toLocaleDateString('vi-VN')} · dùng 1 lần duy nhất</small>
    </div>
    <div class="reward-pop-actions">
      <button type="button" class="btn btn-primary btn-sm" data-game-action="apply-reward" data-code="${escape(reward.code)}">Áp dụng vào giỏ</button>
      <button type="button" class="btn btn-outline btn-sm" data-game-action="copy-reward" data-code="${escape(reward.code)}">Sao chép mã</button>
    </div>
  </div>`

/** Bảng tổng hợp voucher trúng: còn hạn / đã dùng / hết hạn đều hiện rõ. */
const renderRewardShelf = () => {
  const shelf = root?.querySelector('#gameRewards')
  if (!shelf) return
  const list = games.listGameRewards()
  if (!list.length) {
    shelf.innerHTML = '<p class="muted">Chưa trúng thưởng — hãy chơi game để nhận voucher thật nhé!</p>'
    return
  }
  shelf.innerHTML = `
    <h3>Voucher đã trúng</h3>
    <div class="reward-shelf">
      ${list
        .map((r) => {
          const live = db.findVoucher(r.code)
          const usedUp = live && live.usageLimit > 0 && live.usedCount >= live.usageLimit
          const expired = live && live.expiresAt > 0 && Date.now() > live.expiresAt
          const status = !live ? 'Đã xoá' : usedUp ? 'Đã dùng' : expired ? 'Hết hạn' : live.active === false ? 'Ngừng hoạt động' : 'Còn dùng'
          const tone = status === 'Còn dùng' ? 'is-live' : 'is-dead'
          return `
            <div class="reward-card ${tone}">
              <code>${escape(r.code)}</code>
              <span>${escape(r.label)}</span>
              <small>${escape(status)} · trúng ${new Date(r.at).toLocaleDateString('vi-VN')}</small>
            </div>`
        })
        .join('')}
    </div>`
}

/* ===================== (1) CÀO THẺ MAY MẮN ===================== */

const scratchPrizeHtml = (prize) => {
  if (!prize || !prize.type) {
    return `<div class="scratch-prize is-blank"><span>🍀</span><p>${escape(prize?.label ?? 'Chúc bạn may mắn lần sau')}</p></div>`
  }
  const detail =
    prize.type === 'percent'
      ? `Giảm ${prize.value}%${prize.maxDiscount ? ` (tối đa ${money(prize.maxDiscount)})` : ''}`
      : prize.type === 'fixed'
        ? `Giảm thẳng ${money(prize.value)}`
        : 'Miễn phí giao hàng'
  return `
    <div class="scratch-prize is-win">
      <span>🎁</span>
      <p class="scratch-prize-title">${escape(prize.label)}</p>
      <p class="scratch-prize-detail">${escape(detail)}${prize.minOrder ? ` · đơn từ ${money(prize.minOrder)}` : ''}</p>
    </div>`
}

const newScratchCard = () => {
  state.scratch = {
    prize: games.pickReward(games.REWARD_POOL.scratch),
    revealed: false,
    claimed: null,
  }
}

const sizeScratchCanvas = (canvas) => {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return false
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.scale(dpr, dpr)
  const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height)
  grad.addColorStop(0, '#c9c2bc')
  grad.addColorStop(0.5, '#a9a29c')
  grad.addColorStop(1, '#c4bcb5')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, rect.width, rect.height)
  ctx.fillStyle = '#6f665f'
  ctx.font = '700 15px inherit'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✨ Cào lớp bạc để mở quà ✨', rect.width / 2, rect.height / 2)
  return true
}

/**
 * Vẽ lại khung cào. Dùng pointer events nên chạy được cả chuột lẫn cảm ứng
 * (điện thoại/máy tính bảng) với cùng một đoạn code.
 */
const bindScratchCanvas = (canvas) => {
  let drawing = false
  const ctx = canvas.getContext('2d')

  const eraseAt = (event) => {
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 20, 0, Math.PI * 2)
    ctx.fill()
  }

  /* Đếm tỉ lệ còn lại của lớp bạc. getImageData một lưới thô cho đủ chính
     xác để quyết định "đủ cào" mà không phải đọc từng pixel. */
  const scratchedRatio = () => {
    if (!ctx) return 0
    const { width, height } = canvas
    if (!width || !height) return 0
    let clear = 0
    let total = 0
    const stepX = Math.max(1, Math.floor(width / 24))
    const stepY = Math.max(1, Math.floor(height / 12))
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        total += 1
        const pixel = ctx.getImageData(x, y, 1, 1).data
        if (pixel[3] < 32) clear += 1
      }
    }
    return total ? clear / total : 0
  }

  const maybeReveal = () => {
    if (!state.scratch || state.scratch.revealed) return
    /* scratchedRatio trả về 0..1, so thẳng với ngưỡng của games.js. */
    if (scratchedRatio() < games.SCRATCH_THRESHOLD) return
    state.scratch.revealed = true
    canvas.hidden = true
    const box = root.querySelector('#scratchResult')
    if (box) box.innerHTML = scratchResultHtml()
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.scratch || state.scratch.revealed) return
    drawing = true
    /* setPointerCapture ném NotFoundError với pointer tổng hợp / một số
       trình duyệt cũ — bọc try/catch để cào vẫn chạy bằng event thường. */
    try {
      canvas.setPointerCapture?.(event.pointerId)
    } catch {
      /* bỏ qua, pointermove vẫn nhận được sự kiện */
    }
    eraseAt(event)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return
    event.preventDefault()
    eraseAt(event)
    maybeReveal()
  })
  const stop = () => {
    drawing = false
    if (state.scratch && !state.scratch.revealed) maybeReveal()
  }
  canvas.addEventListener('pointerup', stop)
  canvas.addEventListener('pointercancel', stop)
  canvas.addEventListener('pointerleave', stop)
}

/** Nội dung khung kết quả: nút nhận mã (nếu được) hoặc mã đã nhận. */
const scratchResultHtml = () => {
  const { prize, claimed } = state.scratch
  if (claimed) return rewardCodeHtml(claimed)
  if (!prize?.type) return ''
  if (games.gameClaimsLeft() <= 0) {
    return '<p class="muted">Hôm nay bạn đã nhận đủ quà, quay lại ngày mai nhé!</p>'
  }
  return '<button type="button" class="btn btn-primary" data-game-action="claim-scratch">Nhận mã thưởng</button>'
}

const renderScratch = (stage) => {
  if (!state.scratch) newScratchCard()
  const revealed = state.scratch.revealed
  stage.innerHTML = `
    <div class="game-panel">
      <p class="game-lead">Cào lớp bạc bằng chuột hoặc ngón tay. Cào đủ ~55% diện tích thì quà mới lộ ra bạn nhé!</p>
      <div class="scratch-card">
        <div class="scratch-prize-layer">${scratchPrizeHtml(state.scratch.prize)}</div>
        ${revealed ? '' : '<canvas class="scratch-canvas" id="scratchCanvas" aria-label="Thẻ cào may mắn"></canvas>'}
      </div>
      <div id="scratchResult" class="scratch-result">${revealed ? scratchResultHtml() : ''}</div>
      <div class="game-foot">
        <button type="button" class="btn btn-outline btn-sm" data-game-action="scratch-new">Thẻ khác</button>
        <span class="muted">Còn ${games.gameClaimsLeft()} lần nhận quà hôm nay</span>
      </div>
    </div>`

  if (revealed) return
  const canvas = stage.querySelector('#scratchCanvas')
  if (!canvas) return
  /* Kích thước theo khung thật (responsive), rồi mới phủ lớp bạc. */
  requestAnimationFrame(() => {
    if (sizeScratchCanvas(canvas)) {
      bindScratchCanvas(canvas)
    } else {
      /* Khung chưa có kích thước (tab vừa mở) — thử lại một nhịp. */
      requestAnimationFrame(() => {
        sizeScratchCanvas(canvas)
        bindScratchCanvas(canvas)
      })
    }
  })
}

/* ===================== (2) LẬP THẺ TÌM CẶP ===================== */

const stopMemoryTimer = () => {
  if (state.memoryTimer) {
    clearInterval(state.memoryTimer)
    state.memoryTimer = null
  }
}

const startMemoryTimer = () => {
  stopMemoryTimer()
  state.memoryTimer = setInterval(() => {
    state.memorySeconds += 1
    const clock = root?.querySelector('#memoryClock')
    if (clock) clock.textContent = timeText(state.memorySeconds)
  }, 1000)
}

const memoryHud = () => `
  <div class="memory-hud">
    <span>Lượt lật: <b id="memoryMoves">0</b></span>
    <span>Thời gian: <b id="memoryClock">00:00</b></span>
    <span>Cặp còn lại: <b id="memoryLeft">0</b></span>
  </div>`

const memoryCardHtml = (card) => `
  <button type="button"
    class="memory-card${card.flipped || card.matched ? ' is-flipped' : ''}${card.matched ? ' is-matched' : ''}"
    data-memory-card="${escape(card.id)}"
    aria-label="${card.flipped || card.matched ? escape(card.name) : 'Thẻ úp'}"
    ${card.matched ? 'disabled' : ''}>
    <span class="memory-card-inner">
      <span class="memory-card-back">❓</span>
      <span class="memory-card-face">${
        card.image
          ? `<img src="${escape(card.image)}" alt="" loading="lazy" />`
          : escape(card.emoji)
      }<em>${escape(card.name)}</em></span>
    </span>
  </button>`

const refreshMemoryHud = () => {
  if (!state.memory || !root) return
  const moves = root.querySelector('#memoryMoves')
  const left = root.querySelector('#memoryLeft')
  if (moves) moves.textContent = String(state.memory.moves)
  if (left) left.textContent = String(state.memory.pairs - state.memory.matches)
}

const finishMemory = (stage) => {
  stopMemoryTimer()
  const stars = games.memoryStars(state.memory.moves, state.memory.pairs)
  const reward = games.memoryReward(stars)
  const box = stage.querySelector('#memoryResult')
  if (!box) return
  const claimable = games.gameClaimsLeft() > 0
  box.innerHTML = `
    <div class="memory-win" role="status">
      <p class="memory-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
      <p>Hoàn thành ${state.memory.pairs} cặp trong <b>${state.memory.moves}</b> lượt · <b>${timeText(state.memorySeconds)}</b></p>
      <p class="muted">Quà an ủi: ${escape(reward.label)}${claimable ? ' — bấm nhận mã bên dưới nhé' : ' (hôm nay bạn đã nhận đủ quà)'}</p>
      ${
        claimable
          ? '<button type="button" class="btn btn-primary" data-game-action="claim-memory">Nhận mã thưởng</button>'
          : ''
      }
    </div>`
  state.memory.pendingReward = reward
}

const renderMemory = (stage) => {
  stopMemoryTimer()
  state.memorySeconds = 0
  state.memory = games.createMemoryBoard({ pairs: 6 })
  if (!state.memory) {
    stage.innerHTML = '<div class="game-panel"><p class="muted">Cần ít nhất 6 món trong thực đơn để chơi game lật thẻ.</p></div>'
    return
  }
  stage.innerHTML = `
    <div class="game-panel">
      <p class="game-lead">Tìm các cặp món ăn giống nhau trong thực đơn CBM FOOD. Ít lượt lật — nhiều sao hơn!</p>
      ${memoryHud()}
      <div class="memory-grid" id="memoryGrid">
        ${state.memory.cards.map(memoryCardHtml).join('')}
      </div>
      <div id="memoryResult" class="memory-result"></div>
      <div class="game-foot">
        <button type="button" class="btn btn-outline btn-sm" data-game-action="memory-new">Chơi lại</button>
      </div>
    </div>`
  refreshMemoryHud()
  startMemoryTimer()
}

const handleMemoryCard = (cardId, stage) => {
  if (!state.memory || state.memory.done) return
  const { game, event } = games.flipMemoryCard(state.memory, cardId)
  state.memory = game
  if (event === 'ignore') return

  const grid = stage.querySelector('#memoryGrid')
  if (grid) grid.innerHTML = state.memory.cards.map(memoryCardHtml).join('')
  refreshMemoryHud()

  if (event === 'miss') {
    /* Hiện hai thẻ sai một nhịp rồi tự úp để khách thấy được pair vừa lỡ. */
    setTimeout(() => {
      if (!state.memory) return
      state.memory = games.closeMemoryPair(state.memory)
      const currentGrid = root?.querySelector('#memoryGrid')
      if (currentGrid && state.memory) currentGrid.innerHTML = state.memory.cards.map(memoryCardHtml).join('')
    }, 700)
    return
  }
  if (state.memory.done) finishMemory(stage)
}

/* ===================== (3) ĐỐ VUI ẨM THỰC ===================== */

const newQuiz = () => {
  state.quiz = {
    questions: games.createQuizSet({ count: 5 }),
    index: 0,
    correct: 0,
    answered: false,
    finished: false,
    rewardTier: null,
    claimed: null,
  }
}

const renderQuiz = (stage) => {
  if (!state.quiz) newQuiz()
  const quiz = state.quiz
  const total = quiz.questions.length
  const current = quiz.questions[quiz.index]

  if (quiz.finished) {
    const { tier, reward } = games.quizScoreTier(quiz.correct, total)
    quiz.rewardTier = reward
    const claimable = Boolean(reward) && games.gameClaimsLeft() > 0
    const verdict =
      tier === 'perfect' ? 'Xuất sắc! Không sai câu nào!' : tier === 'good' ? 'Giỏi lắm! Gần hoàn hảo!' : tier === 'pass' ? 'Được đó, tiếp tục phát huy!' : 'Thêm một lần nữa nhé, bạn làm được!'
    stage.innerHTML = `
      <div class="game-panel">
        <div class="quiz-done" role="status">
          <p class="quiz-score">${quiz.correct}/${total}</p>
          <p><b>${escape(verdict)}</b></p>
          ${reward ? `<p class="muted">Phần thưởng: ${escape(reward.label)}</p>` : '<p class="muted">Chưa đủ điểm nhận thưởng — chơi lại thôi!</p>'}
          ${
            quiz.claimed
              ? rewardCodeHtml(quiz.claimed)
              : claimable
                ? '<button type="button" class="btn btn-primary" data-game-action="claim-quiz">Nhận mã thưởng</button>'
                : reward && !claimable
                  ? '<p class="muted">Hôm nay bạn đã nhận đủ quà, quay lại ngày mai nhé!</p>'
                  : ''
          }
          <button type="button" class="btn btn-outline" data-game-action="quiz-new">Chơi lại</button>
        </div>
      </div>`
    return
  }

  stage.innerHTML = `
    <div class="game-panel">
      <p class="game-lead">Câu ${quiz.index + 1}/${total} · Trả lời đúng để nhận voucher thật</p>
      <div class="quiz-progress"><span style="width:${Math.round((quiz.index / total) * 100)}%"></span></div>
      <div class="quiz-box">
        <p class="quiz-prompt">${escape(current.prompt)}</p>
        <div class="quiz-options">
          ${current.options
            .map((option, i) => {
              let cls = ''
              if (quiz.answered) {
                if (i === current.answer) cls = 'is-correct'
                else if (i === quiz.pickedIndex) cls = 'is-wrong'
              }
              return `<button type="button" class="quiz-option ${cls}" data-game-action="quiz-answer" data-index="${i}" ${quiz.answered ? 'disabled' : ''}>${escape(option)}</button>`
            })
            .join('')}
        </div>
        ${
          quiz.answered
            ? `<div class="quiz-feedback">
                <p class="${quiz.pickedCorrect ? 'is-correct' : 'is-wrong'}">${quiz.pickedCorrect ? 'Chính xác! 🎉' : `Chưa đúng — đáp án: ${escape(current.options[current.answer])}`}</p>
                <button type="button" class="btn btn-primary btn-sm" data-game-action="quiz-next">${quiz.index + 1 >= total ? 'Xem kết quả' : 'Câu tiếp theo'}</button>
              </div>`
            : ''
        }
      </div>
    </div>`
}

/* ===================== KHUNG GAME & TAB ===================== */

const TABS = [
  { id: 'scratch', label: '🃏 Cào thẻ may mắn' },
  { id: 'memory', label: '🔄 Lật thẻ tìm cặp' },
  { id: 'quiz', label: '🧠 Đố vui ẩm thực' },
]

const renderStage = () => {
  if (!root) return
  const stage = root.querySelector('#gameStage')
  if (!stage) return
  root.querySelectorAll('.game-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.gameTab === state.tab)
  })
  if (state.tab === 'scratch') renderScratch(stage)
  else if (state.tab === 'memory') renderMemory(stage)
  else renderQuiz(stage)
  renderRewardShelf()
}

/* ===================== SỰ KIỆN ===================== */

const onGameClick = (event) => {
  const tabBtn = event.target.closest('[data-game-tab]')
  if (tabBtn) {
    stopMemoryTimer()
    state.tab = tabBtn.dataset.gameTab
    renderStage()
    return
  }

  const cardBtn = event.target.closest('[data-memory-card]')
  if (cardBtn) {
    const stage = root.querySelector('#gameStage')
    if (stage) handleMemoryCard(cardBtn.dataset.memoryCard, stage)
    return
  }

  const actionBtn = event.target.closest('[data-game-action]')
  if (!actionBtn) return
  const action = actionBtn.dataset.gameAction
  const stage = root.querySelector('#gameStage')

  if (action === 'scratch-new') {
    newScratchCard()
    renderScratch(stage)
    return
  }
  if (action === 'claim-scratch' && state.scratch) {
    const result = games.claimGameReward(state.scratch.prize)
    if (result.error) return toastFn(result.error, 'err')
    state.scratch.claimed = result
    renderScratch(stage)
    renderRewardShelf()
    return
  }
  if (action === 'memory-new') {
    renderMemory(stage)
    return
  }
  if (action === 'claim-memory' && state.memory?.pendingReward) {
    const result = games.claimGameReward(state.memory.pendingReward)
    if (result.error) return toastFn(result.error, 'err')
    state.memory.pendingReward = null
    const box = stage.querySelector('#memoryResult')
    if (box) box.insertAdjacentHTML('beforeend', rewardCodeHtml(result))
    actionBtn.remove()
    renderRewardShelf()
    return
  }
  if (action === 'quiz-answer' && state.quiz && !state.quiz.answered) {
    const question = state.quiz.questions[state.quiz.index]
    const graded = games.gradeQuizAnswer(question, Number(actionBtn.dataset.index))
    state.quiz.answered = true
    state.quiz.pickedIndex = Number(actionBtn.dataset.index)
    state.quiz.pickedCorrect = graded.correct
    if (graded.correct) state.quiz.correct += 1
    renderQuiz(stage)
    return
  }
  if (action === 'quiz-next' && state.quiz) {
    state.quiz.index += 1
    state.quiz.answered = false
    state.quiz.pickedIndex = null
    state.quiz.pickedCorrect = null
    if (state.quiz.index >= state.quiz.questions.length) state.quiz.finished = true
    renderQuiz(stage)
    return
  }
  if (action === 'quiz-new') {
    newQuiz()
    renderQuiz(stage)
    return
  }
  if (action === 'claim-quiz' && state.quiz) {
    const result = games.claimGameReward(state.quiz.rewardTier)
    if (result.error) return toastFn(result.error, 'err')
    state.quiz.claimed = result
    renderQuiz(stage)
    renderRewardShelf()
    return
  }
  if (action === 'apply-reward') {
    applyRewardToCart(actionBtn.dataset.code)
    return
  }
  if (action === 'copy-reward') {
    const code = String(actionBtn.dataset.code ?? '')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(
        () => toastFn(`Đã sao chép ${code}`),
        () => toastFn('Trình duyệt chặn sao chép, hãy copy thủ công', 'err'),
      )
    } else {
      toastFn(`Mã của bạn: ${code}`)
    }
  }
}

/**
 * Gắn khối game vào trang bán hàng. `toast` và `refreshCart` nhận từ main.js
 * để giữ đúng phong cách thông báo/huy hiệu giỏ hàng đang có.
 */
export const mountGames = ({ container, toast, refreshCart } = {}) => {
  root = container
  toastFn = typeof toast === 'function' ? toast : () => {}
  refreshCartFn = typeof refreshCart === 'function' ? refreshCart : () => {}
  if (!root) return

  root.innerHTML = `
    <div class="game-tabs" role="tablist" aria-label="Mini game">
      ${TABS.map(
        (tab) => `<button type="button" class="game-tab${tab.id === state.tab ? ' is-active' : ''}" role="tab" data-game-tab="${tab.id}" aria-selected="${tab.id === state.tab}">${tab.label}</button>`,
      ).join('')}
    </div>
    <div id="gameStage" class="game-stage"></div>
    <div id="gameRewards" class="game-rewards"></div>`

  root.addEventListener('click', onGameClick)
  renderStage()
}
