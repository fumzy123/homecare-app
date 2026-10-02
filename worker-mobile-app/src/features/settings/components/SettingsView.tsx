import { View, Text, Pressable, Alert, ActivityIndicator, Linking, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSignOut } from '@/features/auth/hooks/useAuth';
import { PushSettings } from '@/features/notifications/components/PushSettings';

export function SettingsView() {
  const { mutate: signOut, isPending: signingOut, isError: signOutFailed } = useSignOut();
  const website = process.env.EXPO_PUBLIC_FRONTEND_URL?.replace(/\/$/, '');

  async function openWebsite(path: string) {
    if (!website) {
      Alert.alert('Page unavailable', 'Contact your agency for help. The agency website has not been configured for this app.');
      return;
    }
    try {
      await Linking.openURL(`${website}${path}`);
    } catch {
      Alert.alert('Could not open the page', 'Please try again, or contact your agency for help.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between border-b border-ink/[0.08] px-5 py-4">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1.5"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={16} color="#4A453E" />
          <Text className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">Back</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <View className="h-px w-3 bg-ink" />
          <Text className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
            Settings
          </Text>
        </View>
        <View style={{ width: 56 }} />
      </View>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <View className="mx-5 mt-5 mb-1 flex-row items-center gap-2">
        <View className="h-px w-3 bg-ink" />
        <Text className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-soft">
          Notifications
        </Text>
        <View className="h-px flex-1 bg-ink" />
      </View>
      <View className="mx-5 border border-ink/[0.12]">
        <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} className="flex-row items-center justify-between px-4 py-3.5 border-b border-ink/[0.08]">
          <Text className="text-[13px] text-ink">Notification inbox</Text>
          <Ionicons name="chevron-forward" size={16} color="#8A8378" />
        </Pressable>
        <PushSettings />
      </View>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <View className="mx-5 mt-5 mb-1 flex-row items-center gap-2">
        <View className="h-px w-3 bg-ink" />
        <Text className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-soft">
          Account
        </Text>
        <View className="h-px flex-1 bg-ink" />
      </View>
      <View className="mx-5 border border-ink/[0.12]">
        <Pressable
          accessibilityRole="link"
          onPress={() => void openWebsite('/forgot-password')}
          className="flex-row items-center justify-between px-4 py-3.5 border-b border-ink/[0.08]"
        >
          <Text className="text-[13px] text-ink">Reset password on the web</Text>
          <Ionicons name="chevron-forward" size={16} color="#8A8378" />
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => void openWebsite('/privacy')} className="flex-row items-center justify-between px-4 py-3.5 border-b border-ink/[0.08]">
          <Text className="text-[13px] text-ink">Privacy &amp; data</Text>
          <Ionicons name="chevron-forward" size={16} color="#8A8378" />
        </Pressable>
        <Pressable
          onPress={() => signOut()}
          disabled={signingOut}
          className="flex-row items-center justify-between px-4 py-3.5"
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#FF5A1F" />
          ) : (
            <>
              <Text className="text-[13px] text-orange">Sign out</Text>
              <Ionicons name="log-out-outline" size={16} color="#FF5A1F" />
            </>
          )}
        </Pressable>
      </View>

      {/* ── App info ─────────────────────────────────────────────────────── */}
      {signOutFailed ? <Text accessibilityRole="alert" className="mx-5 mt-3 text-orange">Could not finish signing out. Connect to the internet and try again so this phone can stop receiving account notifications.</Text> : null}
      <Pressable onPress={() => router.push('/introduction')} className="mx-5 mt-6 border border-ink/[0.12] px-4 py-4">
        <Text className="text-[13px] text-ink">How to use the worker app</Text>
      </Pressable>
      <View className="mt-auto px-5 pb-6 pt-6">
        <Text className="text-center font-mono text-[9px] text-muted">
          {Constants.expoConfig?.name ?? 'HomeCare Worker App'} · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
