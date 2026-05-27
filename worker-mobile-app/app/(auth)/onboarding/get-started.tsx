import { View, Text, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Kicker, Btn } from '@/shared/components/ui';

const ACCEPT_INVITE_WEB_URL = process.env.EXPO_PUBLIC_FRONTEND_URL
  ? `${process.env.EXPO_PUBLIC_FRONTEND_URL}/accept-invite`
  : 'https://app.homecareapp.com/accept-invite';

export default function GetStartedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 justify-center px-8">
        <Kicker className="mb-4 text-center">Ready to begin</Kicker>
        <Text className="mb-3 text-center font-serif text-3xl text-ink">
          Your agency has sent you an invite.
        </Text>
        <Text className="mb-12 text-center font-sans text-sm text-muted">
          Workers can only join via an invite from their agency.
        </Text>

        <Btn
          className="mb-3"
          onPress={() => router.replace('/(auth)/login')}
        >
          Sign In
        </Btn>

        <Btn
          variant="ghost"
          onPress={() => Linking.openURL(ACCEPT_INVITE_WEB_URL)}
        >
          I Have an Invite Link
        </Btn>
      </View>
    </SafeAreaView>
  );
}
