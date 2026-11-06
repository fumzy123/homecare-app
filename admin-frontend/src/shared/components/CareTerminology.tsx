import { createContext, useContext } from 'react'

// Presentation context only. Internal Shift types, API paths and data stay unchanged.
export const CareTerminology = createContext<'shift' | 'visit'>('visit')
export function useCareTerminology() {
  const term = useContext(CareTerminology)
  return (message: string) => message.replace(/\b(visits?|shifts?)\b/gi, word => {
    const result = term + (word.toLowerCase().endsWith('s') ? 's' : '')
    return /^[A-Z]/.test(word) ? result[0].toUpperCase() + result.slice(1) : result
  })
}
