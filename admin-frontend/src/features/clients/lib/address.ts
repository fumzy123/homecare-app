// Format complete Canadian postal codes without changing other address values.
export function formatPostalCode(value: string): string {
  const compact = value.replace(/\s/g, '').toUpperCase()
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)
    ? `${compact.slice(0, 3)} ${compact.slice(3)}`
    : value.trim()
}
