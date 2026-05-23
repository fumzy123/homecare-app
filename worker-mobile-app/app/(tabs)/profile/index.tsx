import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kicker } from '@/shared/components/ui';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-center justify-center px-6">
        <Kicker className="mb-3">Profile</Kicker>
        <Text className="text-center font-serif text-2xl text-ink">Your profile</Text>
        <Text className="mt-2 text-center font-sans text-sm text-muted">
          Phase 5 — Profile overview coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}
