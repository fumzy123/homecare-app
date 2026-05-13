import { isValidPhoneNumber, AsYouType } from 'libphonenumber-js'

export function formatPhone(value: string): string {
  if (!value) return value
  // Strip everything except + and digits, then cap at E.164 max (15 digits)
  const digits = value.replace(/[^\d+]/g, '')
  const capped = digits.startsWith('+')
    ? '+' + digits.slice(1).slice(0, 15)
    : digits.slice(0, 15)
  return new AsYouType().input(capped)
}

export function validatePhone(value: string | undefined | null, required = false): string | undefined {
  if (!value || value.trim() === '') {
    return required ? 'Phone number is required' : undefined
  }
  if (!isValidPhoneNumber(value)) {
    return 'Enter a valid number with country code, e.g. +1 604 555 1234'
  }
  return undefined
}
