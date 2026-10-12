import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { ShiftOccurrence } from '@/features/shifts/types';
import { partitionShifts } from '../lib/partitionShifts';

export function useHomeShifts(shifts: ShiftOccurrence[]) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    // Reclassify at visit boundaries or midnight, without rerendering the whole
    // home screen every second just to check whether a shift has started.
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const boundaries = shifts.flatMap((shift) => [Date.parse(shift.start_time), Date.parse(shift.end_time)]);
    const nextBoundary = Math.min(midnight.getTime(), ...boundaries.filter((time) => time > now));
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, nextBoundary - Date.now()));
    return () => clearTimeout(timer);
  }, [shifts, now]);
  return partitionShifts(shifts, now);
}
