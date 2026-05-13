import { isValidPhoneNumber, AsYouType } from 'libphonenumber-js'

export function formatPhone(value: string): string {
  if (!value) return value
  // Auto-prepend +1 if user hasn't typed a country code
  const digits = value.replace(/[^\d+]/g, '')
  const withCode = digits.startsWith('+') ? digits : '+1' + digits
  // Cap at E.164 max (15 digits after the +)
  const capped = '+' + withCode.slice(1).slice(0, 15)
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
