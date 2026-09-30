import { ActivityIndicator, Text, View } from 'react-native';
import { Dialog } from '@/shared/components/Dialog';
import { Btn } from '@/shared/components/ui/Btn';
import { useMyShiftDetail } from '../hooks/useMyShifts';
import { serviceTypeLabel } from '../lib/schedule';
import type { ShiftOccurrence } from '../types';

/** Layer 3: load worker-scoped care instructions on demand, using the existing detail hook. */
export function ScheduleCareDialog({ shift, onClose }: { shift: ShiftOccurrence; onClose: () => void }) {
  const detail = useMyShiftDetail(shift.shift_id, shift.date);
  return <Dialog title={`${shift.client.first_name} ${shift.client.last_name}`} eyebrow="Before your visit" onClose={onClose}>
    {detail.isPending ? <ActivityIndicator accessibilityLabel="Loading care instructions" color="#FF5A1F" />
      : detail.isError ? <View><Text accessibilityRole="alert" className="mb-3 text-sm text-ink-soft">Care instructions could not be loaded.</Text><Btn onPress={() => void detail.refetch()}>Try again</Btn></View>
      : <View className="gap-4">
        <Text className="text-sm text-ink-soft">{serviceTypeLabel(detail.data.service_type)}</Text>
        <Text className="text-sm leading-6 text-ink">{detail.data.instructions || 'No care instructions have been added for this visit. Contact your agency if you need guidance.'}</Text>
        {detail.data.client.medical_conditions ? <View className="border-t border-cream-2 pt-3"><Text className="mb-2 font-mono text-xs uppercase text-ink-soft">Care focus</Text><Text className="text-sm leading-6 text-ink">{detail.data.client.medical_conditions}</Text></View> : null}
      </View>}
  </Dialog>;
}
