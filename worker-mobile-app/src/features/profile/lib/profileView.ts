import type { AvailabilityEntry, Credential, WeekDay } from '../types';

export const WEEK_DAYS: { key: WeekDay; label: string; short: string }[] = [
  { key: 'SU', label: 'Sunday', short: 'Sun' }, { key: 'MO', label: 'Monday', short: 'Mon' },
  { key: 'TU', label: 'Tuesday', short: 'Tue' }, { key: 'WE', label: 'Wednesday', short: 'Wed' },
  { key: 'TH', label: 'Thursday', short: 'Thu' }, { key: 'FR', label: 'Friday', short: 'Fri' },
  { key: 'SA', label: 'Saturday', short: 'Sat' },
];

export function dayEntries(entries: AvailabilityEntry[], day: WeekDay) {
  return entries.filter(entry => entry.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function availabilityError(entries: AvailabilityEntry[]): string | undefined {
  const time = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
  const seconds = (value: string) => { const [h, m, s = 0] = value.split(':').map(Number); return h * 3600 + m * 60 + s; };
  for (const day of WEEK_DAYS) {
    const windows = dayEntries(entries, day.key);
    for (let i = 0; i < windows.length; i++) {
      const entry = windows[i];
      if (!time.test(entry.start_time) || !time.test(entry.end_time)) return `${day.label}: enter times as HH:MM, such as 08:00 or 17:00.`;
      if (seconds(entry.end_time) <= seconds(entry.start_time)) return `${day.label}: the end time must be after the start. Split overnight availability across two days.`;
      if (i && seconds(entry.start_time) < seconds(windows[i - 1].end_time)) return `${day.label}: time windows cannot overlap.`;
    }
  }
}

export function displayDate(value: string | null) {
  if (!value) return 'Not provided';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function humanize(value: string | null | undefined) {
  if (!value) return 'Not provided';
  return value.replace(/_/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
}

export type DocumentState = 'missing' | 'pending' | 'expired' | 'expiring' | 'current';
export function documentState(credential: Credential | undefined, today = new Date()): DocumentState {
  if (!credential?.file_url) return 'missing';
  if (!credential.verified_at) return 'pending';
  if (!credential.expiry_date) return 'current';
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiry = new Date(`${credential.expiry_date}T00:00:00`);
  if (expiry < start) return 'expired';
  const soon = new Date(start);
  soon.setDate(soon.getDate() + 30);
  return expiry <= soon ? 'expiring' : 'current';
}

export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  missing: 'No document uploaded', pending: 'Awaiting verification', expired: 'Expired',
  expiring: 'Renewal coming up', current: 'Verified',
};

export function documentSummary(credentials: Credential[]) {
  const uploaded = credentials.filter(item => !!item.file_url);
  if (!uploaded.length) return 'View and upload your documents';
  const pending = uploaded.filter(item => documentState(item) === 'pending').length;
  const renew = uploaded.filter(item => ['expired', 'expiring'].includes(documentState(item))).length;
  return [`${uploaded.length} uploaded`, pending ? `${pending} awaiting verification` : '', renew ? `${renew} to renew` : ''].filter(Boolean).join(' · ');
}
