export function formatPrice(value) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    char =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  )
}

export function formatTime(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateTime(isoString) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}

export function syncScrollLock() {
  const anyOpen = ['#cartDrawer', '#checkoutModal', '#ordersModal', '#authModal'].some(selector =>
    document.querySelector(selector)?.classList.contains('show')
  )
  document.body.classList.toggle('modal-open', anyOpen)
}