import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NoteEntry } from '../api';

export function noteEntryLabel(index: number) {
  return index === 0 ? 'Progress note' : `Follow-up ${index}`;
}

/** Layer 2: presents a saved entry; the parent owns reader navigation. */
export function SavedNoteEntry({ entry, index, onRead }: {
  entry: NoteEntry;
  index: number;
  onRead: () => void;
}) {
  const long = entry.content.length > 240 || entry.content.split(/\r?\n/).length > 4;
  const label = noteEntryLabel(index);
  return <View className="mb-3 rounded-2xl border border-ink-soft bg-white p-4">
    <View className="mb-2 flex-row flex-wrap items-center gap-2">
      <Ionicons name="document-text" size={18} color="#4A453E" />
      <Text accessibilityRole="header" className="flex-1 font-sans text-sm font-semibold text-ink">{label}</Text>
      <Text className="font-mono text-xs text-ink-soft">{entry.time}</Text>
    </View>
    <Text numberOfLines={long ? 4 : undefined} className="font-sans text-base leading-6 text-ink">{entry.content}</Text>
    {long ? <Pressable accessibilityRole="button" accessibilityLabel={`Read full ${label.toLowerCase()}, ${entry.time}`}
      onPress={onRead} className="mt-2 min-h-11 flex-row items-center gap-2">
      <Text className="font-sans text-sm font-semibold text-ink underline">Read full note</Text>
      <Ionicons name="arrow-forward" size={18} color="#111111" />
    </Pressable> : null}
  </View>;
}
