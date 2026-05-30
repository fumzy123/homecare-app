import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui';
import { getInitials } from '@/shared/utils/getInitials';
import { getWeekNumber } from '@/shared/utils/getWeekNumber';
import type { WorkerProfile } from '@/features/profile/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function formatHeaderDate(): string {
  const now = new Date();
  const day = now.toLocaleDateString('en-CA', { weekday: 'short' }).toUpperCase();
  const month = now.toLocaleDateString('en-CA', { month: 'short' }).toUpperCase();
  const date = now.getDate();
  const wk = getWeekNumber(now);
  return `— ${day} · ${month} ${date} · WK ${wk}`;
}

interface HomeHeaderProps {
  profile: WorkerProfile | undefined;
  notificationCount?: number;
}

export function HomeHeader({ profile, notificationCount = 0 }: HomeHeaderProps) {
  const firstName = profile?.first_name ?? '';
  const initials = profile ? getInitials(profile.first_name, profile.last_name) : '—';

  return (
    <View className="mb-6 flex-row items-start justify-between">
      <View className="flex-1 pr-4">
        <Text className="mb-1 font-mono text-xs text-muted">{formatHeaderDate()}</Text>
        <Text className="font-serif-semibold text-3xl text-ink">{getGreeting()}</Text>
        {firstName ? (
          <Text className="font-serif-italic text-3xl text-ink">{firstName}.</Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3 pt-1">
        <Pressable
          onPress={() => router.push('/notifications')}
          className="relative h-10 w-10 items-center justify-center rounded-xl border border-cream-2 bg-paper"
        >
          <Ionicons name="notifications-outline" size={20} color="#3D3935" />
          {notificationCount > 0 && (
            <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-orange">
              <Text className="font-mono text-xs font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable onPress={() => router.navigate('/(tabs)/me/index')}>
          <Avatar initials={initials} size="md" className="bg-orange" />
        </Pressable>
      </View>
    </View>
  );
}
