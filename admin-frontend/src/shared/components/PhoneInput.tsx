import { useEffect, useId, useRef, useState } from 'react'
import PhoneNumberInput, { type Country } from 'react-phone-number-input/max'
import { getCountryCallingCode } from 'libphonenumber-js/max'
import { normalizePhone, validatePhone } from '@/shared/lib/phone'

// Layer 2: controlled input; no fetching or record-specific behaviour.
function CountrySelect({ value, onChange, options, disabled, ...props }: {
  value?: Country
  onChange: (country?: Country) => void
  options: { value?: Country; label: string; divider?: boolean }[]
  disabled?: boolean
  'aria-label'?: string
}) {
  return <select aria-label={props['aria-label']} value={value ?? ''}
    disabled={disabled} onChange={event => onChange((event.target.value || undefined) as Country | undefined)}
    className="w-32 min-w-0 shrink-0 border border-ink bg-paper px-2 py-2 text-[12px] focus:outline-1 focus:outline-ink">
    {options.filter(option => !option.divider).map(option =>
      <option key={option.value ?? 'international'} value={option.value ?? ''}>
        {option.label}{option.value ? ` +${getCountryCallingCode(option.value)}` : ''}
      </option>,
    )}
  </select>
}

export function PhoneInput({ label, value, onChange, onBlur, required = false,
  inputClassName = '', labelClassName = '', disabled = false }: {
  label: string
  value: string | null | undefined
  onChange: (value: string) => void
  onBlur?: () => void
  required?: boolean
  inputClassName?: string
  labelClassName?: string
  disabled?: boolean
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [touched, setTouched] = useState(false)
  const error = validatePhone(value, required)
  const displayValue = !error ? normalizePhone(value) ?? undefined : value || undefined
  useEffect(() => { root.current?.querySelector('input')?.setCustomValidity(error ?? '') }, [error])
  return <div ref={root} className="flex min-w-0 flex-col gap-2">
    <label htmlFor={id} className={labelClassName}>{label}{required ? ' *' : ''}</label>
    <PhoneNumberInput
      id={id} defaultCountry="CA" value={displayValue}
      onChange={number => onChange(number ?? '')}
      onBlur={() => { setTouched(true); onBlur?.() }}
      onInvalid={() => setTouched(true)}
      countrySelectComponent={CountrySelect}
      countrySelectProps={{ 'aria-label': `${label} country` }}
      numberInputProps={{ className: inputClassName }}
      className="flex min-w-0 gap-2" autoComplete="tel"
      required={required} disabled={disabled}
      aria-invalid={touched && !!error} aria-describedby={touched && error ? `${id}-error` : undefined}
    />
    {touched && error && <p id={`${id}-error`} role="alert" className="text-xs text-orange">{error}</p>}
  </div>
}
