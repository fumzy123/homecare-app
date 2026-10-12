import { View, Text, Pressable, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PushSettings } from '@/features/notifications/components/PushSettings';
import { openWebsitePage } from '@/shared/lib/website-links';

/** Layer 3: composes notification controls and public account/legal actions. */
export function SettingsView() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to profile"
          onPress={() => router.back()} className="mb-4 min-h-11 flex-row items-center gap-2 self-start">
          <Ionicons name="chevron-back" size={20} color="#4A453E" />
          <Text className="font-sans text-sm text-ink-soft">Back</Text>
        </Pressable>
        <Text accessibilityRole="header" className="mb-8 font-serif text-[42px] leading-[48px] text-ink">Settings</Text>
        <SectionLabel>Notifications</SectionLabel>
        <View className="rounded-3xl border border-cream-2 bg-paper"><PushSettings /></View>
        <SectionLabel>Privacy &amp; legal</SectionLabel>
        <View className="rounded-3xl border border-cream-2 bg-paper px-4">
          <SettingsLink title="Privacy Policy" detail="How your information is handled" external onPress={() => void openWebsitePage('/privacy')} />
          <SettingsLink title="Terms of Service" detail="Using Care Harbor" external onPress={() => void openWebsitePage('/terms')} />
          <SettingsLink title="Data Processing Agreement" detail="Agreement with your agency" external last onPress={() => void openWebsitePage('/dpa')} />
        </View>
        <SectionLabel>Account help</SectionLabel>
        <View className="rounded-3xl border border-cream-2 bg-paper px-4">
          <SettingsLink title="Reset password" detail="Opens secure recovery on the website" external onPress={() => void openWebsitePage('/forgot-password')} />
          <SettingsLink title="How to use the app" detail="Replay the short introduction" last onPress={() => router.push('/introduction')} />
        </View>
        <Text className="mt-3 text-sm leading-5 text-ink-soft">Contact your agency for help with your worker account or using the app.</Text>
        <Text className="mt-8 text-center font-mono text-xs text-muted">
          {Constants.expoConfig?.name ?? 'Care Harbor'} · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text accessibilityRole="header" className="mb-3 mt-5 font-mono text-xs uppercase tracking-widest text-ink-soft">{children}</Text>;
}

/** Layer 2: controlled navigation row. */
function SettingsLink({ title, detail, onPress, external = false, last = false }: {
  title: string; detail: string; onPress: () => void; external?: boolean; last?: boolean;
}) {
  return <Pressable accessibilityRole={external ? 'link' : 'button'}
    accessibilityHint={external ? 'Opens in your browser' : undefined} onPress={onPress}
    className={`min-h-16 flex-row items-center gap-3 py-4 ${last ? '' : 'border-b border-cream-2'}`}>
    <View className="flex-1 gap-1">
      <Text className="font-sans text-base text-ink">{title}</Text>
      <Text className="font-sans text-xs leading-5 text-ink-soft">{detail}</Text>
    </View>
    <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={18} color="#8A8378" />
  </Pressable>;
}
