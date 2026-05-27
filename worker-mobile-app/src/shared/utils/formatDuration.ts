export function formatDuration(startIso: string, endIso: string, format: 'long' | 'short' = 'long'): string {
  const totalMinutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (format === 'short') {
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours}h ${minutes}min`;
}
