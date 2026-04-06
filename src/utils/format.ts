export function formatCurrency(value: number | null, currencyCode: string) {
  if (value === null || Number.isNaN(value)) {
    return '--'
  }

  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatCompactCurrency(value: number | null, currencyCode: string) {
  if (value === null || Number.isNaN(value)) {
    return '--'
  }

  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

export function toInputDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
