import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { notificationPresentation } from '../lib/inboxView';

// Layer 2: controlled presentation only; data and interaction live in the inbox.
export function NotificationCard({ content, unread, time, visitState, disabled, onPress }: {
  content: ReturnType<typeof notificationPresentation>;
  unread: boolean;
  time: string;
  visitState?: 'loading' | 'error';
  disabled: boolean;
  onPress: () => void;
}) {
  return <Pressable onPress={onPress} disabled={disabled || (!unread && !content.hasDestination)}
    accessibilityRole="button" accessibilityState={{ disabled: disabled || (!unread && !content.hasDestination) }}
    accessibilityLabel={`${content.title}. ${content.context}. ${content.detail ?? ''} ${unread ? 'Unread.' : 'Read.'} ${content.action}`}
    className={`mb-3 rounded-[20px] border p-4 ${unread ? 'border-[#F4CBB6] bg-[#FFF0E8]' : 'border-cream-2 bg-paper'}`}>
    <View className="flex-row items-start gap-3">
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${unread ? 'bg-orange-soft' : 'bg-cream-2'}`}>
        <Ionicons name={content.icon} size={20} color={unread ? '#B13B0F' : '#59544B'} />
      </View>
      <View className="flex-1">
        {unread ? <View className="mb-1.5 flex-row items-center gap-1.5"><View className="h-1.5 w-1.5 rounded-full bg-orange" /><Text className="font-mono text-[10px] text-[#95340F]">UNREAD</Text></View> : null}
        <Text className="font-sans text-base font-semibold leading-6 text-ink">{content.title}</Text>
        <Text className="mt-1.5 font-sans text-sm leading-5 text-ink-soft">{content.context}</Text>
        {content.detail ? <Text className="mt-0.5 font-sans text-sm leading-5 text-ink-soft">{content.detail}</Text>
          : content.isVisit ? <Text className="mt-0.5 font-sans text-xs leading-5 text-ink-soft">{visitState === 'loading' ? 'Loading visit details…' : 'Open to check current visit details.'}</Text> : null}
      </View>
    </View>
    <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-[#E7DCCF] pt-3">
      <Text className="font-sans text-xs font-semibold text-[#B43D10]">{content.hasDestination ? `${content.action} →` : unread ? 'Mark as read' : 'Read'}</Text>
      <Text className="font-mono text-[10px] text-[#6E685E]">{time}</Text>
    </View>
  </Pressable>;
}
