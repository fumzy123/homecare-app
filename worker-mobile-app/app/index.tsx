import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/shared/lib/auth-store';

type RouteState = 'loading' | 'onboarding' | 'login' | 'permissions' | 'home';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const [routeState, setRouteState] = useState<RouteState>('loading');

  useEffect(() => {
    if (isLoading) return;

    async function resolveRoute() {
      const [onboardingSeen, permissionsSeen] = await Promise.all([
        SecureStore.getItemAsync('onboarding_seen'),
        SecureStore.getItemAsync('permissions_seen'),
      ]);

      if (!onboardingSeen) {
        setRouteState('onboarding');
      } else if (!session) {
        setRouteState('login');
      } else if (!permissionsSeen) {
        setRouteState('permissions');
      } else {
        setRouteState('home');
      }
    }

    resolveRoute();
  }, [isLoading, session]);

  if (routeState === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator color="#FF5A1F" />
      </View>
    );
  }

  if (routeState === 'onboarding') return <Redirect href="/onboarding/index" />;
  if (routeState === 'login') return <Redirect href="/auth/login" />;
  if (routeState === 'permissions') return <Redirect href="/onboarding/permissions" />;
  return <Redirect href="/(tabs)/home" />;
}
