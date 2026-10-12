import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '@/shared/utils/formatTime';
import { toDateKey } from '../lib/schedule';
import { formatGap, formatScheduleHours, occurrenceKey, type ScheduleDay } from '../lib/scheduleView';
import type { ShiftOccurrence } from '../types';
import { ScheduleVisitCard } from './ScheduleVisitCard';

/** Layer 2: full-width visit itinerary with honest gaps and a scheduled finish. */
export function ScheduleTimeline({ day, now, onSelectShift, onDirections, onCareInstructions, onNote }: {
  day: ScheduleDay; now: number; onSelectShift: (shift: ShiftOccurrence) => void;
  onDirections: (shift: ShiftOccurrence) => void; onCareInstructions: (shift: ShiftOccurrence) => void; onNote: (shift: ShiftOccurrence) => void;
}) {
  const finishDate = day.finish ? new Date(day.finish) : null;
  const finishLabel = day.finish ? `${formatTime(day.finish)}${finishDate && toDateKey(finishDate) !== day.key ? ` · ${finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}` : null;
  const ended = day.finish !== null && Date.parse(day.finish) <= now;
  return <View>
    <Text className="mb-4 text-xs leading-5 text-ink-soft">
      <Text className="font-semibold">{day.visitCount} {day.visitCount === 1 ? 'visit' : 'visits'}</Text> · {formatScheduleHours(day.hours)} hrs of care
      {finishLabel ? <> · {ended ? 'Last scheduled end' : 'Scheduled finish'} <Text className="font-semibold">{finishLabel}</Text></> : null}
    </Text>
    {day.visits.map((visit, index) => <View key={occurrenceKey(visit.shift)}>
      {visit.gapMinutes !== null ? <VisitGap minutes={visit.gapMinutes} /> : index ? <View className="h-3" /> : null}
      <ScheduleVisitCard visit={visit} onPress={() => onSelectShift(visit.shift)} onDirections={() => onDirections(visit.shift)}
        onCareInstructions={() => onCareInstructions(visit.shift)} onNote={() => onNote(visit.shift)} />
    </View>)}
    {finishLabel ? <View className="ml-7 flex-row items-start gap-2 border-l border-dashed border-cream-2 pb-1 pl-4 pt-4">
      <Ionicons name="sunny-outline" size={17} color="#4A453E" />
      <View className="flex-1"><Text className="text-xs text-ink-soft">{ended ? 'Last scheduled end' : 'Scheduled finish'} · <Text className="font-semibold">{finishLabel}</Text></Text>
        <Text className="mt-1 text-[11px] leading-4 text-ink-soft">{ended ? 'All scheduled visit times have ended.' : 'Nothing else scheduled after this visit.'}</Text>
      </View>
    </View> : null}
  </View>;
}

function VisitGap({ minutes }: { minutes: number }) {
  const conflict = minutes < 0;
  return <View className="ml-7 min-h-11 flex-row items-center gap-2 border-l border-dashed border-cream-2 py-3 pl-4">
    <Ionicons name={minutes > 0 ? 'cafe-outline' : 'alert-circle-outline'} size={15} color={conflict ? '#B43B19' : '#4A453E'} />
    <Text className={`flex-1 text-[11px] leading-4 ${conflict ? 'text-[#B43B19]' : 'text-ink-soft'}`}>
      {conflict ? `${formatGap(minutes)} overlap · Contact your agency` : minutes === 0 ? 'Back-to-back visits · Check travel arrangements' : `${formatGap(minutes)} between visits · Includes travel`}
    </Text>
  </View>;
}

export function NoShiftsForDay({ nextDay, onNextDay, onChooseDate }: { nextDay?: Date; onNextDay: () => void; onChooseDate: () => void }) {
  return <View className="items-center rounded-2xl border border-cream-2 bg-paper px-5 py-7">
    <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-mint/30"><Ionicons name="sunny-outline" size={28} color="#4A453E" /></View>
    <Text className="text-center font-serif text-3xl text-ink">A little room to <Text className="font-serif-italic">breathe.</Text></Text>
    <Text className="mb-4 mt-3 text-center text-sm leading-6 text-ink-soft">No visits scheduled for this day.{nextDay ? ` Your next working day in this period is ${nextDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.` : 'Choose another date to see what’s ahead.'}</Text>
    <Pressable accessibilityRole="button" onPress={nextDay ? onNextDay : onChooseDate} className="min-h-11 flex-row items-center gap-2 rounded-full border border-cream-2 px-4 py-3">
      <Text className="text-sm text-ink">{nextDay ? 'Next working day' : 'Choose a date'}</Text><Ionicons name="arrow-forward" size={15} color="#111111" />
    </Pressable>
  </View>;
}
