import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
  const [viewportHeight, setViewportHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() => Keyboard.metrics()?.screenY ?? null);
  const [entrance] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', event => setKeyboardTop(event.endCoordinates.screenY));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Android may resize the modal or draw the IME over it (including in Expo Go).
  // Use the smaller viewport, not keyboard height subtraction, to avoid applying
  // the inset twice when Android has already resized the native window.
  const availableHeight = Platform.OS === 'android' && keyboardTop !== null
    ? Math.min(viewportHeight, keyboardTop) : viewportHeight;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduceMotion => {
      if (!active) return;
      Animated.timing(entrance, {
        toValue: 1, duration: reduceMotion ? 0 : 160,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    }).catch(() => entrance.setValue(1));
    return () => { active = false; entrance.stopAnimation(); };
  }, [entrance]);
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ justifyContent: 'flex-end', paddingTop: insets.top + 12, ...(availableHeight > 0 ? { height: availableHeight } : { flex: 1 }) }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onClose} accessibilityLabel="Close sheet" accessibilityRole="button" />
        <Animated.View accessibilityViewIsModal className="rounded-t-3xl bg-paper px-5 pt-5" style={{ maxHeight: '100%', flexShrink: 1, paddingBottom: keyboardTop !== null ? 12 : Math.max(insets.bottom, 20), opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
          <View className="mb-4 flex-row items-start gap-3">
            <View className="flex-1">
              <Text accessibilityRole="header" className="font-serif text-3xl text-ink">{title}</Text>
              {subtitle ? <Text className="mt-1 text-sm text-ink-soft">{subtitle}</Text> : null}
            </View>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full border border-cream-2" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sheet">
              <Ionicons name="close" size={22} color="#4A453E" />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
