import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyNotifications, useMarkNotificationRead } from '../hooks/useMyNotifications';
import { useNotificationVisits } from '../hooks/useNotificationVisits';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import type { WorkerNotification } from '../api';
import { notificationDestination } from '../lib/notificationDestination';
import { groupNotifications, notificationPresentation, notificationTime, type InboxFilter } from '../lib/inboxView';
import { NotificationCard } from './NotificationCard';
import { useAuthStore } from '@/shared/lib/auth-store';

export function NotificationsInbox() {
  const { data, isLoading, isError, refetch } = useMyNotifications();
  const { mutateAsync: markRead, isPending } = useMarkNotificationRead();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const opening = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { refreshing, onRefresh } = useRefreshControl(refetch);
  const notifications = data?.notifications ?? [];
  const visits = useNotificationVisits(notifications);
  const groups = groupNotifications(notifications, filter);
  const unreadCount = data?.unread_count ?? 0;

  async function handlePress(n: WorkerNotification) {
    if (opening.current) return;
    opening.current = true;
    const userId = useAuthStore.getState().user?.id;
    const stillHere = () => mounted.current && !!userId && useAuthStore.getState().user?.id === userId;
    try {
      if (n.read_at === null) await markRead(n.id);
      const destination = notificationDestination(n);
      if (stillHere() && destination) router.push(destination);
    } catch {
      if (stillHere()) Alert.alert('Could not mark as read',
        'Check your connection and try again. This notification is still unread.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Retry', onPress: () => { void handlePress(n); } }]);
    } finally {
      opening.current = false;
    }
  }

  return <SafeAreaView className="flex-1 bg-cream">
    <View className="border-b border-cream-2 bg-paper px-5 pb-5 pt-2">
      <View className="flex-row items-center justify-between gap-3">
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} accessibilityRole="button" accessibilityLabel="Back" className="min-h-11 flex-row items-center gap-2 pr-4">
          <Ionicons name="arrow-back" size={21} color="#4A453E" /><Text className="font-sans text-sm text-ink-soft">Back</Text>
        </Pressable>
        <Text className="font-mono text-[10px] uppercase tracking-widest text-[#6E685E]">Care Harbor</Text>
      </View>
      <View className="mt-4 flex-row flex-wrap items-center justify-between gap-3">
        <Text accessibilityRole="header" className="font-serif text-4xl text-ink">Notifications</Text>
        {!isLoading && !isError ? <View className="rounded-full bg-orange-soft px-2.5 py-1.5"><Text accessibilityLiveRegion="polite" className="font-sans text-xs font-semibold text-[#95340F]">{unreadCount} unread</Text></View> : null}
      </View>
      <View accessibilityRole="tablist" className="mt-5 flex-row rounded-full bg-cream-2 p-1">
        {(['all', 'unread'] as const).map(value => <Pressable key={value} onPress={() => setFilter(value)} accessibilityRole="tab" accessibilityState={{ selected: value === filter }} className={`min-h-11 flex-1 items-center justify-center rounded-full px-4 ${filter === value ? 'bg-paper' : ''}`}>
          <Text className={`font-sans text-sm ${filter === value ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{value === 'all' ? 'All' : 'Unread'}</Text>
        </Pressable>)}
      </View>
    </View>
    {isPending ? <Text accessibilityLiveRegion="polite" className="px-5 py-2 font-sans text-sm text-ink-soft">Opening notification…</Text> : null}
    {isLoading && !refreshing ? <View className="flex-1 items-center justify-center"><ActivityIndicator accessibilityLabel="Loading notifications" color="#FF5A1F" /></View>
      : <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5A1F" colors={['#FF5A1F']} />}>
        {isError ? <View className="items-center px-6 py-16"><Text accessibilityRole="alert" className="text-center font-sans text-sm leading-6 text-ink">Could not load notifications. Pull down to retry.</Text></View>
          : groups.length === 0 ? <View className="items-center px-5 py-16">
            <Ionicons name="checkmark-circle-outline" size={36} color="#6E685E" />
            <Text className="mt-4 font-serif text-3xl text-ink">{filter === 'unread' ? unreadCount > 0 ? 'No recent unread items.' : 'All caught up.' : 'No notifications yet.'}</Text>
            <Text className="mt-2 text-center font-sans text-sm leading-6 text-ink-soft">{filter === 'unread' ? unreadCount > 0 ? 'The unread count includes older notifications outside this recent list.' : 'You have no unread notifications. Your history is still available under All.' : 'Updates from your agency will appear here.'}</Text>
          </View>
          : <>{groups.map(group => <View key={group.title}>
            <Text accessibilityRole="header" className="mb-3 ml-1 mt-6 font-mono text-[11px] uppercase tracking-widest text-[#6E685E]">{group.title}</Text>
            {group.items.map(n => {
              const destination = notificationDestination(n);
              const visit = destination?.pathname === '/shifts/[shiftId]' ? visits.get(`${destination.params.shiftId}:${destination.params.occurrenceDate}`) : undefined;
              return <NotificationCard key={n.id} content={notificationPresentation(n, visit?.isError ? undefined : visit?.data)} unread={n.read_at === null} time={notificationTime(n.created_at)}
                visitState={visit?.isPending ? 'loading' : visit?.isError ? 'error' : undefined} disabled={isPending} onPress={() => { void handlePress(n); }} />;
            })}
          </View>)}<Text className="mt-6 text-center font-sans text-xs leading-5 text-ink-soft">Opening a notification marks it as read.</Text></>}
      </ScrollView>}
  </SafeAreaView>;
}
