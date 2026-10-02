import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { usePushStatus } from './PushProvider';

export function PushSettings() {
  const { status, busy, enable } = usePushStatus();
  const description = {
    unsupported: 'Phone alerts require the installed Android staging app. Expo Go can still show your notification inbox.',
    off: 'Allow this app to receive work updates on this phone.',
    blocked: 'Notifications are disabled in your phone settings.',
    registered: 'This phone is registered for notifications.',
    error: 'Could not register this phone. Check your connection and try again.',
  }[status];
  return <View className="px-4 py-4">
    <Text className="text-[13px] text-ink">Phone notifications</Text>
    <Text className="mt-2 text-[12px] text-ink-soft">{description}</Text>
    {status !== 'unsupported' && status !== 'registered' ? <Pressable accessibilityRole="button" disabled={busy}
      onPress={status === 'blocked' ? () => { void Linking.openSettings().catch(() => Alert.alert('Could not open settings', 'Open your phone settings and choose this app.')); } : enable}
      className="mt-3 self-start border border-ink/20 px-4 py-3">
      <Text className="text-orange">{busy ? 'Connecting…' : status === 'blocked' ? 'Open phone settings' : status === 'error' ? 'Try again' : 'Enable notifications'}</Text>
    </Pressable> : null}
  </View>;
}
