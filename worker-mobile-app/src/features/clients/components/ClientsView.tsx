import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Btn } from '@/shared/components/ui/Btn';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { useMyClients } from '../hooks/useMyClients';
import { ClientCard } from './ClientCard';

/** Layer 3: owns search, navigation and the client query through a named hook. */
export function ClientsView() {
  const query = useMyClients();
  const refresh = useRefreshControl(query.refetch);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase();
  const clients = (query.data ?? []).filter(client =>
    `${client.first_name} ${client.last_name} ${client.city}`.toLocaleLowerCase().includes(term));

  return <FlatList className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
    data={query.isError ? [] : clients} keyExtractor={client => client.id}
    refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} showsVerticalScrollIndicator={false}
    ListHeaderComponent={<>
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">Your care circle</Text>
      <Text accessibilityRole="header" className="mt-2 font-serif text-4xl text-ink">My <Text className="font-serif-italic">clients.</Text></Text>
      <Text className="mt-2 font-sans text-sm leading-5 text-ink-soft">Familiar faces. Their care, and your time together.</Text>
      <View className="my-5 flex-row items-center gap-3 rounded-full border border-cream-2 bg-paper px-4">
        <Ionicons name="search-outline" size={19} color="#8A8378" />
        <TextInput accessibilityLabel="Search clients" placeholder="Search by name or city" placeholderTextColor="#8A8378"
          value={search} onChangeText={setSearch} autoCorrect={false} className="min-h-12 flex-1 font-sans text-sm text-ink" />
      </View>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-serif text-xl text-ink">People you care for</Text>
        {query.isSuccess ? <Text className="font-mono text-[10px] text-muted">{clients.length} {clients.length === 1 ? 'CLIENT' : 'CLIENTS'}</Text> : null}
      </View>
    </>}
    renderItem={({ item }) => <ClientCard client={item} onPress={() => router.push({ pathname: '/clients/[clientId]', params: { clientId: item.id } })} />}
    ListEmptyComponent={query.isPending ? <ActivityIndicator accessibilityLabel="Loading clients" color="#FF5A1F" />
      : query.isError ? <View className="rounded-2xl bg-paper p-5">
        <Text className="font-serif text-2xl text-ink">Couldn’t load your clients.</Text>
        <Text className="my-3 text-sm leading-5 text-ink-soft">Check your connection and try again.</Text>
        <Btn onPress={() => void query.refetch()}>Try again</Btn>
      </View> : <View className="rounded-2xl bg-paper p-6">
        <Ionicons name="people-outline" size={28} color="#8A8378" />
        <Text className="mt-4 font-serif text-2xl text-ink">{term ? 'No matching clients.' : 'Your care circle starts here.'}</Text>
        <Text className="mt-2 text-sm leading-5 text-ink-soft">{term ? 'Try another name or city.' : 'Clients appear when your agency assigns them to you or schedules a visit with you.'}</Text>
      </View>}
    ListFooterComponent={query.isSuccess && clients.length > 0 ? <Text className="mt-3 px-3 text-center text-xs leading-5 text-muted">Clients assigned to you or scheduled with you.{ '\n' }Only your own visits appear in their history.</Text> : null}
  />;
}
