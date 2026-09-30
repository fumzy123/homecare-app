import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Refresh countdowns and date-based query keys, including after backgrounding. */
export function useHomeClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Align to minute boundaries, so whole-minute shift transitions are immediate.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { tick(); schedule(); }, 60_000 - (Date.now() % 60_000));
    };
    schedule();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return now;
}
