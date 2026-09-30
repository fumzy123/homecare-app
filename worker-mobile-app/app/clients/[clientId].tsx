import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ClientDetailView } from '@/features/clients/components/ClientDetailView';

export default function ClientDetailScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  return <SafeAreaView className="flex-1 bg-cream">
    <View className="flex-row items-center border-b border-cream-2 bg-paper px-5 py-3">
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/clients')}
        accessibilityRole="button" accessibilityLabel="Back to clients" className="mr-3 h-11 w-11 items-center justify-center rounded-full">
        <Ionicons name="arrow-back" size={22} color="#111111" />
      </Pressable>
      <Text className="font-mono text-xs uppercase tracking-widest text-muted">Clients</Text>
    </View>
    <ClientDetailView key={clientId} clientId={clientId} />
  </SafeAreaView>;
}
