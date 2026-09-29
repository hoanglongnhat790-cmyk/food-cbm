import './style.css'
import { startShop } from './shop.js'

function showFatalError(error) {
  console.error('[CBM FOOD] Lỗi khởi động trang:', error)
  const menu = document.querySelector('#menu-grid')
  if (menu && !menu.children.length) {
    menu.innerHTML = `
      <div class="empty-state">
        <p>Không tải được thực đơn. Vui lòng tải lại trang hoặc kiểm tra console để xem chi tiết lỗi.</p>
      </div>`
  }
}

startShop().catch(showFatalError)
