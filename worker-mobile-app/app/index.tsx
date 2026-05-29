import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/shared/lib/auth-store';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (session) {
      setDestination('/(tabs)/home');
      return;
    }

    SecureStore.getItemAsync('onboarding_seen').then((seen) => {
      setDestination(seen ? '/(auth)/login' : '/(auth)/onboarding');
    });
  }, [isLoading, session]);

  if (!destination) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator color="#FF5A1F" />
      </View>
    );
  }

  return <Redirect href={destination as any} />;
}
