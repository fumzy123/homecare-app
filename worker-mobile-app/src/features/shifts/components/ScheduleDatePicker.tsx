import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dialog } from '@/shared/components/Dialog';
import { toDateKey } from '../lib/schedule';
import { calendarMonthCells } from '../lib/scheduleView';

/** Layer 2: local month navigation; selection and dismissal are controlled by the caller. */
export function ScheduleDatePicker({ selectedDate, todayKey, onSelect, onClose }: {
  selectedDate: Date; todayKey: string; onSelect: (date: Date) => void; onClose: () => void;
}) {
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const rows = calendarMonthCells(month);
  return <Dialog title="Your calendar" eyebrow="Jump to a date" onClose={onClose}>
    <View className="mb-3 flex-row items-center justify-between">
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="h-11 w-11 items-center justify-center"><Ionicons name="chevron-back" size={18} color="#111111" /></Pressable>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="h-11 w-11 items-center justify-center"><Ionicons name="chevron-forward" size={18} color="#111111" /></Pressable>
    </View>
    <View className="mb-2 flex-row">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => <Text key={i} className="flex-1 text-center font-mono text-[10px] text-ink-soft">{label}</Text>)}</View>
    {rows.map((row, i) => <View key={i} className="flex-row">
      {row.map((date, j) => {
        if (!date) return <View key={`empty-${j}`} className="flex-1" />;
        const key = toDateKey(date), selected = key === toDateKey(selectedDate);
        return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }}
          accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${key === todayKey ? ', today' : ''}`}
          onPress={() => onSelect(date)} className={`min-h-11 flex-1 items-center justify-center rounded-full border ${key === todayKey ? 'border-orange' : 'border-transparent'} ${selected ? 'bg-ink' : ''}`}>
          <Text className={`text-sm ${selected ? 'text-paper' : 'text-ink'}`}>{date.getDate()}</Text>
        </Pressable>;
      })}
    </View>)}
    <Text className="mt-4 text-xs leading-5 text-ink-soft">The orange outline marks today.</Text>
  </Dialog>;
}
