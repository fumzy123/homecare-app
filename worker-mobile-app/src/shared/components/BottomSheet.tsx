import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Layer 2: presentation and keyboard handling only. */
export function BottomSheet({ title, subtitle, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 justify-end bg-black/40" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close sheet" accessibilityRole="button" />
        <View accessibilityViewIsModal className="max-h-[90%] rounded-t-3xl bg-paper px-5 pt-5" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
          <View className="mb-4 flex-row items-start gap-3">
            <View className="flex-1">
              <Text accessibilityRole="header" className="font-serif text-3xl text-ink">{title}</Text>
              {subtitle ? <Text className="mt-1 text-sm text-ink-soft">{subtitle}</Text> : null}
            </View>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full border border-cream-2" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sheet">
              <Ionicons name="close" size={22} color="#4A453E" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
