import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HomeHeaderProps {
  firstName?: string;
  now: number;
  notificationCount: number;
  onNotificationsPress: () => void;
}

export function HomeHeader({ firstName, now, notificationCount, onNotificationsPress }: HomeHeaderProps) {
  const date = new Date(now);
  const hour = date.getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';
  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="mb-3 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
          {date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text accessibilityRole="header" className="font-serif text-4xl text-ink">{greeting}</Text>
        {firstName ? <Text className="font-serif-italic text-4xl text-ink">{firstName}.</Text> : null}
      </View>
      <Pressable onPress={onNotificationsPress} accessibilityRole="button"
        accessibilityLabel={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}
        className="relative mt-6 h-11 w-11 items-center justify-center rounded-2xl border border-cream-2 bg-paper">
        <Ionicons name="notifications-outline" size={21} color="#4A453E" />
        {notificationCount > 0 ? <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1">
          <Text className="font-mono text-[10px] text-white">{notificationCount > 9 ? '9+' : notificationCount}</Text>
        </View> : null}
      </Pressable>
    </View>
  );
}
