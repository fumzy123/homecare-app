import type { WorkerNotification } from '../api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function notificationDestination(n: WorkerNotification) {
  if (['shift_assigned', 'shift_updated', 'shift_cancelled'].includes(n.type)) {
    const { shift_id, occurrence_date } = n.payload;
    if (typeof shift_id === 'string' && uuid.test(shift_id) && validDate(occurrence_date)) {
      return { pathname: '/shifts/[shiftId]' as const,
        params: { shiftId: shift_id, occurrenceDate: occurrence_date, source: 'notifications' } };
    }
    return { pathname: '/notifications/schedule' as const };
  }
  if (n.type === 'placement_filled') return { pathname: '/notifications/schedule' as const };
  if (['placement_created', 'placement_closed', 'placement_coverage_updated'].includes(n.type)) {
    const id = n.payload.placement_id;
    if (typeof id === 'string' && uuid.test(id)) {
      return { pathname: '/placements/[id]' as const, params: { id } };
    }
  }
  return null;
}
