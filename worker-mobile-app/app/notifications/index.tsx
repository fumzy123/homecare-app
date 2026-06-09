import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyNotifications, useMarkNotificationRead } from '@/features/notifications/hooks/useMyNotifications';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { Kicker } from '@/shared/components/ui';
import type { WorkerNotification } from '@/features/notifications/api';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function notificationTitle(n: WorkerNotification): string {
  if (n.type === 'placement_created') {
    const loc = n.payload.masked_location as string | undefined;
    return `New placement available${loc ? ` — ${loc}` : ''}`;
  }
  return 'New notification';
}

function notificationIcon(type: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (type === 'placement_created') return 'briefcase-outline';
  return 'notifications-outline';
}

function NotificationRow({
  n,
  onPress,
}: {
  n: WorkerNotification;
  onPress: () => void;
}) {
  const isUnread = n.read_at === null;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-start gap-3 border-b border-cream-2 px-5 py-4 ${isUnread ? 'bg-orange-soft' : 'bg-paper'}`}
    >
      <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-cream-2">
        <Ionicons name={notificationIcon(n.type)} size={18} color="#3D3935" />
      </View>

      <View className="flex-1">
        <Text className="font-sans text-sm font-medium text-ink leading-snug">
          {notificationTitle(n)}
        </Text>
        <Text className="mt-0.5 font-mono text-xs text-muted">
          {timeAgo(n.created_at)}
        </Text>
      </View>

      <View className="items-center gap-1.5 pt-1">
        {isUnread && (
          <View className="h-2 w-2 rounded-full bg-orange" />
        )}
        <Ionicons name="chevron-forward" size={14} color="#8A8378" />
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { data, isLoading, refetch } = useMyNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { refreshing, onRefresh } = useRefreshControl(refetch);

  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unread_count ?? 0;

  function handlePress(n: WorkerNotification) {
    if (n.read_at === null) {
      markRead(n.id);
    }
    if (n.type === 'placement_created') {
      const placementId = n.payload.placement_id as string | undefined;
      if (placementId) {
        router.push(`/placements/${placementId}` as never);
        return;
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-cream-2 bg-paper px-5 py-4">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color="#3D3935" />
        </Pressable>
        <View className="flex-1">
          <Kicker>Inbox</Kicker>
          <Text className="font-serif-semibold text-xl text-ink leading-tight">Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <View className="rounded-full bg-orange px-2.5 py-1">
            <Text className="font-mono text-xs font-bold text-white">{unreadCount} unread</Text>
          </View>
        )}
      </View>

      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF5A1F" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF5A1F"
              colors={['#FF5A1F']}
            />
          }
        >
          {notifications.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6 py-20">
              <Ionicons name="checkmark-circle-outline" size={40} color="#8A8378" />
              <Text className="mt-4 font-serif text-xl text-ink">All caught up.</Text>
              <Text className="mt-1 text-center font-sans text-sm text-muted">
                Notifications will appear here when there's something for you.
              </Text>
            </View>
          ) : (
            notifications.map((n) => (
              <NotificationRow key={n.id} n={n} onPress={() => handlePress(n)} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
