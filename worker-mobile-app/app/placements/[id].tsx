import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { usePlacement, useExpressInterest, useWithdrawInterest } from '@/features/placements/hooks/usePlacement';
import { Kicker, Tag } from '@/shared/components/ui';

const STATUS_LABEL: Record<string, string> = {
  open:   'Open',
  filled: 'Filled',
  closed: 'Closed',
};

const labelClass = 'font-mono text-xs tracking-widest uppercase text-muted mb-1';

export default function PlacementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: placement, isLoading, isError } = usePlacement(id ?? '');
  const { mutate: express,  isPending: expressing  } = useExpressInterest(id ?? '');
  const { mutate: withdraw, isPending: withdrawing } = useWithdrawInterest(id ?? '');

  const [note, setNote]           = useState('');
  const [showNote, setShowNote]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#FF5A1F" />
      </SafeAreaView>
    );
  }

  if (isError || !placement) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-6">
        <Text className="font-sans text-sm text-orange">Placement not found.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-mono text-xs text-muted underline">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isOpen      = placement.status === 'open';
  const hasInterest = placement.has_interest;

  function handleExpress() {
    setError(null);
    express(note || undefined, {
      onSuccess: () => {
        setShowNote(false);
        setNote('');
      },
      onError: () => setError('Failed to express interest. Please try again.'),
    });
  }

  function handleWithdraw() {
    setError(null);
    withdraw(undefined, {
      onError: () => setError('Failed to withdraw interest. Please try again.'),
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* Header */}
      <View className="flex-row items-center border-b border-cream-2 bg-paper px-5 py-4">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color="#3D3935" />
        </Pressable>
        <View className="flex-1">
          <Kicker>Placement</Kicker>
          <Text className="font-serif-semibold text-xl text-ink leading-tight">Opportunity</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        <View className="mb-5 flex-row items-center gap-3">
          <Tag
            variant={
              placement.status === 'open' ? 'orange' :
              placement.status === 'filled' ? 'mint' : 'default'
            }
          >
            {STATUS_LABEL[placement.status] ?? placement.status}
          </Tag>
          {!isOpen && (
            <Text className="font-mono text-xs text-muted">
              This placement is no longer accepting interest
            </Text>
          )}
        </View>

        {/* Client */}
        <View className="mb-4">
          <Text className={labelClass}>Client</Text>
          <Text className="font-serif-semibold text-2xl text-ink leading-tight">
            {placement.client_first_name} {placement.client_last_name}
          </Text>
        </View>

        {/* Address */}
        <View className="mb-5 rounded-xl border border-cream-2 bg-paper p-4">
          <Text className={labelClass}>Address</Text>
          <Text className="font-sans text-base font-semibold text-ink">{placement.masked_location}</Text>
        </View>

        {/* Weekly care plan */}
        <View className="mb-4">
          <Text className={labelClass}>Weekly Care Plan</Text>
          <Text className="font-sans text-sm text-ink leading-relaxed">{placement.shift_description}</Text>
        </View>

        {/* Requirements */}
        {placement.requirements ? (
          <View className="mb-4">
            <Text className={labelClass}>Requirements</Text>
            <Text className="font-sans text-sm text-ink leading-relaxed">{placement.requirements}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View className="my-5 border-t border-cream-2" />

        {/* Interest action */}
        {isOpen && (
          <>
            {hasInterest ? (
              <View>
                <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-mint/20 p-4">
                  <Ionicons name="checkmark-circle" size={20} color="#3D3935" />
                  <Text className="font-sans text-sm font-medium text-ink">
                    You've expressed interest in this placement
                  </Text>
                </View>
                <Pressable
                  onPress={handleWithdraw}
                  disabled={withdrawing}
                  className="items-center rounded-xl border border-ink py-3.5"
                >
                  <Text className="font-mono text-sm uppercase tracking-widest text-ink">
                    {withdrawing ? 'Withdrawing…' : 'Withdraw Interest'}
                  </Text>
                </Pressable>
              </View>
            ) : showNote ? (
              <View>
                <Text className={labelClass}>Add a note (optional)</Text>
                <TextInput
                  className="rounded-xl border border-cream-2 bg-paper p-3 font-sans text-sm text-ink"
                  placeholder="e.g. I have experience with elderly clients and First Aid certification…"
                  placeholderTextColor="#8A8378"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={note}
                  onChangeText={setNote}
                />
                <View className="mt-3 flex-row gap-3">
                  <Pressable
                    onPress={handleExpress}
                    disabled={expressing}
                    className="flex-1 items-center rounded-xl bg-orange py-3.5"
                  >
                    <Text className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                      {expressing ? 'Sending…' : "I'm Interested"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowNote(false)}
                    className="items-center justify-center rounded-xl border border-cream-2 px-5 py-3.5"
                  >
                    <Text className="font-mono text-xs text-muted">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowNote(true)}
                className="items-center rounded-xl bg-orange py-4"
              >
                <Text className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                  I'm Interested
                </Text>
              </Pressable>
            )}

            {error ? (
              <Text className="mt-3 text-center font-mono text-xs text-orange">{error}</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
