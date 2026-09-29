import './style.css'
import { startShop } from './shop.js'

startShop().catch((error) => {
  console.error('[CBM FOOD] Không khởi tạo được cửa hàng:', error)
})
