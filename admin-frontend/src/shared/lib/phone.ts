import { parsePhoneNumberWithError } from 'libphonenumber-js/max'

const invalidMessage = 'Enter a valid phone number. Include + and the country code for numbers outside Canada.'

function parsePhone(value: string) {
  // Do not extract a number from prose or silently discard an extension.
  if (!/^\+?[0-9\s().-]+$/.test(value.trim())) throw new Error(invalidMessage)
  const phone = parsePhoneNumberWithError(value.trim(), { defaultCountry: 'CA', extract: false })
  if (phone.ext || !phone.isValid()) throw new Error(invalidMessage)
  return phone
}

export function validatePhone(value: string | undefined | null, required = false): string | undefined {
  if (!value?.trim()) return required ? 'Phone number is required' : undefined
  try { parsePhone(value); return undefined } catch { return invalidMessage }
}

/** Canonical API/storage value. Empty optional numbers are explicitly cleared. */
export function normalizePhone(value: string | undefined | null): string | null {
  if (!value?.trim()) return null
  return parsePhone(value).number
}

/** Display helper; keep invalid legacy data visible so an admin can correct it. */
export function formatPhone(value: string): string {
  if (!value) return value
  try { return parsePhone(value).formatInternational() } catch { return value }
}
