import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui/Avatar';
import type { WorkerClient } from '../types';

export function ClientStatus({ status }: { status: WorkerClient['status'] }) {
  const labels = { active: 'Active care', on_hold: 'On hold', discharged: 'Discharged' };
  return <View className={`self-start rounded-full px-2.5 py-1 ${status === 'active' ? 'bg-mint' : 'bg-cream-2'}`}>
    <Text className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">{labels[status]}</Text>
  </View>;
}

/** Layer 2: a client summary with a controlled navigation action. */
export function ClientCard({ client, onPress }: { client: WorkerClient; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${client.first_name} ${client.last_name}'s profile and visits`}
    onPress={onPress} className="mb-3 rounded-2xl border border-cream-2 bg-paper p-4 active:opacity-70">
    <View className="flex-row items-center gap-3">
      <Avatar initials={`${client.first_name.charAt(0)}${client.last_name.charAt(0)}`} size="lg" />
      <View className="flex-1">
        <Text className="font-serif-medium text-2xl text-ink">{client.first_name} {client.last_name}</Text>
        <Text className="mt-1 font-sans text-xs text-ink-soft">{client.city}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A8378" />
    </View>
    <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2 border-t border-cream-2 pt-3">
      <ClientStatus status={client.status} />
      <Text className="font-sans text-xs text-ink-soft">Care profile & visits</Text>
    </View>
  </Pressable>;
}
