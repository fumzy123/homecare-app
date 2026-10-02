import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/shared/lib/auth-store';
import { useWorkerEntry } from '@/features/auth/hooks/useWorkerEntry';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { nativeNotifications, setPushUser, supportsPush, unregisterPush } from '../lib/pushRegistration';

type Status = 'off' | 'blocked' | 'registered' | 'unsupported' | 'error';
const PushContext = createContext({ status: 'off' as Status, busy: false, enable: () => {} });
export const usePushStatus = () => useContext(PushContext);

export function PushProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore(state => state.user?.id);
  const loading = useAuthStore(state => state.isLoading);
  const { ready } = useWorkerEntry();
  const { mutateAsync, isPending } = usePushRegistration();
  const [status, setStatus] = useState<Status>(supportsPush() ? 'off' : 'unsupported');

  useEffect(() => {
    if (loading) return;
    const activeUser = ready && userId ? userId : null;
    setPushUser(activeUser);
    let alive = true;
    let cleanupNative = () => {};
    async function refresh() {
      try {
        if (!activeUser) { await unregisterPush(); if (alive) setStatus(supportsPush() ? 'off' : 'unsupported'); return; }
        const result = await mutateAsync({ userId: activeUser, requestPermission: false });
        if (alive) setStatus(result);
      } catch { if (alive) setStatus('error'); }
    }
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    void nativeNotifications().then(notifications => {
      if (!notifications || !alive || !activeUser) return;
      notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
      // Only navigate to a known authenticated destination; never trust arbitrary URLs.
      const openInbox = () => { if (alive) { router.push('/notifications'); void notifications.clearLastNotificationResponseAsync(); } };
      const taps = notifications.addNotificationResponseReceivedListener(openInbox);
      const tokens = notifications.addPushTokenListener(() => { void refresh(); });
      if (notifications.getLastNotificationResponse()) openInbox();
      cleanupNative = () => { taps.remove(); tokens.remove(); notifications.setNotificationHandler(null); };
    }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; setPushUser(null); subscription.remove(); cleanupNative(); };
  }, [userId, ready, loading, mutateAsync]);

  async function enable() {
    if (!userId || !ready) return;
    try { setStatus(await mutateAsync({ userId, requestPermission: true })); }
    catch { setStatus('error'); }
  }
  return <PushContext.Provider value={{ status, busy: isPending, enable: () => void enable() }}>{children}</PushContext.Provider>;
}
