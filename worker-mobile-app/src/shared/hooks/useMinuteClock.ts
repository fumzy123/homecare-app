import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Update time-based UI at minute boundaries and immediately on foregrounding. */
export function useMinuteClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { setNow(Date.now()); schedule(); }, 60_000 - Date.now() % 60_000);
    };
    schedule();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { clearTimeout(timer); listener.remove(); };
  }, []);
  return now;
}
