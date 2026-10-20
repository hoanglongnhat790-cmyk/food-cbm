import './assistant.css'
import { suggest, money, fold, escapeHtml, dishArt, CAT_ICON } from './suggest.js'

const WHEEL_KEY = 'cbmfood.wheel.picks'

const BASE_CHIPS = [
  { label: '🍽️ Hôm nay ăn gì?', ask: 'Hôm nay mình nên ăn gì?' },
  { label: '💸 Dưới 50.000đ', ask: 'Gợi ý món dưới 50k' },
  { label: '🌶️ Món cay', ask: 'Món gì cay cay?' },
  { label: '🧋 Đồ uống', ask: 'Gợi ý đồ uống giải khát' },
  { label: '🍢 Ăn vặt', ask: 'Món ăn vặt nào ngon?' },
  { label: '🎲 Vòng quay may mắn', wheel: true },
]

/* =======================================================================
   Giao diện
   ======================================================================= */

export function initAssistant({ db, cart, toast, onCartChange }) {
  const root = document.createElement('div')
  root.className = 'cbm-ai-root'
  root.innerHTML = `
    <button type="button" class="cbm-fab" id="cbmFab" aria-expanded="false" aria-controls="cbmPanel">
      <span class="cbm-fab-icon" aria-hidden="true">🍽️</span>
      <span class="cbm-fab-text">Không biết ăn gì?<b>Hỏi AI</b></span>
      <span class="cbm-fab-dot" aria-hidden="true"></span>
    </button>

    <section class="cbm-panel" id="cbmPanel" role="dialog" aria-label="Trợ lý ẩm thực CBM" hidden>
      <header class="cbm-head">
        <span class="cbm-avatar" aria-hidden="true">🤖</span>
        <div class="cbm-head-text">
          <strong>Trợ lý ẩm thực CBM</strong>
          <small>● Trực tuyến · Gợi ý từ ${db.listActiveDishes().length} món trong thực đơn</small>
        </div>
        <button type="button" class="cbm-head-btn" id="cbmWheelBtn" title="Vòng quay may mắn" aria-label="Mở vòng quay may mắn">🎲</button>
        <button type="button" class="cbm-head-btn" id="cbmClose" title="Đóng" aria-label="Đóng khung chat">✕</button>
      </header>

      <div class="cbm-msgs" id="cbmMsgs" aria-live="polite"></div>

      <div class="cbm-chips" id="cbmChips"></div>

      <form class="cbm-input" id="cbmForm">
        <input id="cbmText" autocomplete="off" placeholder="Ví dụ: phở bò dưới 60k..." aria-label="Nhập câu hỏi" />
        <button type="submit" class="cbm-send" aria-label="Gửi câu hỏi">Gửi</button>
      </form>
    </section>

    <div class="cbm-wheel" id="cbmWheel" hidden>
      <div class="cbm-wheel-backdrop" data-wheel-close="1"></div>
      <div class="cbm-wheel-box" role="dialog" aria-modal="true" aria-label="Vòng quay may mắn">
        <header class="cbm-wheel-head">
          <div>
            <h3>🎲 Vòng quay may mắn</h3>
            <p>Chọn các món bạn thích, bấm QUAY để may mắn chọn giúp bạn một món.</p>
          </div>
          <button type="button" class="cbm-x" data-wheel-close="1" aria-label="Đóng vòng quay">✕</button>
        </header>

        <div class="cbm-wheel-grid">
          <div class="cbm-wheel-stage">
            <div class="cbm-wheel-dial">
              <div class="cbm-wheel-rotor" id="cbmRotor"><canvas id="cbmCanvas"></canvas></div>
              <span class="cbm-wheel-needle" aria-hidden="true">▼</span>
              <button type="button" class="cbm-wheel-hub" id="cbmSpin">QUAY</button>
            </div>
            <p class="cbm-wheel-count" id="cbmCount" role="status" aria-live="polite"></p>
          </div>

          <div class="cbm-wheel-picks">
            <input type="search" id="cbmWheelSearch" placeholder="Tìm món để thêm vào vòng quay..." aria-label="Tìm món" />
            <div class="cbm-wheel-tools">
              <button type="button" data-preset="best">Bán chạy</button>
              <button type="button" data-preset="cheap">Dưới 50k</button>
              <button type="button" data-preset="all">Tất cả</button>
              <button type="button" data-preset="none">Xoá chọn</button>
            </div>
            <ul class="cbm-wheel-list" id="cbmList"></ul>
          </div>
        </div>

        <div class="cbm-win" id="cbmWin" hidden></div>
      </div>
    </div>`

  document.body.append(root)

  const $ = (sel) => root.querySelector(sel)
  const panel = $('#cbmPanel')
  const fab = $('#cbmFab')
  const msgs = $('#cbmMsgs')
  const chipsBox = $('#cbmChips')
  const form = $('#cbmForm')
  const input = $('#cbmText')
  const wheelBox = $('#cbmWheel')
  const rotor = $('#cbmRotor')
  const canvas = $('#cbmCanvas')
  const spinBtn = $('#cbmSpin')
  const listEl = $('#cbmList')
  const searchEl = $('#cbmWheelSearch')
  const countEl = $('#cbmCount')
  const winEl = $('#cbmWin')

  let picks = loadPicks()
  let rotation = 0
  let spinning = false
  let wheelFilter = ''
  let prevOverflow = ''

  function loadPicks() {
    try {
      const saved = JSON.parse(localStorage.getItem(WHEEL_KEY) || '[]')
      return Array.isArray(saved) ? saved.map(String) : []
    } catch {
      return []
    }
  }

  const savePicks = () => {
    try {
      localStorage.setItem(WHEEL_KEY, JSON.stringify(picks))
    } catch {
      /* localStorage đầy hoặc bị chặn thì vòng quay vẫn chạy trong phiên này. */
    }
  }

  /** Chỉ giữ món còn đang bán, tránh vòng quay trúng món admin đã xoá. */
  const validPicks = () => {
    const alive = new Set(db.listActiveDishes().map((d) => d.code))
    return picks.filter((code) => alive.has(code))
  }

  const addToCart = (code) => {
    const result = cart.add(code, 1)
    const dish = db.findDish(code)
    if (result.error) {
      const name = dish?.name ?? 'món này'
      const msg = result.error === 'sold-out'
        ? `${name} đã hết hàng`
        : result.error === 'unavailable'
          ? `${name} đang tạm ngưng`
          : result.error === 'over-stock'
            ? `Chỉ còn ${result.ceiling} phần ${name}`
            : `Không thêm được ${name}`
      toast(msg, 'err')
      return false
    }
    onCartChange?.()
    toast(`Đã thêm ${dish?.name ?? 'món'} vào giỏ`)
    return true
  }

  /* ------------------------- Chat ------------------------- */

  const scrollMsgs = () => {
    msgs.scrollTop = msgs.scrollHeight
  }

  const pushUser = (text) => {
    const node = document.createElement('div')
    node.className = 'cbm-msg is-user'
    node.innerHTML = `<div class="cbm-bubble">${escapeHtml(text)}</div>`
    msgs.append(node)
    scrollMsgs()
  }

  const pushBot = (html) => {
    const node = document.createElement('div')
    node.className = 'cbm-msg is-bot'
    node.innerHTML = `<span class="cbm-ava" aria-hidden="true">🤖</span><div class="cbm-bubble">${html}</div>`
    msgs.append(node)
    scrollMsgs()
    return node
  }

  const renderChips = (chips = BASE_CHIPS) => {
    chipsBox.innerHTML = chips
      .map((chip) =>
        chip.wheel
          ? `<button type="button" class="cbm-chip" data-chip-wheel="1">${escapeHtml(chip.label)}</button>`
          : `<button type="button" class="cbm-chip" data-chip-ask="${escapeHtml(chip.ask)}">${escapeHtml(chip.label)}</button>`,
      )
      .join('')
  }

  const respond = (text) => {
    pushUser(text)
    const typing = document.createElement('div')
    typing.className = 'cbm-msg is-bot cbm-typing'
    typing.innerHTML = '<span class="cbm-ava" aria-hidden="true">🤖</span><div class="cbm-bubble"><i></i><i></i><i></i></div>'
    msgs.append(typing)
    scrollMsgs()

    setTimeout(() => {
      typing.remove()
      const reply = suggest(text, db)
      pushBot(reply.text)
      if (reply.wheel) openWheel()
    }, 420 + Math.random() * 380)
  }

  const openChat = () => {
    panel.hidden = false
    fab.setAttribute('aria-expanded', 'true')
    root.classList.add('is-open')
    if (!msgs.childElementCount) {
      pushBot(
        `Xin chào! Mình là <b>trợ lý món ăn của CBM FOOD</b> 🍊<br>
         Thực đơn hiện có <b>${db.listActiveDishes().length} món</b>. Bạn không biết hôm nay ăn gì? Hãy nói mình biết bạn thích gì, hoặc bấm <b>🎲 Vòng quay may mắn</b> để may mắn quyết định.`,
      )
      renderChips()
    }
    input.focus()
  }

  const closeChat = () => {
    panel.hidden = true
    root.classList.remove('is-open')
    fab.setAttribute('aria-expanded', 'false')
  }

  /* ------------------------- Vòng quay ------------------------- */

  const wheelDishes = () => validPicks().map((code) => db.findDish(code)).filter(Boolean)

  const renderCount = () => {
    const n = wheelDishes().length
    countEl.textContent = n
      ? `Đã chọn ${n} món${n < 2 ? ' · cần ít nhất 2 món để quay' : ''}`
      : 'Chưa chọn món nào · hãy chọn ít nhất 2 món bạn thích'
    spinBtn.disabled = spinning || n < 2
  }

  const renderList = () => {
    const keyword = fold(wheelFilter)
    const chosen = new Set(picks)
    const rows = db
      .listActiveDishes()
      .filter((d) => !keyword || fold(`${d.name} ${d.description}`).includes(keyword))
    listEl.innerHTML = rows.length
      ? rows
          .map(
            (d) => `
        <li>
          <label class="cbm-pick${chosen.has(d.code) ? ' is-on' : ''}">
            <input type="checkbox" value="${escapeHtml(d.code)}" ${chosen.has(d.code) ? 'checked' : ''} />
            <span class="cbm-pick-name">${CAT_ICON[d.category] ?? ''} ${escapeHtml(d.name)}</span>
            <b>${money(d.price)}</b>
          </label>
        </li>`,
          )
          .join('')
      : '<li class="cbm-pick-empty">Không tìm thấy món nào.</li>'
  }

  const COLORS = ['#e8542d', '#ff8a5c', '#2f9e63', '#ffb74d', '#c4401f', '#59b37a', '#ff7043', '#7cb342']

  const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

  const drawWheel = () => {
    const dishes = wheelDishes()
    const box = canvas.parentElement
    const size = Math.max(220, Math.min(420, box.clientWidth || 320))
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 7

    ctx.beginPath()
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffd9c9'
    ctx.stroke()

    if (dishes.length < 2) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = '#fdeee7'
      ctx.fill()
      ctx.fillStyle = '#c4401f'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `800 ${Math.round(size * 0.06)}px system-ui, sans-serif`
      ctx.fillText('CHỌN ÍT NHẤT 2 MÓN', cx, cy - size * 0.04)
      ctx.font = `600 ${Math.round(size * 0.045)}px system-ui, sans-serif`
      ctx.fillStyle = '#6b625c'
      ctx.fillText('để vòng quay hoạt động', cx, cy + size * 0.045)
      return
    }

    const seg = 360 / dishes.length
    dishes.forEach((dish, i) => {
      const start = ((i * seg - 90) * Math.PI) / 180
      const end = (((i + 1) * seg - 90) * Math.PI) / 180
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,255,255,.92)'
      ctx.stroke()
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    dishes.forEach((dish, i) => {
      const mid = i * seg + seg / 2
      const flip = mid > 180
      const maxChars = seg >= 34 ? 16 : seg >= 20 ? 11 : 8
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(((flip ? mid + 180 : mid) * Math.PI) / 180)
      ctx.font = `800 ${seg >= 26 ? 14 : 12}px system-ui, sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,.4)'
      ctx.shadowBlur = 3
      ctx.fillText(truncate(dish.name, maxChars), flip ? -r * 0.58 : r * 0.58, 0)
      ctx.restore()
    })

    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.115, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffe3d6'
    ctx.stroke()
    ctx.fillStyle = '#e8542d'
    ctx.font = `900 ${Math.round(size * 0.05)}px system-ui, sans-serif`
    ctx.fillText('CBM', cx, cy - size * 0.022)
    ctx.font = `800 ${Math.round(size * 0.035)}px system-ui, sans-serif`
    ctx.fillStyle = '#2f9e63'
    ctx.fillText('MAY MẮN', cx, cy + size * 0.03)
  }

  const refreshWheel = () => {
    renderList()
    renderCount()
    drawWheel()
  }

  const openWheel = (seedCodes) => {
    if (Array.isArray(seedCodes) && seedCodes.length) {
      picks = [...new Set([...picks, ...seedCodes])].slice(0, 24)
      savePicks()
    }
    if (!validPicks().length) {
      /* Chưa chọn gì: chọn sẵn giúp khách 6 món bán chạy để vòng quay luôn chạy được. */
      const best = db
        .listActiveDishes()
        .sort((a, b) => (b.sold || 0) + (b.rating || 0) * 100 - ((a.sold || 0) + (a.rating || 0) * 100))
        .slice(0, 6)
      picks = best.map((d) => d.code)
      savePicks()
    }
    wheelFilter = ''
    searchEl.value = ''
    winEl.hidden = true
    winEl.innerHTML = ''
    prevOverflow = document.body.style.overflow
    wheelBox.hidden = false
    document.body.style.overflow = 'hidden'
    refreshWheel()
  }

  const closeWheel = () => {
    if (spinning) return
    wheelBox.hidden = true
    document.body.style.overflow = prevOverflow
  }

  const finishSpin = (winner) => {
    spinning = false
    spinBtn.textContent = 'QUAY'
    renderCount()
    if (!winner) return
    winEl.innerHTML = `
      <div class="cbm-win-art">${dishArt(winner)}</div>
      <div class="cbm-win-main">
        <small>🎉 May mắn đã chọn</small>
        <h4>${escapeHtml(winner.name)}</h4>
        <p>${escapeHtml(winner.description)}</p>
        <div class="cbm-card-row"><b>${money(winner.price)}</b><span>★ ${Number(winner.rating) || 0}</span></div>
      </div>
      <div class="cbm-win-acts">
        <button type="button" class="cbm-btn is-primary" data-win-add="${escapeHtml(winner.code)}">Thêm vào giỏ</button>
        <button type="button" class="cbm-btn" data-win-again="1">🎲 Quay tiếp</button>
      </div>`
    winEl.hidden = false
  }

  const spin = () => {
    const dishes = wheelDishes()
    if (spinning || dishes.length < 2) {
      if (dishes.length < 2) toast('Hãy chọn ít nhất 2 món để quay nhé', 'err')
      return
    }
    winEl.hidden = true
    winEl.innerHTML = ''
    spinning = true
    spinBtn.disabled = true
    spinBtn.textContent = 'ĐANG QUAY'

    const winnerIndex = Math.floor(Math.random() * dishes.length)
    const seg = 360 / dishes.length
    /* Con trỏ nằm ở góc 0° (phía trên); xoay để tâm ô trúng ngay nó. */
    const centerDeg = winnerIndex * seg + seg / 2
    const want = ((360 - (centerDeg % 360)) % 360 + 360) % 360
    const current = ((rotation % 360) + 360) % 360
    const delta = ((want - current) % 360 + 360) % 360
    rotation += 360 * 7 + delta

    rotor.style.transition = 'transform 4.2s cubic-bezier(.12,.85,.18,1)'
    rotor.style.transform = `rotate(${rotation}deg)`
    setTimeout(() => finishSpin(dishes[winnerIndex]), 4400)
  }

  /* ------------------------- Sự kiện ------------------------- */

  fab.addEventListener('click', () => (panel.hidden ? openChat() : closeChat()))
  $('#cbmClose').addEventListener('click', closeChat)
  $('#cbmWheelBtn').addEventListener('click', () => openWheel())

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    respond(text)
  })

  chipsBox.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chip-ask],[data-chip-wheel]')
    if (!chip) return
    if (chip.dataset.chipWheel !== undefined) return openWheel()
    respond(chip.dataset.chipAsk)
  })

  /* Nút "Thêm vào giỏ" trong chat dùng data-add: main.js xử lý sẵn trên
     document nên KHÔNG được bắt lại ở đây, nếu không món sẽ bị thêm 2 lần. */
  root.addEventListener('click', (event) => {
    const wheelDish = event.target.closest('[data-wheel-dish]')
    if (wheelDish) {
      openWheel([wheelDish.dataset.wheelDish])
      return
    }
    if (event.target.closest('[data-wheel-close]')) return closeWheel()

    const winAdd = event.target.closest('[data-win-add]')
    if (winAdd) return addToCart(winAdd.dataset.winAdd)

    if (event.target.closest('[data-win-again]')) return spin()

    const preset = event.target.closest('[data-preset]')
    if (preset) {
      const all = db.listActiveDishes()
      if (preset.dataset.preset === 'none') picks = []
      if (preset.dataset.preset === 'all') picks = all.map((d) => d.code)
      if (preset.dataset.preset === 'cheap') picks = all.filter((d) => d.price <= 50000).map((d) => d.code)
      if (preset.dataset.preset === 'best') {
        picks = all
          .slice()
          .sort((a, b) => (b.sold || 0) - (a.sold || 0))
          .slice(0, 6)
          .map((d) => d.code)
      }
      savePicks()
      winEl.hidden = true
      refreshWheel()
    }
  })

  spinBtn.addEventListener('click', spin)

  listEl.addEventListener('change', (event) => {
    const box = event.target.closest('input[type="checkbox"]')
    if (!box) return
    const code = box.value
    if (box.checked) {
      if (!picks.includes(code)) picks.push(code)
    } else {
      picks = picks.filter((c) => c !== code)
    }
    savePicks()
    box.closest('.cbm-pick')?.classList.toggle('is-on', box.checked)
    renderCount()
    drawWheel()
    winEl.hidden = true
  })

  searchEl.addEventListener('input', () => {
    wheelFilter = searchEl.value
    renderList()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (!wheelBox.hidden) {
      closeWheel()
      return
    }
    if (!panel.hidden) closeChat()
  })

  let resizeTimer = 0
  window.addEventListener('resize', () => {
    if (wheelBox.hidden) return
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(drawWheel, 150)
  })

  renderChips()
  return { openChat, closeChat, openWheel }
}

