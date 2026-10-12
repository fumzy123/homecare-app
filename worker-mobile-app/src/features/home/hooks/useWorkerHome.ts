import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMyShifts } from '@/features/shifts/hooks/useMyShifts';
import { useWorkerProfile } from '@/features/profile/hooks/useWorkerProfile';
import { useWorkerStats } from '@/features/profile/hooks/useWorkerStats';
import { useMyCredentials } from '@/features/profile/hooks/useMyCredentials';
import { useMyNotifications } from '@/features/notifications/hooks/useMyNotifications';
import { useRecordedNotes } from '@/features/notes/hooks/useProgressNotes';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { homeDateRange, homeSummary } from '../lib/homeSummary';
import { useHomeClock } from './useHomeClock';

export function useWorkerHome() {
  const now = useHomeClock();
  const range = homeDateRange(now);
  const shifts = useMyShifts(range.fromDate, range.toDate);
  const notes = useRecordedNotes(range.fromDate, range.toDate);
  const profile = useWorkerProfile();
  const stats = useWorkerStats();
  const credentials = useMyCredentials();
  const notifications = useMyNotifications();
  const refreshAll = useCallback(() => Promise.all([
    shifts.refetch(), notes.refetch(), profile.refetch(), stats.refetch(), credentials.refetch(), notifications.refetch(),
  ]), [shifts.refetch, notes.refetch, profile.refetch, stats.refetch, credentials.refetch, notifications.refetch]);
  useFocusEffect(useCallback(() => { void refreshAll(); }, [refreshAll]));
  const refresh = useRefreshControl(refreshAll);
  return { now, range, shifts, notes, profile, stats, credentials, notifications, refresh,
    summary: homeSummary(shifts.data ?? [], notes.data ?? [], now),
  };
}
