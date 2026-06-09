import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTodayShifts } from '@/features/shifts/hooks/useMyShifts';
import { useWorkerProfile } from '@/features/profile/hooks/useWorkerProfile';
import { useWorkerStats } from '@/features/profile/hooks/useWorkerStats';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { WorkerStatsRow } from '@/features/home/components/WorkerStatsRow';
import { NextShiftCard } from '@/features/home/components/NextShiftCard';
import { LaterTodaySection } from '@/features/home/components/LaterTodaySection';
import { NeedsYouToday } from '@/features/home/components/NeedsYouToday';
import { ComplianceAlert } from '@/features/profile/components/ComplianceAlert';
import { useMyCredentials } from '@/features/profile/hooks/useMyCredentials';
import { useMyNotifications } from '@/features/notifications/hooks/useMyNotifications';
import type { ShiftOccurrence } from '@/features/shifts/types';

function partitionShifts(shifts: ShiftOccurrence[]) {
  const active = shifts.filter((s) => s.completion_status !== 'cancelled');
  const next = active.find((s) => s.completion_status !== 'completed') ?? null;
  const later = active.filter((s) => s !== next && s.completion_status !== 'completed');
  return { next, later, total: active.length };
}

export default function HomeScreen() {
  const { data: shifts = [], isLoading: shiftsLoading, isError: shiftsError, refetch } = useTodayShifts();
  const { data: profile } = useWorkerProfile();
  const { data: stats } = useWorkerStats();
  const { data: credentials = [] } = useMyCredentials();
  const { data: notificationsData } = useMyNotifications();
  const { refreshing, onRefresh } = useRefreshControl(refetch);

  const { next, later, total } = partitionShifts(shifts);
  const nextIndex = next ? shifts.filter((s) => s.completion_status !== 'cancelled').indexOf(next) + 1 : 1;

  const isLoading = shiftsLoading && !refreshing;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF5A1F"
            colors={['#FF5A1F']}
          />
        }
      >
        <HomeHeader profile={profile} notificationCount={notificationsData?.unread_count ?? 0} />

        <WorkerStatsRow stats={stats} />

        <ComplianceAlert
          credentials={credentials}
          className="mt-4 border border-ink bg-orange-soft p-3.5"
        />

        {isLoading && (
          <View className="mt-8 items-center">
            <ActivityIndicator color="#FF5A1F" />
          </View>
        )}

        {shiftsError && (
          <View className="mt-4 rounded-xl bg-rose px-4 py-3">
            <Text className="font-sans text-sm text-ink">
              Could not load shifts. Check your connection and try again.
            </Text>
          </View>
        )}

        {!isLoading && !shiftsError && (
          <>
            {next ? (
              <NextShiftCard
                shift={next}
                shiftIndex={nextIndex}
                totalToday={total}
              />
            ) : (
              <View className="mt-4 rounded-2xl border border-cream-2 bg-paper px-5 py-6">
                <Text className="font-serif text-xl text-ink">No shifts today.</Text>
                <Text className="mt-2 font-sans text-sm text-muted">
                  Enjoy your day off. Your next shift will appear here when it's scheduled.
                </Text>
              </View>
            )}

            <LaterTodaySection shifts={later} />

            <NeedsYouToday actions={[]} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
