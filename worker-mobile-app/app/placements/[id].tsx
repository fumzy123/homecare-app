import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PlacementDetail } from '@/features/placements/components/PlacementDetail';
export default function PlacementDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const fromNotifications = source === 'notifications';
  return <SafeAreaView className="flex-1 bg-cream">
    <Pressable accessibilityRole="button" accessibilityLabel={fromNotifications ? 'Back to notifications' : 'Back'} className="min-h-11 px-5 py-4"
      onPress={() => router.canGoBack() ? router.back() : router.replace(fromNotifications ? '/notifications' : '/(tabs)/home')}>
      <Text className="text-ink">{fromNotifications ? '← Notifications' : '← Back'}</Text>
    </Pressable>
    <PlacementDetail placementId={id ?? ''} />
  </SafeAreaView>;
}
