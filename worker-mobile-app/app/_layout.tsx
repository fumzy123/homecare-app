import '../global.css';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/shared/lib/query-client';
import { supabase } from '@/shared/lib/api-client';
import { useAuthStore } from '@/shared/lib/auth-store';
import { useWorkerEntry } from '@/features/auth/hooks/useWorkerEntry';
import { PushProvider } from '@/features/notifications/components/PushProvider';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { session, isLoading } = useAuthStore();
  const { ready } = useWorkerEntry();
  if (isLoading) return null;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Protected guard={!session}><Stack.Screen name="(auth)" /></Stack.Protected>
    <Stack.Protected guard={!!session && !ready}><Stack.Screen name="worker-welcome" /></Stack.Protected>
    <Stack.Protected guard={!!session && ready}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="shifts/[shiftId]" />
      <Stack.Screen name="clients/[clientId]" />
      <Stack.Screen name="placements/[id]" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="notifications/index" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="introduction" />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  const { setSession, setLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      setLoading(false);
    }).catch(() => { if (active) { setSession(null); setLoading(false); } });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (useAuthStore.getState().user?.id !== session?.user.id) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      setSession(session);
      setLoading(false);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    return () => { active = false; subscription.unsubscribe(); appState.remove(); supabase.auth.stopAutoRefresh(); };
  }, [setSession, setLoading]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <PushProvider><Navigation /></PushProvider>
    </QueryClientProvider>
  );
}
