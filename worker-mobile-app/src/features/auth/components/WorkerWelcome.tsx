import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/shared/components/ui/Btn';
import { useWorkerEntry } from '../hooks/useWorkerEntry';
import { useSignOut } from '../hooks/useAuth';

const steps = [
  { title: 'Your day, in one place.', body: 'Home shows today’s shifts and your next visit. Open Schedule to see the days ahead.' },
  { title: 'Arrive prepared.', body: 'Open a shift to see the visit time, client address, care information, and instructions from your agency.' },
  { title: 'Keep your agency up to date.', body: 'Use Me to update your contact details and upload credentials. Check your notification inbox for agency updates.' },
];

export function WorkerWelcome({ replay = false, onDone }: { replay?: boolean; onDone?: () => void }) {
  const { account, completion, finish, isWorker } = useWorkerEntry();
  const signOut = useSignOut();
  const [step, setStep] = useState(replay ? 0 : -1);
  const [linkError, setLinkError] = useState(false);
  const busy = account.isPending || (isWorker && completion.isPending);
  const error = account.isError || completion.isError;
  const data = account.data;
  const webUrl = process.env.EXPO_PUBLIC_FRONTEND_URL;

  function done() {
    if (replay) onDone?.();
    else finish.mutate();
  }

  return <SafeAreaView className="flex-1 bg-cream">
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, justifyContent: 'center' }}>
      <Text className="mb-6 font-mono text-xs uppercase tracking-widest text-muted">Homecare Worker</Text>
      {busy ? <ActivityIndicator accessibilityLabel="Checking your agency" color="#FF5A1F" /> : error ? <>
        <Text className="font-serif text-3xl text-ink">We couldn’t finish loading.</Text>
        <Text className="my-5 text-base text-ink-soft">Check your connection and try again.</Text>
        <Btn onPress={() => { void account.refetch(); if (isWorker) void completion.refetch(); }}>Try again</Btn>
      </> : !isWorker ? <>
        <Text className="font-serif text-3xl text-ink">{data?.status === 'pending' ? 'Finish your account setup.' : data?.status === 'expired' ? 'Your invitation has expired.' : 'Worker access is unavailable.'}</Text>
        <Text className="my-5 text-base leading-6 text-ink-soft">{data?.status === 'pending'
          ? 'Finish setting up your name and password in your invitation email. If you already set a password, you can sign in on the setup page to resume.'
          : data?.status === 'active' ? 'This app is for home support workers. Use your agency’s web app for your account, or sign in with your worker email.'
          : 'Contact your agency to check your membership or request a new invitation.'}</Text>
        {data?.status === 'pending' && webUrl ? <Btn onPress={() => Linking.openURL(`${webUrl.replace(/\/$/, '')}/accept-invite`).catch(() => setLinkError(true))}>Finish setup on the web</Btn> : null}
        {linkError ? <Text accessibilityRole="alert" className="my-3 text-orange">Could not open the page. Open your invitation email instead.</Text> : null}
        <Btn className="mt-3" variant="ghost" onPress={() => account.refetch()}>I’ve finished setup — check again</Btn>
      </> : step === -1 ? <>
        <Text className="font-serif text-4xl text-ink">Welcome, {data?.first_name}.</Text>
        <Text className="mt-4 font-serif text-2xl text-ink">{data?.org_name}</Text>
        <Text className="my-6 text-base leading-6 text-ink-soft">Your agency is connected. Take a quick look around, or go straight to your day.</Text>
        <Btn onPress={() => setStep(0)}>Show me around</Btn>
        <Btn variant="ghost" className="mt-3" disabled={finish.isPending} onPress={done}>Skip to my day</Btn>
      </> : <>
        <Text className="mb-4 font-mono text-xs text-muted">{step + 1} of {steps.length}</Text>
        <Text className="font-serif text-4xl text-ink">{steps[step].title}</Text>
        <Text className="my-6 text-base leading-7 text-ink-soft">{steps[step].body}</Text>
        <Btn disabled={finish.isPending} onPress={() => step < steps.length - 1 ? setStep(step + 1) : done()}>{finish.isPending ? 'Saving…' : step < steps.length - 1 ? 'Next' : 'Go to my day'}</Btn>
        <Btn className="mt-3" variant="ghost" disabled={finish.isPending} onPress={done}>Skip introduction</Btn>
      </>}
      {finish.isError ? <Text accessibilityRole="alert" className="mt-4 text-orange">Could not save your introduction preference. Please try again.</Text> : null}
      {!replay ? <Btn className="mt-8" variant="ghost" disabled={signOut.isPending} onPress={() => signOut.mutate()}>Sign out</Btn> : null}
      {signOut.isError ? <Text accessibilityRole="alert" className="mt-3 text-orange">Could not sign out. Please try again.</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
