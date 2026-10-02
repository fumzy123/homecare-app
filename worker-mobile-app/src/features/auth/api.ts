import { supabase } from '@/shared/lib/api-client';
import { setPushUser, unregisterPush } from '@/features/notifications/lib/pushRegistration';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  try {
    await unregisterPush();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (error) {
    const { data: { session } } = await supabase.auth.getSession();
    setPushUser(session?.user.id ?? null);
    throw error;
  }
}
