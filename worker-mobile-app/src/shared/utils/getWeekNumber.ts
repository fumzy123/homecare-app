export function getWeekNumber(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  return Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
}
