import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSignOut } from '@/features/auth/hooks/useAuth';

export default function SettingsScreen() {
  const { mutate: signOut, isPending: signingOut } = useSignOut();

  function handlePasswordReset() {
    Alert.alert(
      'Reset Password',
      'A password reset email will be sent to your registered email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => { /* TODO: Supabase resetPasswordForEmail */ } },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
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
        <Pressable className="flex-row items-center justify-between px-4 py-3.5 border-b border-ink/[0.08]">
          <Text className="text-[13px] text-ink">Notification preferences</Text>
          <Ionicons name="chevron-forward" size={16} color="#8A8378" />
        </Pressable>
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
          onPress={handlePasswordReset}
          className="flex-row items-center justify-between px-4 py-3.5 border-b border-ink/[0.08]"
        >
          <Text className="text-[13px] text-ink">Send password reset email</Text>
          <Ionicons name="chevron-forward" size={16} color="#8A8378" />
        </Pressable>
        <Pressable className="flex-row items-center justify-between px-4 py-3.5 border-b border-ink/[0.08]">
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
      <View className="mt-auto px-5 pb-6">
        <Text className="text-center font-mono text-[9px] text-muted">
          Northwind Field App · v1.0.0
        </Text>
      </View>
    </SafeAreaView>
  );
}
