import { Text, View } from 'react-native';
import { Btn } from '@/shared/components/ui/Btn';
import type { WorkerClientProfile } from '../types';

function CareField({ label, value }: { label: string; value: string | null }) {
  return <View>
    <Text className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">{label}</Text>
    <Text className="mt-2 text-sm leading-6 text-ink">{value?.trim() || 'Not recorded. Check with your agency if needed.'}</Text>
  </View>;
}

/** Layer 2: grouped care information, with device actions supplied by the domain view. */
export function ClientCareProfile({ client, onCall }: {
  client: WorkerClientProfile; onCall: (phone: string) => void;
}) {
  const contactName = client.emergency_contact_name?.trim();
  const contactPhone = client.emergency_contact_phone?.trim();
  const relationship = client.emergency_contact_relationship?.trim();

  return <>
    <View className={`mb-4 rounded-2xl border border-ink p-4 ${client.allergies?.trim() ? 'bg-orange-soft' : 'bg-paper'}`}>
      <Text accessibilityRole="header" className="mb-2 font-serif text-2xl text-ink">Allergies</Text>
      <Text className="font-sans text-sm leading-6 text-ink">{client.allergies?.trim() || 'Not recorded. Check with your agency if needed.'}</Text>
    </View>

    <View className="mb-4 rounded-2xl border border-ink bg-paper p-4">
      <Text accessibilityRole="header" className="mb-4 font-serif text-2xl text-ink">Daily care</Text>
      <CareField label="Care focus" value={client.medical_conditions} />
      <View className="mt-4 border-t border-cream-2 pt-4">
        <CareField label="Care instructions" value={client.special_instructions} />
      </View>
    </View>

    <View className="mb-4 rounded-2xl border border-ink bg-paper p-4">
      <Text accessibilityRole="header" className="mb-2 font-serif text-2xl text-ink">Medications on file</Text>
      <Text className="font-sans text-sm leading-6 text-ink">{client.medications?.trim() || 'Not recorded. Check with your agency if needed.'}</Text>
    </View>

    <View className="mb-4 rounded-2xl border border-ink bg-paper p-4">
      <Text accessibilityRole="header" className="mb-3 font-serif text-2xl text-ink">Emergency contact</Text>
      <Text className="font-sans text-base font-semibold text-ink">{contactName || 'Contact name not recorded'}</Text>
      {relationship ? <Text className="mt-1 font-sans text-sm text-ink-soft">{relationship}</Text> : null}
      <Text className="mt-2 font-sans text-sm text-ink">{contactPhone || 'Phone number not recorded'}</Text>
      {contactPhone ? <Btn accessibilityRole="button" accessibilityLabel={`Call emergency contact ${contactName || ''} at ${contactPhone}`} variant="ghost" className="mt-4" onPress={() => onCall(contactPhone)}>Call emergency contact</Btn> : null}
    </View>
  </>;
}
