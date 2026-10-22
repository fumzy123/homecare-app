import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import type { DevicePushToken } from 'expo-notifications';
import { useAuthStore } from '@/shared/lib/auth-store';
import { useWorkerEntry } from '@/features/auth/hooks/useWorkerEntry';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { usePushRefresh } from '../hooks/usePushRefresh';
import { installPushEvents } from '../lib/pushEvents';
import { nativeNotifications, setPushUser, supportsPush, unregisterPush } from '../lib/pushRegistration';

type Status = 'off' | 'blocked' | 'registered' | 'unsupported' | 'error';
const PushContext = createContext({ status: 'off' as Status, busy: false, enable: () => {} });
export const usePushStatus = () => useContext(PushContext);

export function PushProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore(state => state.user?.id);
  const loading = useAuthStore(state => state.isLoading);
  const { ready } = useWorkerEntry();
  const { mutateAsync, isPending } = usePushRegistration();
  const refreshData = usePushRefresh();
  const [status, setStatus] = useState<Status>(supportsPush() ? 'off' : 'unsupported');

  useEffect(() => {
    if (loading) return;
    const activeUser = ready && userId ? userId : null;
    setPushUser(activeUser);
    let alive = true;
    let cleanupNative = () => {};
    async function refresh(devicePushToken?: DevicePushToken) {
      try {
        if (!activeUser) { await unregisterPush(); if (alive) setStatus(supportsPush() ? 'off' : 'unsupported'); return; }
        const result = await mutateAsync({ userId: activeUser, requestPermission: false, devicePushToken });
        if (alive) setStatus(result);
      } catch { if (alive) setStatus('error'); }
    }
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    void nativeNotifications().then(notifications => {
      if (!notifications || !alive || !activeUser) return;
      cleanupNative = installPushEvents(notifications,
        () => alive && useAuthStore.getState().user?.id === activeUser,
        () => router.push('/notifications'), refreshData, token => { void refresh(token); });
    }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; setPushUser(null); subscription.remove(); cleanupNative(); };
  }, [userId, ready, loading, mutateAsync, refreshData]);

  async function enable() {
    if (!userId || !ready) return;
    try { setStatus(await mutateAsync({ userId, requestPermission: true })); }
    catch { setStatus('error'); }
  }
  return <PushContext.Provider value={{ status, busy: isPending, enable: () => void enable() }}>{children}</PushContext.Provider>;
}
