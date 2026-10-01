import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/shared/components/ui/Avatar';
import type { WorkerClientProfile } from '../types';
import { ClientStatus } from './ClientCard';

/** Layer 2: identity and contact details shared across both client tabs. */
export function ClientProfileHeader({ client, onDirections, onCall }: {
  client: WorkerClientProfile;
  onDirections: () => void;
  onCall: (phone: string) => void;
}) {
  const locality = [client.city, client.province, client.postal_code].filter(Boolean).join(', ');
  const address = [client.street, locality].filter(Boolean).join('\n');
  const phone = client.phone_number?.trim();

  return <View className="mb-5 rounded-2xl bg-ink p-5">
    <View className="flex-row items-center justify-between">
      <Avatar initials={`${client.first_name.charAt(0)}${client.last_name.charAt(0)}`} size="lg" className="bg-lavender" />
      <ClientStatus status={client.status} />
    </View>
    <Text accessibilityRole="header" className="mt-4 font-serif text-4xl text-cream">
      {client.first_name}{'\n'}<Text className="font-serif-italic">{client.last_name}</Text>
    </Text>
    <Text className="mt-2 font-sans text-sm text-cream">
      Born {new Date(`${client.date_of_birth}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
    </Text>
    <View className="mt-5 border-t border-cream/20 pt-4">
      <View className="flex-row gap-3">
        <Ionicons name="location-outline" size={18} color="#F2EEE5" accessible={false} />
        <View className="flex-1">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-cream">Home address</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-cream">{address || 'Address not recorded'}</Text>
          {address ? <Pressable accessibilityRole="button" accessibilityLabel={`Get directions to ${address}`} onPress={onDirections} className="min-h-11 justify-center">
            <Text className="font-sans text-sm font-semibold text-cream underline">Get directions</Text>
          </Pressable> : null}
        </View>
      </View>
      <View className="mt-3 flex-row gap-3 border-t border-cream/20 pt-4">
        <Ionicons name="call-outline" size={18} color="#F2EEE5" accessible={false} />
        <View className="flex-1">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-cream">Client phone</Text>
          {phone ? <Pressable accessibilityRole="button" accessibilityLabel={`Call ${client.first_name} ${client.last_name} at ${phone}`} onPress={() => onCall(phone)} className="min-h-11 justify-center">
            <Text className="font-sans text-sm font-semibold text-cream underline">{phone}</Text>
          </Pressable> : <Text className="mt-1 text-sm text-cream">Phone number not recorded</Text>}
        </View>
      </View>
    </View>
  </View>;
}
