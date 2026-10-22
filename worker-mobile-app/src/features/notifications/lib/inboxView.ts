import type { WorkerNotification } from '../api';
import type { WorkerShiftDetail } from '@/features/shifts/types';
import { notificationDestination } from './notificationDestination';

export type InboxFilter = 'all' | 'unread';
export const inboxGroups = ['Today', 'Yesterday', 'Earlier'] as const;
export type InboxGroup = typeof inboxGroups[number];
const labels: Record<string, { title: string; description: string; icon: 'calendar-outline' | 'time-outline' | 'close-circle-outline' | 'briefcase-outline' | 'checkmark-circle-outline' | 'notifications-outline' }> = {
  shift_assigned: { title: 'New visit assigned', description: 'Your agency assigned you a visit.', icon: 'calendar-outline' },
  shift_updated: { title: 'Schedule updated', description: 'Your agency changed your scheduled care.', icon: 'time-outline' },
  shift_cancelled: { title: 'Visit cancelled', description: 'Care has been removed from your schedule.', icon: 'close-circle-outline' },
  placement_created: { title: 'New care request', description: 'Your agency has care available. Review the request.', icon: 'briefcase-outline' },
  placement_filled: { title: 'Care assignment approved', description: 'Your agency approved your care assignment.', icon: 'checkmark-circle-outline' },
  placement_closed: { title: 'Care request closed', description: 'This care request is no longer open.', icon: 'close-circle-outline' },
  placement_coverage_updated: { title: 'Care coverage updated', description: 'Your agency updated coverage for a care request.', icon: 'briefcase-outline' },
};

export function notificationGroup(iso: string, now = new Date()): InboxGroup {
  const date = new Date(iso);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}

export function notificationTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  const mins = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (notificationGroup(iso, now) === 'Today') {
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  const clock = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return notificationGroup(iso, now) === 'Yesterday' ? `Yesterday · ${clock}`
    : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}) })} · ${clock}`;
}

export function groupNotifications(notifications: WorkerNotification[], filter: InboxFilter, now = new Date()) {
  const visible = notifications.filter(n => filter === 'all' || n.read_at === null)
    .slice().sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  return inboxGroups.map(title => ({ title, items: visible.filter(n => notificationGroup(n.created_at, now) === title) }))
    .filter(group => group.items.length > 0);
}

export function notificationPresentation(n: WorkerNotification, visit?: WorkerShiftDetail) {
  const label = labels[n.type] ?? { title: 'Agency update', description: 'Open your inbox to review this update.', icon: 'notifications-outline' as const };
  const destination = notificationDestination(n);
  const isVisit = destination?.pathname === '/shifts/[shiftId]';
  let context = label.description;
  let detail: string | undefined;
  if (isVisit) {
    // Loaded through the existing worker-authorized API; payloads never grant access.
    const date = visit ? new Date(visit.start_time) : new Date(`${destination.params.occurrenceDate}T00:00:00`);
    context = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (visit) {
      const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const service = 'Care visit';
      detail = `${time(visit.start_time)}–${time(visit.end_time)} · ${service}`;
    }
  } else if (typeof n.payload.message === 'string' && !n.type.startsWith('shift_')) {
    context = n.payload.message;
  }
  return { ...label, context, detail, isVisit,
    action: isVisit ? 'View visit' : destination?.pathname === '/notifications/schedule' ? 'View schedule'
      : destination?.pathname === '/placements/[id]' ? 'View care request' : 'Mark as read',
    hasDestination: !!destination };
}
