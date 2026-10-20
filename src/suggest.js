/**
 * Logic gợi ý món ăn cho trợ lý AI — thuần hàm, không đụng DOM nên test
 * được bằng node --test mà không cần trình duyệt.
 *
 * Nhập vào câu khách gõ + đối tượng db, trả về câu trả lời (HTML trong
 * Markdown thô) kèm danh sách món gợi ý. Không gọi API nào ở ngoài.
 */
import { stripDiacritics } from './search.js'

export const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`
export const fold = (value) => stripDiacritics(value).replace(/\s+/g, ' ').trim()
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const CAT_ICON = {
  'pho-bun': '🍜',
  com: '🍚',
  'banh-mi': '🥖',
  'do-uong': '🧋',
  'an-vat': '🍢',
  combo: '🎁',
}

/* Từ chỉ danh mục: so theo cụm chữ đã bỏ dấu, tránh nhầm "combo" với "cơm". */
const CATEGORY_WORDS = {
  'pho-bun': [['pho'], ['bun'], ['mien'], ['sau cua']],
  com: [['com'], ['xoi'], ['com tam']],
  'banh-mi': [['banh mi'], ['my']],
  'do-uong': [
    ['do uong'], ['ca phe'], ['caphe'], ['tra'], ['sinh to'], ['tra sua'],
    ['nuoc ep'], ['giai khat'], ['giai nhiet'], ['do lanh'],
  ],
  'an-vat': [['an vat'], ['do nhanh'], ['bo kho'], ['trang mieng'], ['snack']],
  combo: [['combo'], ['nhieu nguoi'], ['gia dinh']],
}

/* Từ khoá chung: cộng điểm khi khớp trong tên/mô tả/nguyên liệu của món. */
const STOP_WORDS = new Set([
  'minh', 'toi', 'ban', 'hay', 'giup', 'goi', 'y', 'mon', 'nao', 'nay', 'hom',
  'mot', 'cac', 'khong', 'biet', 'can', 'muon', 'lam', 'vi', 'sao', 'the',
  'nhi', 'nhe', 'di', 'oi', 'vay', 've', 'cho', 'ra', 'nhieu', 'it', 'ngon',
  'dac', 'bat', 'noi', 'trieu', 'gia', 'tien', 'danh', 'giup ich', 'xin',
  'chao', 'cam', 'on', 'ban', 'la', 'ai', 'ten', 'gi', 'tro', 'ly', 'huong',
  'dan', 'cach', 'dung', 'thuc', 'danh sach', 'gioi', 'thieu', 'lien', 'he',
  'nha', 'hang', 'cbm', 'food', 'goi y', 'de cu', 'thich', 'thich gi',
])

const hasPhrase = (haystack, phrase) => haystack.includes(phrase)

/** Nhận diện ý định + bộ lọc từ câu khách gõ. */
const buildPlan = (raw) => {
  const q = fold(raw).toLowerCase()
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean)
  const plan = {
    q,
    cats: [],
    max: null,
    min: null,
    words: [],
    flags: {},
    generic: false,
  }

  for (const [id, phrases] of Object.entries(CATEGORY_WORDS)) {
    if (phrases.some((parts) => parts.every((p) => hasPhrase(q, p)))) plan.cats.push(id)
  }

  /* Giá: "dưới 50k", "trên 100k", "50.000đ". */
  const prices = [
    ...[...q.matchAll(/(\d{2,4})\s*k\b/g)].map((m) => Number(m[1]) * 1000),
    ...[...q.matchAll(/(\d{1,3}(?:\.\d{3})+)/g)].map((m) => Number(m[1].replace(/\./g, ''))),
  ].filter((n) => Number.isFinite(n) && n > 0)

  if (prices.length) {
    if (/\b(duoi|nho hon|tam|khoang|toi da|re hon|ua chon)\b/.test(q)) plan.max = prices[0]
    else if (/\b(tren|tu|lon hon|thieu hon)\b/.test(q)) plan.min = prices[0]
    else plan.max = prices[0]
  }

  if (/\b(re|gia re|re re|hat diam)\b/.test(q) && plan.max === null) plan.max = 50000

  plan.flags.cay = /\bcay\b/.test(q) && !/khong cay|it cay/.test(q)
  plan.flags.ngot = /\bngot\b/.test(q)
  plan.flags.chay = /(an chay|thuc an chay|mon chay)/.test(q)
  plan.flags.giaiKhat = /(giai khat|giai nhiet|khat nuoc|uong something|do lanh)/.test(q)
  plan.flags.sang = /(an sang|sang som|phong san)/.test(q)
  plan.flags.toi = /(an toi|toi nay|bua toi)/.test(q)
  plan.flags.dem = /(dem khuya|nua dem|quan dem)/.test(q)

  if (plan.flags.sang) plan.cats.push('com', 'pho-bun', 'banh-mi')
  if (plan.flags.toi) plan.cats.push('com', 'pho-bun')
  if (plan.flags.dem) plan.cats.push('an-vat', 'combo', 'pho-bun')
  if (plan.flags.giaiKhat && !plan.cats.includes('do-uong')) plan.cats.push('do-uong')
  plan.cats = [...new Set(plan.cats)]

  plan.words = [...new Set(tokens.filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t) && t !== 'k'))]
  plan.generic = /(an gi|khong biet|goi y|de cu|nen an|hoac gi|lua chon)/.test(q) && !plan.cats.length && !plan.words.length
  return plan
}

const scoreDish = (dish, plan, text) => {
  const name = fold(dish.name)
  let score = 0

  if (plan.cats.length) score += plan.cats.includes(dish.category) ? 12 : -6
  if (plan.max !== null) score += dish.price <= plan.max ? 8 : -12
  if (plan.min !== null) score += dish.price >= plan.min ? 8 : -12

  for (const word of plan.words) {
    if (name.includes(word)) score += 7
    else if (text.includes(word)) score += 3
    else score -= 5
  }

  if (plan.flags.cay) score += /\bcay\b/.test(text) ? 10 : -3
  if (plan.flags.ngot) score += /(ngot|banh|che|tra sua|kem)/.test(text) ? 8 : -3
  if (plan.flags.chay) {
    const hasMeat = /(thit|bo |ga |tom|ca |heo|cha)/.test(text)
    score += hasMeat ? -8 : 8
  }

  score += Math.min(3, Number(dish.rating) || 0) / 3
  score += Math.min(1, (Number(dish.ratingCount) || 0) / 2000) * 0.5
  score += Math.min(1, (Number(dish.sold) || 0) / 5000) * 0.4
  return score
}

const categoryLabel = (db, id) => db.CATEGORIES.find((c) => c.id === id)?.name ?? id

const planReasons = (db, plan) => {
  const parts = []
  if (plan.cats.length) parts.push(`danh mục ${plan.cats.map((id) => `<b>${CAT_ICON[id] ?? ''} ${escapeHtml(categoryLabel(db, id))}</b>`).join(', ')}`)
  if (plan.max !== null) parts.push(`giá dưới <b>${money(plan.max)}</b>`)
  if (plan.min !== null) parts.push(`giá từ <b>${money(plan.min)}</b>`)
  if (plan.words.length) parts.push(`từ khoá <b>${escapeHtml(plan.words.join(', '))}</b>`)
  if (plan.flags.cay) parts.push('vị <b>cay</b>')
  if (plan.flags.ngot) parts.push('vị <b>ngọt</b>')
  if (plan.flags.chay) parts.push('<b>ăn chay</b>')
  if (plan.flags.giaiKhat) parts.push('<b>giải khát</b>')
  if (plan.flags.sang) parts.push('bữa <b>sáng</b>')
  if (plan.flags.toi) parts.push('bữa <b>tối</b>')
  if (plan.flags.dem) parts.push('<b>đêm khuya</b>')
  return parts
}

/** Chọn ngẫu nhiên n món trong nhóm điểm cao để mỗi lần hỏi kết quả khác đi. */
const pickVariety = (list, size = 3) => {
  const pool = [...list]
  const out = []
  while (pool.length && out.length < size) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  return out
}

export const dishArt = (dish) =>
  dish.image
    ? `<img src="${escapeHtml(dish.image)}" alt="${escapeHtml(dish.name)}" loading="lazy" />`
    : `<span>${escapeHtml(dish.emoji || '🍽️')}</span>`

const dishCardHtml = (dish, dbName) => `
  <article class="cbm-card">
    <div class="cbm-card-art">${dishArt(dish)}</div>
    <div class="cbm-card-main">
      <h4>${escapeHtml(dish.name)}</h4>
      <p>${escapeHtml(dish.description)}</p>
      <div class="cbm-card-row">
        <b>${money(dish.price)}</b>
        <span>★ ${Number(dish.rating) || 0}</span>
        <span>${CAT_ICON[dish.category] ?? ''} ${escapeHtml(dbName)}</span>
      </div>
      <div class="cbm-card-acts">
        <button type="button" class="cbm-btn is-primary" data-add="${escapeHtml(dish.code)}">Thêm vào giỏ</button>
        <button type="button" class="cbm-btn" data-wheel-dish="${escapeHtml(dish.code)}">🎲 Đưa vào vòng quay</button>
      </div>
    </div>
  </article>`

/**
 * Trả lời một câu của khách.
 * @returns {{text:string, dishes?:object[], wheel?:boolean, chips?:array}}
 */
export const suggest = (raw, db) => {
  const q = fold(raw).toLowerCase()
  const all = db.listActiveDishes()
  const count = all.length

  if (!q) return { text: 'Bạn muốn ăn gì hôm nay? Mình gợi ý giúp nhé!' }

  if (/(vong quay|quay so|quay ngau nhien|quay may man|xo so)/.test(q)) {
    return {
      text: 'Vòng quay đây rồi! Hãy chọn những món bạn thích, rồi bấm <b>QUAY</b> — may mắn sẽ chọn giúp bạn một món.',
      wheel: true,
    }
  }

  if (/^(xin chao|chao|hello|hi|hey|alo)\b/.test(q)) {
    return {
      text: `Xin chào! Mình là <b>trợ lý ẩm thực CBM FOOD</b> 🍊 Thực đơn hiện có <b>${count} món</b>. Bạn đang không biết ăn gì à? Gõ cho mình một chút — ví dụ <i>"phở bò dưới 60k"</i>, <i>"đồ uống giải khát"</i> hay <i>"món cay"</i>.`,
    }
  }

  if (/(ban la ai|ban ten gi|tro ly gi|may la ai)/.test(q)) {
    return {
      text: `Mình là trợ lý AI của <b>CBM FOOD</b>, luôn sẵn sàng gợi ý món ngon dựa trên sở thích, ngân sách và thời điểm của bạn. Thực đơn đang có <b>${count} món</b> để mình tư vấn đấy.`,
    }
  }

  if (/^(cam on|cam on ban|thanks|thank you|tks)\b/.test(q)) {
    return { text: 'Rất vui được giúp bạn! Vẫn còn phân vân thì bấm nút <b>🎲 Vòng quay may mắn</b> nhé.' }
  }

  if (/(huong dan|cach dung|giup minh|lam sao|huong dan su dung)/.test(q)) {
    return {
      text: `Cách dùng rất đơn giản:
        <br>1️⃣ Bạn nói mình thích gì, ví dụ <i>"cơm dưới 50k"</i>, <i>"ăn chay"</i>, <i>"đồ uống"</i>.
        <br>2️⃣ Mình trả về các món kèm giá và nút <b>Thêm vào giỏ</b>.
        <br>3️⃣ Nếu vẫn lưỡng lự, bấm <b>🎲 Vòng quay</b>, chọn các món bạn thích và để quay số quyết định.`,
    }
  }

  if (/(danh sach mon|thuc don|menu|co nhung gi|ban co gi)/.test(q)) {
    const lines = db.CATEGORIES.map((cat) => {
      const total = all.filter((d) => d.category === cat.id).length
      return `${CAT_ICON[cat.id] ?? ''} <b>${escapeHtml(cat.name)}</b> — ${total} món`
    })
    return { text: `Thực đơn của mình gồm:<br>${lines.join('<br>')}` }
  }

  const plan = buildPlan(raw)
  const hasSignal = plan.cats.length || plan.max !== null || plan.min !== null || plan.words.length ||
    plan.flags.cay || plan.flags.ngot || plan.flags.chay || plan.flags.giaiKhat ||
    plan.flags.sang || plan.flags.toi || plan.flags.dem

  const textCache = new Map()
  const textOf = (dish) => {
    if (!textCache.has(dish)) {
      const label = categoryLabel(db, dish.category)
      textCache.set(
        dish,
        fold([dish.name, dish.description, (dish.ingredients || []).join(' '), (dish.tags || []).join(' '), label].join(' ')),
      )
    }
    return textCache.get(dish)
  }

  const ranked = all
    .map((dish) => ({ dish, score: scoreDish(dish, plan, textOf(dish)) }))
    .sort((a, b) => b.score - a.score)

  let picked
  let nearMiss = false
  if (hasSignal) {
    const matched = ranked.filter((row) => row.score > 0).map((row) => row.dish)
    picked = matched.slice(0, 3)
    /* Không món nào khớp đúng điều kiện: đưa 3 món tốt nhất và nói rõ là
       "gần giống" thay vì khẳng định đã lọc đúng như khách yêu cầu. */
    if (!picked.length && ranked.length) {
      picked = ranked.slice(0, 3).map((row) => row.dish)
      nearMiss = true
    }
  } else {
    /* Không có tín hiệu cụ thể: lấy nhóm món điểm cao nhất (đánh giá,
       lượt bán) rồi đảo ngẫu nhiên để mỗi lần hỏi kết quả lại khác đi. */
    picked = pickVariety(ranked.slice(0, 8).map((row) => row.dish))
  }

  if (!picked.length) {
    return {
      text: `Rất tiếc mình chưa tìm thấy món nào khớp với <b>${escapeHtml(raw)}</b>. Bạn thử đổi từ khoá hoặc chọn nhanh bên dưới nhé!`,
    }
  }

  const reasons = planReasons(db, plan)
  const intro = nearMiss
    ? `Mình chưa tìm thấy món nào khớp đúng yêu cầu, đây là ${picked.length} món gần giống nhất:`
    : plan.generic || !reasons.length
      ? ['Để mình đoán nhé! Đây là những món được khách của CBM FOOD yêu thích nhất:', 'Mình nghĩ bạn sẽ thích mấy món này:'][Math.floor(Math.random() * 2)]
      : `Nhận rồi! Mình lọc theo ${reasons.join(' · ')}. Đây là ${picked.length} món hợp với bạn:`

  return {
    text: `${intro}<div class="cbm-cards">${picked
      .map((dish) => dishCardHtml(dish, categoryLabel(db, dish.category)))
      .join('')}</div>
      Bấm <b>Thêm vào giỏ</b> để đặt luôn, hoặc <b>🎲 Đưa vào vòng quay</b> để may mắn quyết định nhé!`,
    dishes: picked,
  }
}
