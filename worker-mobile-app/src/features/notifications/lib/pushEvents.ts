import type { DevicePushToken, NotificationResponse } from 'expo-notifications';
type Notifications = typeof import('expo-notifications');

// Navigation remains a caller-owned, fixed authenticated destination. Payload URLs
// and patient data are never trusted by this event adapter.
export function installPushEvents(
  notifications: Notifications,
  isCurrentAccount: () => boolean,
  openInbox: () => void,
  refreshData: () => void,
  refreshToken: (token: DevicePushToken) => void,
) {
  let active = true;
  let lastOpened: string | undefined;
  const allowed = () => active && isCurrentAccount();
  const open = (response: NotificationResponse) => {
    if (!allowed()) return;
    const identifier = response.notification.request.identifier + ':' + response.actionIdentifier;
    if (lastOpened === identifier) return;
    lastOpened = identifier;
    refreshData();
    openInbox();
    void notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  notifications.setNotificationHandler({ handleNotification: async () => ({
    shouldShowBanner: allowed(), shouldShowList: allowed(),
    shouldPlaySound: allowed(), shouldSetBadge: false,
  }) });
  const taps = notifications.addNotificationResponseReceivedListener(open);
  const received = notifications.addNotificationReceivedListener(() => { if (allowed()) refreshData(); });
  const tokens = notifications.addPushTokenListener(token => { if (allowed()) refreshToken(token); });
  const last = notifications.getLastNotificationResponse();
  if (last) open(last);
  return () => {
    active = false;
    taps.remove(); received.remove(); tokens.remove();
    notifications.setNotificationHandler(null);
  };
}
