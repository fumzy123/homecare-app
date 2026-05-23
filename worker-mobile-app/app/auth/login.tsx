import { router } from 'expo-router';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kicker } from '@/shared/components/ui';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 justify-center px-6">
        <Kicker className="mb-3 text-center">Sign In</Kicker>
        <Text className="mb-8 text-center font-serif text-3xl text-ink">
          Welcome back.
        </Text>
        <LoginForm onSuccess={() => router.replace('/(tabs)/home')} />
      </View>
    </SafeAreaView>
  );
}
