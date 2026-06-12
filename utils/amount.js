// Format for UI display (₱12,500.00)
export function formatAmount(value) {
  if (!value) return '₱0.00'

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value))
}

// Format for input typing (12,500)
export function formatAmountInput(value) {
  if (!value) return ''

  const number = Number(value.toString().replace(/,/g, ''))

  return number.toLocaleString('en-PH')
}

// Clean value for DB (remove commas, symbols)
export function parseAmount(value) {
  if (!value) return 0

  return Number(
    value
      .toString()
      .replace(/[₱,]/g, '')
      .trim()
  )
}