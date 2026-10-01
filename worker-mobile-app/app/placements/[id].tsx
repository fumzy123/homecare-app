import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PlacementDetail } from '@/features/placements/components/PlacementDetail';
export default function PlacementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SafeAreaView className="flex-1 bg-cream"><Pressable accessibilityRole="button" className="px-5 py-4" onPress={() => router.back()}><Text className="text-ink">← Placements</Text></Pressable><PlacementDetail placementId={id ?? ''} /></SafeAreaView>;
}
