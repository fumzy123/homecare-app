import { isValidPhoneNumber } from 'libphonenumber-js'

export function validatePhone(value: string | undefined | null, required = false): string | undefined {
  if (!value || value.trim() === '') {
    return required ? 'Phone number is required' : undefined
  }
  if (!isValidPhoneNumber(value)) {
    return 'Enter a valid number with country code, e.g. +1 604 555 1234'
  }
  return undefined
}
