import { useEffect, useId, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { formatPostalCode } from '../lib/address'
import { useAddressSuggestions, type AddressSuggestion } from '../hooks/useAddressSuggestions'
import './address-autocomplete.css'

// Layer 3: form orchestration and lookup are owned here, outside shared primitives.
export function AddressAutocomplete({ value, onChange, onBlur, onSelect }: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onSelect: (address: AddressSuggestion) => void
}) {
  const id = useId()
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(-1)
  const [composing, setComposing] = useState(false)
  const optionsRef = useRef<HTMLUListElement>(null)
  const lookup = useAddressSuggestions(value, searching && !composing)
  const open = searching && lookup.suggestions.length > 0
  const activeIndex = open && active < lookup.suggestions.length ? active : -1
  useEffect(() => {
    if (activeIndex >= 0) {
      optionsRef.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [activeIndex])
  function select(address: AddressSuggestion) {
    setSearching(false)
    setActive(-1)
    onSelect(address)
  }
  return (
    <div className="cw-field cw-form-full address-autocomplete">
      <label htmlFor={id}>Street address *</label>
      <input id={id} className="cw-input" required maxLength={200}
        role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={`${id}-status`} autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setSearching(true)
          setActive(-1)
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onBlur={() => { setSearching(false); setActive(-1); onBlur() }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && searching) {
            event.preventDefault()
            event.stopPropagation()
            setSearching(false)
          } else if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            setActive(event.key === 'ArrowDown'
              ? (activeIndex + 1) % lookup.suggestions.length
              : (activeIndex <= 0 ? lookup.suggestions.length : activeIndex) - 1)
          } else if (open && event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault()
            select(lookup.suggestions[activeIndex])
          }
        }} />
      {open && <ul ref={optionsRef} id={`${id}-options`} role="listbox" aria-label="Canadian address suggestions"
        className="address-suggestions">
        {lookup.suggestions.map((address, index) => (
          <li key={address.label} id={`${id}-option-${index}`} role="option"
            aria-label={address.label}
            aria-selected={activeIndex === index}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select(address)}>
            <span className="address-suggestion-icon" aria-hidden="true"><MapPin size={22} strokeWidth={1.8} /></span>
            <span className="address-suggestion-copy">
              <strong>{address.street}</strong>
              <span>{[address.city, [address.province, formatPostalCode(address.postal_code)].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            </span>
          </li>
        ))}
      </ul>}
      <span id={`${id}-status`} role="status" className={open ? 'sr-only' : 'cw-muted'}>
        {lookup.loading ? 'Looking for addresses…'
          : lookup.failed ? 'Suggestions are unavailable right now. You can enter the address manually.'
          : lookup.empty ? 'No matching addresses. Add a city to your search, or enter the address manually.'
          : open ? `${lookup.suggestions.length} ${lookup.suggestions.length === 1 ? 'suggestion' : 'suggestions'}. Use the arrow keys to choose and Enter to select.` : ''}
      </span>
      <small className="cw-muted address-attribution">
        <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>
        {' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </small>
    </div>
  )
}
