import { Redirect } from 'expo-router';

/** Retired onboarding URLs use the normal login/welcome entry point. */
export default function RetiredOnboardingScreen() {
  return <Redirect href="/" />;
}
