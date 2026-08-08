import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useMyShiftDetail } from '../hooks/useMyShifts';
import {
  ShiftCareCard,
  ShiftInstructionsCard,
  ShiftLocationCard,
  ShiftTimeCard,
} from './ShiftDetailSections';

const STATUS = {
  scheduled: { label: 'Upcoming', bg: 'bg-orange-soft', text: 'text-orange' },
  in_progress: { label: 'In progress', bg: 'bg-orange', text: 'text-white' },
  completed: { label: 'Completed', bg: 'bg-mint', text: 'text-ink-soft' },
  cancelled: { label: 'Cancelled', bg: 'bg-cream-2', text: 'text-muted' },
} as const;

export function ShiftDetailView({ shiftId, occurrenceDate }: { shiftId: string; occurrenceDate: string }) {
  const { data: shift, isLoading, isError } = useMyShiftDetail(shiftId, occurrenceDate);

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#FF5A1F" /></View>;
  }

  if (isError || !shift) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-serif text-2xl text-ink">Shift not available.</Text>
        <Text className="mt-2 text-center font-sans text-sm leading-5 text-muted">
          It may have changed or no longer be assigned to you.
        </Text>
      </View>
    );
  }

  const status = STATUS[shift.completion_status];
  const dateLabel = new Date(`${shift.occurrence_date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const location = shift.location || `${shift.client.street}, ${shift.client.city}`;

  return (
    <ScrollView
      className="flex-1 px-5"
      contentContainerStyle={{ paddingTop: 18, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">Shift details</Text>
      <Text className="mt-2 font-serif-semibold text-4xl leading-[42px] text-ink">
        {shift.client.first_name} {shift.client.last_name}
      </Text>
      <View className="mt-3 flex-row items-center gap-3">
        <View className={`rounded-full px-3 py-1.5 ${status.bg}`}>
          <Text className={`font-mono text-[10px] uppercase tracking-wider ${status.text}`}>{status.label}</Text>
        </View>
        <Text className="flex-1 font-sans text-sm text-muted">{dateLabel}</Text>
      </View>

      <ShiftTimeCard shift={shift} />
      {location ? <ShiftLocationCard location={location} /> : null}
      {shift.client.medical_conditions ? <ShiftCareCard careFocus={shift.client.medical_conditions} /> : null}
      {shift.instructions ? <ShiftInstructionsCard instructions={shift.instructions} /> : null}
    </ScrollView>
  );
}
