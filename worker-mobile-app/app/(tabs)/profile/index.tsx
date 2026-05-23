import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kicker, Btn, Divider } from '@/shared/components/ui';
import { useAuthStore } from '@/shared/lib/auth-store';
import { useSignOut } from '@/features/auth/hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { mutate: signOut, isPending } = useSignOut();

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 px-6 pt-8">
        <Kicker className="mb-2">Profile</Kicker>
        <Text className="mb-1 font-serif text-2xl text-ink">Your account</Text>
        <Text className="mb-8 font-sans text-sm text-muted">{user?.email}</Text>

        <Divider className="mb-8" />

        <Text className="mb-3 font-sans text-sm text-muted">
          Phase 5 — Full profile details coming soon.
        </Text>

        <Btn
          variant="ghost"
          onPress={() => signOut()}
          disabled={isPending}
          className="mt-auto"
        >
          {isPending ? 'Signing out…' : 'Sign Out'}
        </Btn>
      </View>
    </SafeAreaView>
  );
}
