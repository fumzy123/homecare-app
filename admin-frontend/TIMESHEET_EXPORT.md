# Timesheet CSV export

The export retains its existing seven columns, filename, dates/times, and hours
calculation. Hours are derived from scheduled shift durations; cancelled visits
and no-shows remain zero. This change does not add verification of hours worked.

`buildTimesheetCsv` creates the document; `shared/lib/csv.ts` quotes every field,
doubles embedded quotes, and writes UTF-8 with a BOM and CRLF record separators.
Names containing commas, quotes, line breaks, and non-ASCII characters remain in
one cell. Null/undefined values become empty cells.

Potentially executable text receives a leading apostrophe, including formula
prefixes hidden behind whitespace/control characters and full-width variants.
This intentionally changes the exported text for those values, not the stored
record. Numeric values supplied as numbers remain numeric. This CSV is intended
for spreadsheet viewing: a downstream machine importer may see the apostrophe.

CSV cannot encode cell types. Spreadsheet applications can remove protections
when saving/reopening files; this is not a universal safety guarantee for every
application or round trip. See [OWASP CSV Injection guidance](https://owasp.org/www-community/attacks/CSV_Injection).

Run `node scripts/verify-timesheet-csv.mjs` from this directory with the existing
backend virtual environment available. It parses the generated output through
Python's standard CSV reader, checks special characters and formula-like values,
and exercises the download wrapper with browser APIs stubbed. TypeScript, lint,
and production build also pass. Actual Excel/Google Sheets/browser interaction
has not been verified in this step.
