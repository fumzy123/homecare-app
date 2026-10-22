import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScheduleView } from '@/features/shifts/components/ScheduleView';

// A stack destination keeps the inbox underneath, unlike switching to a tab.
export default function NotificationScheduleScreen() {
  return <SafeAreaView className="flex-1 bg-cream">
    <View className="flex-row items-center border-b border-cream-2 bg-paper px-5 py-3">
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to notifications" className="mr-3 rounded-full p-2">
        <Ionicons name="arrow-back" size={22} color="#111111" />
      </Pressable>
      <Text className="font-mono text-xs uppercase tracking-widest text-muted">Notifications · Schedule</Text>
    </View>
    <ScheduleView />
  </SafeAreaView>;
}
