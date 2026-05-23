import { useMutation } from '@tanstack/react-query';
import { signIn, signOut } from '../api';
import { useAuthStore } from '@/shared/lib/auth-store';

export function useSignIn() {
  const { setSession } = useAuthStore();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
    onSuccess: (session) => {
      setSession(session);
    },
  });
}

export function useSignOut() {
  const { setSession } = useAuthStore();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      setSession(null);
    },
  });
}
