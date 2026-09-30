import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Btn } from '@/shared/components/ui/Btn';
import { useMyClient } from '../hooks/useMyClients';
import { useRefreshClient } from '../hooks/useRefreshClient';
import { ClientStatus } from './ClientCard';
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
    <View className="mb-5 rounded-2xl bg-ink p-5">
      <View className="flex-row items-center justify-between"><Avatar initials={`${client.first_name.charAt(0)}${client.last_name.charAt(0)}`} size="lg" className="bg-lavender" /><ClientStatus status={client.status} /></View>
      <Text accessibilityRole="header" className="mt-4 font-serif text-4xl text-cream">{client.first_name}{'\n'}<Text className="font-serif-italic">{client.last_name}</Text></Text>
      <Text className="mt-3 font-sans text-sm text-cream">{client.city}</Text>
      <Text className="mt-2 font-mono text-[10px] text-cream">Born {new Date(`${client.date_of_birth}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
    </View>
    <View className="mb-5 flex-row rounded-full bg-cream-2 p-1">
      {(['visits', 'profile'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)}
        className={`min-h-11 flex-1 items-center justify-center rounded-full ${tab === value ? 'bg-paper' : ''}`}>
        <Text className={`text-sm font-semibold ${tab === value ? 'text-ink' : 'text-muted'}`}>{value === 'visits' ? 'Your visits' : 'Care profile'}</Text>
      </Pressable>)}
    </View>
    {tab === 'visits' ? <ClientVisits clientId={clientId} /> : <ClientCareProfile client={client}
      onDirections={() => void openLink(`https://maps.google.com/?q=${encodeURIComponent(`${client.street}, ${client.city}, ${client.province} ${client.postal_code}`)}`)}
      onCall={phone => void openLink(`tel:${phone.replace(/[^+\d]/g, '')}`)} />}
  </ScrollView>;
}
