import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kicker } from '@/shared/components/ui';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Kicker className="mb-3 text-center">Sign In</Kicker>
            <Text className="mb-8 text-center font-serif text-3xl text-ink">
              Welcome back.
            </Text>
            <LoginForm onSuccess={() => router.replace('/(tabs)/home')} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
