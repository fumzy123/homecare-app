import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DialogProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Layer 2: centered, scrollable information dialog with no domain state. */
export function Dialog({ title, eyebrow, onClose, children }: DialogProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close dialog" />
        <View accessibilityViewIsModal onAccessibilityEscape={onClose}
          className="w-full max-w-[400px] rounded-3xl border border-cream-2 bg-paper p-5"
          style={{ maxHeight: Math.max(0, height - insets.top - insets.bottom - 48) }}>
          <View className="mb-3 flex-row items-center justify-between gap-3">
            <Text className="flex-1 font-mono text-xs uppercase tracking-widest text-ink-soft">{eyebrow}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close dialog"
              className="h-11 w-11 items-center justify-center rounded-full border border-cream-2">
              <Ionicons name="close" size={22} color="#4A453E" />
            </Pressable>
          </View>
          <Text accessibilityRole="header" className="mb-4 font-serif text-3xl text-ink">{title}</Text>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 4 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
