type CsvValue = string | number | null | undefined

// Spreadsheet-facing CSV, not a lossless machine-import format. An apostrophe
// marks potentially executable text as literal text on initial import. Re-saving
// CSV in another application can remove that protection; CSV has no cell types.
// https://owasp.org/www-community/attacks/CSV_Injection
function csvCell(value: CsvValue): string {
  let text = value == null ? '' : String(value)
  // eslint-disable-next-line no-control-regex -- Detect control characters hiding a formula prefix in user-entered text.
  if (typeof value === 'string' && (/^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/u.test(text))) {
    text = `'${text}`
  }
  return `"${text.replaceAll('"', '""')}"`
}

export function serializeCsv(rows: readonly (readonly CsvValue[])[]): string {
  // BOM helps Excel recognize accented names as UTF-8. CRLF separates records;
  // quoted fields retain their own commas, quotes, and embedded line breaks.
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
