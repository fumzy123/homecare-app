import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Kicker, SectionHeader } from '@/shared/components/ui';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        <SectionHeader title="Good morning." subtitle="Here's your day at a glance." />

        <Card className="mb-4">
          <Kicker className="mb-2">Today's Shifts</Kicker>
          <Text className="font-sans text-sm text-muted">
            No shifts scheduled yet. Check your schedule tab.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
