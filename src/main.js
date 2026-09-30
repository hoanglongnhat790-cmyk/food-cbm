import './style.css'

const modal = document.getElementById('order-modal')
const form = document.getElementById('order-form')
const dishSelect = document.getElementById('order-dish')
const quantityInput = document.getElementById('order-quantity')
const totalDisplay = document.getElementById('order-total')
const successBox = document.getElementById('order-success')
const openButtons = document.querySelectorAll('[data-open-order]')
const closeButtons = document.querySelectorAll('[data-close-order]')

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

function updateTotal() {
  const selectedOption = dishSelect.options[dishSelect.selectedIndex]
  const unitPrice = Number(selectedOption?.dataset.price || 0)
  const quantity = Math.max(1, Number(quantityInput.value) || 1)
  const total = unitPrice * quantity

  totalDisplay.textContent = formatCurrency(total)
}

function openModal(dishName = 'Phở bò đặc biệt') {
  if (!dishSelect) return

  const existingOption = Array.from(dishSelect.options).find(
    (option) => option.value === dishName,
  )

  if (existingOption) {
    dishSelect.value = dishName
  }

  quantityInput.value = 1
  updateTotal()
  successBox.hidden = true
  successBox.innerHTML = ''
  modal.classList.add('is-open')
  modal.setAttribute('aria-hidden', 'false')
}

function closeModal() {
  modal.classList.remove('is-open')
  modal.setAttribute('aria-hidden', 'true')
}

openButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault()
    const selectedDish = button.dataset.orderDish || 'Phở bò đặc biệt'
    openModal(selectedDish)
  })
})

closeButtons.forEach((button) => {
  button.addEventListener('click', closeModal)
})

dishSelect.addEventListener('change', updateTotal)
quantityInput.addEventListener('input', updateTotal)

form.addEventListener('submit', (event) => {
  event.preventDefault()

  const name = document.getElementById('customer-name').value.trim()
  const phone = document.getElementById('customer-phone').value.trim()
  const address = document.getElementById('customer-address').value.trim()

  if (!name || !phone || !address) {
    successBox.hidden = false
    successBox.innerHTML = '<strong>Vui lòng điền đầy đủ thông tin.</strong><p>Hãy nhập họ tên, số điện thoại và địa chỉ giao hàng.</p>'
    successBox.style.background = '#fff4eb'
    successBox.style.borderColor = 'rgba(232, 84, 45, 0.2)'
    successBox.style.color = '#9c3f1e'
    return
  }

   const selectedOption = dishSelect.options[dishSelect.selectedIndex]
   const finalDish = selectedOption.value
   const quantity = Math.max(1, Number(quantityInput.value) || 1)
   const unitPrice = Number(selectedOption.dataset.price || 0)
   const total = unitPrice * quantity
   const orderId = `CBM-${Date.now().toString().slice(-6)}`

   const order = {
     id: orderId,
     dish: finalDish,
     quantity,
     unitPrice,
     total,
     customerName: name,
     customerPhone: phone,
     customerAddress: address,
     customerNote: document.getElementById('customer-note').value.trim(),
     createdAt: new Date().toISOString(),
   }

   try {
     const stored = localStorage.getItem('cbm_orders')
     const orders = stored ? JSON.parse(stored) : []
     orders.push(order)
     localStorage.setItem('cbm_orders', JSON.stringify(orders))
   } catch (error) {
     console.error('Không thể lưu đơn hàng vào LocalStorage:', error)
   }

   successBox.hidden = false
   successBox.style.background = '#e9f9ee'
   successBox.style.borderColor = 'rgba(47, 158, 99, 0.2)'
   successBox.style.color = '#1d6b43'
   successBox.innerHTML = `
     <strong>Đặt hàng thành công!</strong>
     <p>Mã đơn: <strong>${orderId}</strong></p>
     <p>${quantity} x ${finalDish} • ${formatCurrency(total)}</p>
     <p>Chúng tôi sẽ gọi xác nhận trong 2–5 phút để xác nhận thời gian giao hàng.</p>
   `

   form.reset()
   dishSelect.value = finalDish
   quantityInput.value = 1
   updateTotal()
})

updateTotal()