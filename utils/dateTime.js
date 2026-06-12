import { formatInTimeZone } from 'date-fns-tz'

export const APP_TIMEZONE = 'Asia/Manila'

export function formatPHDateTime(value) {
  if (!value) return ''

  return formatInTimeZone(
    value,
    APP_TIMEZONE,
    'MMM d, yyyy h:mm a'
  )
}

export function getPHDate(value) {
  return formatInTimeZone(value, APP_TIMEZONE, 'yyyy-MM-dd')
}

export function getPHTime(value) {
  return formatInTimeZone(value, APP_TIMEZONE, 'HH:mm')
}