import { Text, View } from 'react-native';
import { Btn } from '@/shared/components/ui/Btn';
import type { WorkerClientProfile } from '../types';

function CareField({ label, value, emphasis = false }: { label: string; value: string | null; emphasis?: boolean }) {
  return <View className={`mb-3 rounded-2xl border p-4 ${emphasis ? 'border-orange-soft bg-orange-soft' : 'border-cream-2 bg-paper'}`}>
    <Text className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">{label}</Text>
    <Text className="mt-2 text-sm leading-6 text-ink">{value?.trim() || 'Not recorded. Check with your agency if needed.'}</Text>
  </View>;
}

/** Layer 2: care information only, with device actions passed in by the domain view. */
export function ClientCareProfile({ client, onDirections, onCall }: {
  client: WorkerClientProfile; onDirections: () => void; onCall: (phone: string) => void;
}) {
  return <>
    <CareField label="Allergies" value={client.allergies} emphasis={Boolean(client.allergies?.trim())} />
    <CareField label="Care focus" value={client.medical_conditions} />
    <CareField label="Care instructions" value={client.special_instructions} />
    <CareField label="Medications on file" value={client.medications} />
    <View className="mb-3 rounded-2xl border border-cream-2 bg-paper p-4">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">At home</Text>
      <Text className="mt-2 text-sm leading-6 text-ink">{client.street}{'\n'}{client.city}, {client.province} {client.postal_code}</Text>
      <Btn variant="ghost" className="mt-3" onPress={onDirections}>Get directions</Btn>
      {client.phone_number ? <Btn variant="ghost" className="mt-2" onPress={() => onCall(client.phone_number!)}>Call client</Btn> : null}
    </View>
    <View className="mb-3 rounded-2xl border border-cream-2 bg-paper p-4">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">Emergency contact</Text>
      <Text className="mt-2 font-serif text-xl text-ink">{client.emergency_contact_name}</Text>
      <Text className="mt-1 text-sm text-ink-soft">{client.emergency_contact_relationship} · {client.emergency_contact_phone}</Text>
      {client.emergency_contact_phone ? <Btn variant="ghost" className="mt-3" onPress={() => onCall(client.emergency_contact_phone)}>Call contact</Btn> : null}
    </View>
  </>;
}
