import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const cards = [
  {
    bg: 'bg-ink',
    textColor: 'text-cream',
    title: 'Your Agency Sets Your Schedule',
    body: 'Your manager assigns shifts. You get notified and can view every detail.',
  },
  {
    bg: 'bg-orange-soft',
    textColor: 'text-ink',
    title: "Check In at the Client's Door",
    body: "GPS-verified check-in confirms you've arrived. No paperwork needed.",
  },
  {
    bg: 'bg-mint',
    textColor: 'text-ink',
    title: 'Document Your Visit',
    body: 'Complete the flowsheet and add progress notes — by typing or speaking.',
  },
];

export default function HowItWorksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView className="flex-1 px-6 pt-12" showsVerticalScrollIndicator={false}>
        <Text className="mb-8 font-serif text-3xl text-ink">How it works</Text>

        {cards.map((card, i) => (
          <View key={i} className={`mb-4 rounded-2xl p-6 ${card.bg}`}>
            <Text className={`mb-2 font-serif text-xl ${card.textColor}`}>{card.title}</Text>
            <Text className={`font-sans text-sm leading-relaxed ${card.textColor} opacity-80`}>
              {card.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="px-6 pb-8 pt-4">
        <Pressable
          className="min-h-11 items-center justify-center rounded-full bg-orange px-8 py-3"
          onPress={() => router.push('/onboarding/get-started')}
        >
          <Text className="font-sans text-sm font-semibold text-white">Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
