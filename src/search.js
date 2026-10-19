/**
 * Logic tìm kiếm món ăn — tách riêng khỏi main.js để test được
 * không cần dựng DOM.
 */

/** Bỏ dấu tiếng Việt để gõ không dấu ("pho bo") vẫn tìm thấy "Phở Bò". */
export const stripDiacritics = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

export const normalizeQuery = (value) => stripDiacritics(value).replace(/\s+/g, ' ')

const categoryLabel = (categories, id) =>
  categories.find((c) => c.id === id)?.name ?? ''

const haystackOf = (dish, categories) =>
  [dish.name, dish.description, (dish.tags ?? []).join(' '), categoryLabel(categories, dish.category)]
    .map(stripDiacritics)
    .join(' ')

export const matchesQuery = (dish, query, categories = []) => {
  const cleaned = normalizeQuery(query)
  if (!cleaned) return true
  const haystack = haystackOf(dish, categories)
  /* Tách từ khoá để "pho bo ga" khớp "Phở Bò Gà". */
  return cleaned.split(' ').every((word) => haystack.includes(word))
}

/**
 * Lọc danh sách món theo danh mục và từ khoá.
 * category = 'all' nghĩa là không lọc theo danh mục.
 */
export const filterDishes = (dishes, { category = 'all', query = '' } = {}, categories = []) => {
  const cleaned = normalizeQuery(query)
  /* Khi đã chọn danh mục thì bỏ tên danh mục khỏi từ khoá tìm.
     Nếu không, gõ "bun" khi đang ở danh mục "Phở & Bún" sẽ ra toàn bộ danh mục. */
  const searchable = category === 'all' ? categories : []

  return dishes.filter((dish) => {
    if (category !== 'all' && dish.category !== category) return false
    if (!cleaned) return true
    const haystack = haystackOf(dish, searchable)
    return cleaned.split(' ').every((word) => haystack.includes(word))
  })
}