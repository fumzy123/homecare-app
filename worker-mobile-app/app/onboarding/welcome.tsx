import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Kicker } from '@/shared/components/ui';

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-center justify-center px-8">
        <Kicker className="mb-6">HomeCare Worker</Kicker>
        <Text className="mb-4 text-center font-serif text-5xl leading-tight text-ink">
          Care,{'\n'}Delivered.
        </Text>
        <Text className="mb-12 text-center font-sans text-base text-ink-soft">
          Your shifts, notes, and clients — all in one place.
        </Text>
      </View>

      <View className="px-6 pb-8">
        <Pressable
          className="min-h-11 items-center justify-center rounded-full bg-ink px-8 py-3"
          onPress={() => router.push('/onboarding/how-it-works')}
        >
          <Text className="font-sans text-sm font-semibold text-cream">Get Started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
