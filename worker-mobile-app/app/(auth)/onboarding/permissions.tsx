import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Btn } from '@/shared/components/ui';

const PERMISSIONS_SEEN_KEY = 'permissions_seen';

async function markPermissionsSeen() {
  await SecureStore.setItemAsync(PERMISSIONS_SEEN_KEY, 'true');
}

function PermissionRow({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View className="mb-5 flex-row gap-4">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-cream-2">
        <Text className="text-xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="mb-0.5 font-mono text-sm font-bold text-ink">{title}</Text>
        <Text className="font-sans text-sm leading-relaxed text-muted">{description}</Text>
      </View>
    </View>
  );
}

export default function PermissionsScreen() {
  const handleAllow = async () => {
    await Location.requestForegroundPermissionsAsync();
    // await Notifications.requestPermissionsAsync(); // Disabled in Expo Go
    await markPermissionsSeen();
    router.replace('/(auth)/onboarding/profile-completion');
  };

  const handleSkip = async () => {
    await markPermissionsSeen();
    router.replace('/(auth)/onboarding/profile-completion');
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 px-6 pt-12">
        <Text className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">
          A Few Things First
        </Text>
        <Text className="mb-3 font-serif text-3xl leading-snug text-ink">
          This app works best with these permissions.
        </Text>
        <Text className="mb-10 font-sans text-sm leading-relaxed text-muted">
          We only use these for features directly related to your work.
        </Text>

        <PermissionRow
          icon="📍"
          title="Location"
          description="We use your location to confirm you've arrived at a client's home when you check in. It's only checked at the moment of check-in — we don't track you continuously."
        />
        <PermissionRow
          icon="🔔"
          title="Notifications"
          description="Your manager will notify you about shift assignments, schedule changes, and important updates. You can adjust these in Settings at any time."
        />
      </View>

      <View className="px-6 pb-8 gap-3">
        <Btn onPress={handleAllow}>Allow Permissions</Btn>
        <Pressable onPress={handleSkip} className="items-center py-3">
          <Text className="font-sans text-sm text-muted">Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
