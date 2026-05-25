import { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Dimensions,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Btn } from '@/shared/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_SEEN_KEY = 'onboarding_seen';

const HOW_IT_WORKS_CARDS = [
  {
    id: '1',
    title: 'Your Agency Sets Your Schedule',
    body: 'Your manager assigns your shifts. You\'ll see upcoming visits, client details, and start times all in one place.',
    bg: 'bg-mint-soft',
  },
  {
    id: '2',
    title: 'Check In at the Client\'s Door',
    body: 'When you arrive, tap check-in. Your location confirms you\'re there — no paperwork, no phone calls.',
    bg: 'bg-orange-soft',
  },
  {
    id: '3',
    title: 'Document Your Visit',
    body: 'Log your flowsheet tasks and write progress notes during or after each visit. Everything stays on record.',
    bg: 'bg-lavender',
  },
];

function WelcomePage({ onNext }: { onNext: () => void }) {
  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 bg-cream">
      <SafeAreaView className="flex-1">
        <View className="grid-bg absolute inset-0 opacity-40" />
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-ink">
            <Text className="font-mono text-2xl text-cream">HC</Text>
          </View>
          <Text className="mb-4 text-center font-serif text-4xl leading-tight text-ink">
            Care, Delivered.
          </Text>
          <Text className="mb-12 text-center font-sans text-base leading-relaxed text-muted">
            Your shifts, notes, and clients — all in one place.
          </Text>
          <Btn onPress={onNext} className="w-full">
            Get Started
          </Btn>
        </View>
      </SafeAreaView>
    </View>
  );
}

function HowItWorksPage({ onNext }: { onNext: () => void }) {
  const [activeCard, setActiveCard] = useState(0);

  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 bg-cream">
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6 pt-12">
          <Text className="mb-1 text-center font-mono text-xs uppercase tracking-widest text-muted">
            How It Works
          </Text>
          <Text className="mb-8 text-center font-serif text-3xl text-ink">
            Built for your day.
          </Text>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48));
              setActiveCard(index);
            }}
            style={{ flexGrow: 0 }}
          >
            {HOW_IT_WORKS_CARDS.map((card) => (
              <View
                key={card.id}
                style={{ width: SCREEN_WIDTH - 48 }}
                className={`mr-0 min-h-48 rounded-2xl border border-line-faint p-6 ${card.bg}`}
              >
                <Text className="mb-3 font-serif text-xl leading-snug text-ink">
                  {card.title}
                </Text>
                <Text className="font-sans text-sm leading-relaxed text-ink-soft">
                  {card.body}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="mt-4 flex-row items-center justify-center gap-2">
            {HOW_IT_WORKS_CARDS.map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${
                  i === activeCard ? 'w-6 bg-ink' : 'w-1.5 bg-muted opacity-40'
                }`}
              />
            ))}
          </View>
        </View>

        <View className="px-6 pb-8 pt-6">
          <Btn onPress={onNext}>Next</Btn>
        </View>
      </SafeAreaView>
    </View>
  );
}

function GetStartedPage() {
  const handleSignIn = async () => {
    await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, 'true');
    router.replace('/auth/login');
  };

  const handleInviteLink = () => {
    const webUrl = process.env.EXPO_PUBLIC_BACKEND_API_URL?.replace(':8000', ':5173') ?? 'http://localhost:5173';
    Linking.openURL(`${webUrl}/accept-invite`);
  };

  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 bg-cream">
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
            Ready to Begin
          </Text>
          <Text className="mb-3 text-center font-serif text-3xl leading-snug text-ink">
            Your agency has sent you an invite.
          </Text>
          <Text className="mb-12 text-center font-sans text-sm leading-relaxed text-muted">
            Workers can only join via an invite from their agency.
          </Text>

          <View className="w-full gap-3">
            <Btn onPress={handleSignIn} className="w-full">
              Sign In
            </Btn>
            <Btn variant="ghost" onPress={handleInviteLink} className="w-full">
              I Have an Invite Link
            </Btn>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const PAGES = [WelcomePage, HowItWorksPage, GetStartedPage];

export default function OnboardingScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const goToNext = () => {
    const next = currentPage + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentPage(next);
  };

  return (
    <FlatList
      ref={flatListRef}
      data={PAGES}
      keyExtractor={(_, i) => String(i)}
      horizontal
      pagingEnabled
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item: Page, index }) => (
        <Page onNext={index < PAGES.length - 1 ? goToNext : undefined} />
      )}
      style={{ flex: 1 }}
    />
  );
}
