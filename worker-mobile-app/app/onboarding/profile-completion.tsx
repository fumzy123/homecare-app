import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/shared/components/ui';

const COMPLETION_PERCENT = 60;

const MISSING_ITEMS = [
  { label: 'First Aid Certificate', detail: 'Upload and set expiry date' },
  { label: 'Vulnerable Sector Check (VSC)', detail: 'Upload and set expiry date' },
  { label: 'Emergency contact', detail: 'Name and phone number' },
];

const COMPLETE_ITEMS = [
  { label: 'Name and email' },
  { label: 'Phone number' },
];

export default function ProfileCompletionScreen() {
  const handleGetStarted = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 px-6 pt-12">
        <Text className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">
          Profile Setup
        </Text>
        <Text className="mb-8 font-serif text-3xl leading-snug text-ink">
          Almost ready.
        </Text>

        {/* Completion bar */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-mono text-sm text-ink">Profile completion</Text>
          <Text className="font-mono text-sm font-bold text-ink">{COMPLETION_PERCENT}%</Text>
        </View>
        <View className="mb-8 h-2 overflow-hidden rounded-full bg-cream-2">
          <View
            className="h-full rounded-full bg-mint-dark"
            style={{ width: `${COMPLETION_PERCENT}%` }}
          />
        </View>

        {/* Missing items */}
        <Text className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          Still needed
        </Text>
        {MISSING_ITEMS.map((item) => (
          <View key={item.label} className="mb-3 flex-row items-start gap-3">
            <View className="mt-0.5 h-4 w-4 items-center justify-center rounded-full border border-muted opacity-50">
              <View className="h-1.5 w-1.5 rounded-full bg-muted" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-sm text-ink">{item.label}</Text>
              <Text className="font-sans text-xs text-muted">{item.detail}</Text>
            </View>
          </View>
        ))}

        {/* Complete items */}
        <Text className="mb-3 mt-6 font-mono text-xs uppercase tracking-widest text-muted">
          Complete
        </Text>
        {COMPLETE_ITEMS.map((item) => (
          <View key={item.label} className="mb-3 flex-row items-center gap-3">
            <View className="h-4 w-4 items-center justify-center rounded-full bg-mint-dark">
              <Text className="font-mono text-xs text-cream">✓</Text>
            </View>
            <Text className="font-sans text-sm text-ink">{item.label}</Text>
          </View>
        ))}

        {/* Warning */}
        <View className="mt-6 rounded-xl border border-orange-soft bg-orange-soft px-4 py-3">
          <Text className="font-sans text-xs leading-relaxed text-ink-soft">
            Incomplete compliance documents may affect your eligibility for shift assignments. You can upload them anytime from your profile.
          </Text>
        </View>
      </View>

      <View className="px-6 pb-8 gap-3">
        <Btn onPress={handleGetStarted}>Get Started</Btn>
        <Pressable onPress={handleGetStarted} className="items-center py-3">
          <Text className="font-sans text-sm text-muted">I'll do this later</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
