import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Btn } from '@/shared/components/ui/Btn';
import { useMyClient } from '../hooks/useMyClients';
import { useRefreshClient } from '../hooks/useRefreshClient';
import { ClientProfileHeader } from './ClientProfileHeader';
import { ClientCareProfile } from './ClientCareProfile';
import { ClientVisits } from './ClientVisits';

export function ClientDetailView({ clientId }: { clientId: string }) {
  const query = useMyClient(clientId);
  const refresh = useRefreshClient(clientId);
  const [tab, setTab] = useState<'visits' | 'profile'>('visits');
  async function openLink(url: string) {
    try { await Linking.openURL(url); }
    catch { Alert.alert('Could not open this app', 'You can use the contact details shown on this profile.'); }
  }
  if (query.isPending) return <ActivityIndicator className="mt-10" accessibilityLabel="Loading client profile" color="#FF5A1F" />;
  if (query.isError || !query.data) return <View className="p-6">
    <Text className="font-serif text-2xl text-ink">Client not available.</Text>
    <Text className="my-3 text-sm leading-5 text-ink-soft">Your connection or assignment may have changed.</Text>
    <Btn onPress={() => void query.refetch()}>Try again</Btn>
  </View>;
  const client = query.data;
  return <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor="#FF5A1F" />}>
    <ClientProfileHeader client={client}
      onDirections={() => void openLink(`https://maps.google.com/?q=${encodeURIComponent([client.street, client.city, client.province, client.postal_code].filter(Boolean).join(', '))}`)}
      onCall={phone => void openLink(`tel:${phone.replace(/[^+\d]/g, '')}`)} />
    <View className="mb-5 flex-row rounded-full bg-cream-2 p-1">
      {(['visits', 'profile'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)}
        className={`min-h-11 flex-1 items-center justify-center rounded-full ${tab === value ? 'bg-paper' : ''}`}>
        <Text className={`text-sm font-semibold ${tab === value ? 'text-ink' : 'text-muted'}`}>{value === 'visits' ? 'Your visits' : 'Care profile'}</Text>
      </Pressable>)}
    </View>
    {tab === 'visits' ? <ClientVisits clientId={clientId} /> : <ClientCareProfile client={client}
      onCall={phone => void openLink(`tel:${phone.replace(/[^+\d]/g, '')}`)} />}
  </ScrollView>;
}
