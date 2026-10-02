import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dialog } from '@/shared/components/Dialog';
import { Btn } from '@/shared/components/ui/Btn';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { useSignOut } from '@/features/auth/hooks/useAuth';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { useMyCredentials } from '../hooks/useMyCredentials';
import { DOCUMENT_TYPE_LABELS, type WeekDay } from '../types';
import { displayDate, documentState, documentSummary, humanize, WEEK_DAYS } from '../lib/profileView';
import { ProfileIdentity, ProfileRow, ReadOnlyDetail, WorkingWeek } from './ProfileOverview';
import { ProfileDetailsDialog, type EditableProfileSection } from './ProfileDetailsDialog';
import { AvailabilityDialog } from './AvailabilityDialog';
import { DocumentsDialog } from './DocumentsDialog';

type Panel = EditableProfileSection | 'employment' | 'availability' | 'documents' | 'support' | null;

/** Layer 3: owns profile queries and focused dialogs; routes only compose the screen. */
export function WorkerMe({ openPersonalDetails = false }: { openPersonalDetails?: boolean }) {
  const profileQuery = useWorkerProfile();
  const credentials = useMyCredentials();
  const signOut = useSignOut();
  const [panel, setPanel] = useState<Panel>(openPersonalDetails ? 'personal' : null);
  const [selectedDay, setSelectedDay] = useState<WeekDay>(WEEK_DAYS[new Date().getDay()].key);
  const { refreshing, onRefresh } = useRefreshControl(() => Promise.all([profileQuery.refetch(), credentials.refetch()]));
  const profile = profileQuery.data;
  const close = () => setPanel(null);
  if (!profile) return <View className="flex-1 items-center justify-center gap-4 px-6">
    {profileQuery.isPending ? <ActivityIndicator size="large" color="#FF5A1F" accessibilityLabel="Loading your profile" /> : <>
      <Text accessibilityRole="alert" className="text-center font-sans text-base text-ink">We couldn’t load your profile. Please try again.</Text>
      <Btn accessibilityRole="button" onPress={() => void profileQuery.refetch()}>Try again</Btn>
    </>}
  </View>;
  const renewal = credentials.isError ? undefined : credentials.data?.find(item => documentState(item) === 'expired')
    ?? credentials.data?.find(item => documentState(item) === 'expiring');
  const requestSignOut = () => Alert.alert('Sign out?', 'You can sign in again whenever you need.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate(undefined, {
      onError: () => Alert.alert('Could not sign out', 'Please try again.'),
    }) },
  ]);
  return <>
    <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5A1F" />}>
      <Text accessibilityRole="header" className="mb-7 font-serif text-[42px] leading-[48px] text-ink">My Profile</Text>
      {profileQuery.isError && <Text accessibilityRole="alert" className="mb-4 font-sans text-sm text-red-700">Couldn’t refresh your profile. Pull down to try again.</Text>}
      <ProfileIdentity profile={profile} onOpen={() => setPanel('personal')} />
      {renewal && <Pressable accessibilityRole="button" onPress={() => setPanel('documents')} className="mb-6 flex-row items-center gap-3 rounded-2xl bg-orange-soft p-4">
        <Ionicons name="document-text-outline" size={23} color="#111" />
        <View className="flex-1 gap-1"><Text className="font-sans text-sm font-semibold text-ink">{documentState(renewal) === 'expired' ? 'A document needs renewing' : 'A renewal is coming up'}</Text>
          <Text className="font-sans text-xs leading-5 text-ink-soft">{DOCUMENT_TYPE_LABELS[renewal.document_type]} · {displayDate(renewal.expiry_date)}</Text></View>
        <Ionicons name="chevron-forward" size={18} color="#111" />
      </Pressable>}
      <WorkingWeek entries={profile.availability} selected={selectedDay} onSelect={setSelectedDay} cap={profile.max_hours_per_week} onEdit={() => setPanel('availability')} />
      <Text accessibilityRole="header" className="mb-4 font-serif text-3xl text-ink">Ready for care</Text>
      <View className="rounded-3xl border border-cream-2 bg-paper px-4">
        <ProfileRow title="Employment details" icon="briefcase-outline" detail={[humanize(profile.employment_type), profile.hire_date ? `Joined ${displayDate(profile.hire_date)}` : ''].filter(Boolean).join(' · ')} onPress={() => setPanel('employment')} />
        <ProfileRow title="Credentials & documents" icon="document-text-outline" detail={credentials.isPending ? 'Loading documents…' : credentials.isError ? 'Couldn’t load documents · Tap to retry' : documentSummary(credentials.data)} onPress={() => setPanel('documents')} />
        <ProfileRow title="Care preferences" icon="heart-outline" detail="Languages, transport and comfort around pets" onPress={() => setPanel('preferences')} />
        <ProfileRow title="Emergency contact" icon="call-outline" detail={profile.emergency_contact_name ? [profile.emergency_contact_name, profile.emergency_contact_relationship].filter(Boolean).join(' · ') : 'Add someone your agency can contact'} last onPress={() => setPanel('emergency')} />
      </View>
      <Pressable accessibilityRole="button" onPress={() => setPanel('support')} className="mt-7 min-h-16 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-mint"><Ionicons name="chatbubble-ellipses-outline" size={22} color="#111" /></View>
        <View className="flex-1 gap-1"><Text className="font-serif text-xl text-ink">Your agency is here for you.</Text><Text className="font-sans text-xs text-ink-soft">Contact your care coordinator</Text></View>
        <Ionicons name="chevron-forward" size={18} color="#111" />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={requestSignOut} disabled={signOut.isPending} className="mt-6 min-h-12 items-center justify-center border-t border-cream-2 pt-4">
        <Text className="font-sans text-sm text-ink-soft">{signOut.isPending ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </ScrollView>
    {(panel === 'personal' || panel === 'preferences' || panel === 'emergency') && <ProfileDetailsDialog key={panel} profile={profile} section={panel} onClose={close} />}
    {panel === 'availability' && <AvailabilityDialog entries={profile.availability} onClose={close} />}
    {panel === 'documents' && <DocumentsDialog onClose={close} />}
    {panel === 'employment' && <Dialog title="Employment details" eyebrow="Ready for care" onClose={close}>
      <ReadOnlyDetail label="Agency" value={profile.agency_name} />
      <ReadOnlyDetail label="Role" value={humanize(profile.role)} />
      <ReadOnlyDetail label="Employment type" value={humanize(profile.employment_type)} />
      <ReadOnlyDetail label="Employment status" value={humanize(profile.employment_status)} />
      <ReadOnlyDetail label="Start date" value={displayDate(profile.hire_date)} />
      <ReadOnlyDetail label="Weekly hours limit" value={profile.max_hours_per_week === null ? 'Not set by agency' : `${profile.max_hours_per_week} hours`} />
      <Text className="font-sans text-sm leading-6 text-ink-soft">These details are maintained by {profile.agency_name}. Contact your care coordinator if something needs correcting.</Text>
    </Dialog>}
    {panel === 'support' && <Dialog title="Your care coordinator" eyebrow={profile.agency_name} onClose={close}>
      <Text className="font-sans text-base leading-6 text-ink">For help with your employment details, availability or documents, contact your agency using the contact information provided during onboarding.</Text>
      <Text className="mt-4 font-sans text-sm leading-5 text-ink-soft">Your agency’s phone number is not available in the app yet.</Text>
    </Dialog>}
  </>;
}
