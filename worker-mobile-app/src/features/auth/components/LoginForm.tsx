import { View, Text, TextInput } from 'react-native';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Btn } from '@/shared/components/ui';
import { useSignIn } from '../hooks/useAuth';

const emailSchema = z.string().email('Enter a valid email address');
const passwordSchema = z.string().min(1, 'Password is required');

type Props = { onSuccess: () => void };

export function LoginForm({ onSuccess }: Props) {
  const { mutate: signIn, isPending, error } = useSignIn();

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      signIn(
        { email: value.email.trim(), password: value.password },
        { onSuccess },
      );
    },
  });

  const errorMessage = error ? (error as Error).message : null;

  return (
    <View>
      {errorMessage ? (
        <View className="mb-4 rounded-xl border border-rose bg-paper px-4 py-3">
          <Text className="font-sans text-sm text-ink">{errorMessage}</Text>
        </View>
      ) : null}

      <form.Field
        name="email"
        validators={{
          onBlur: ({ value }) => {
            const result = emailSchema.safeParse(value);
            return result.success ? undefined : result.error.errors[0].message;
          },
        }}
      >
        {(field) => (
          <View className="mb-4">
            <Text className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">
              Email
            </Text>
            <TextInput
              className="rounded-xl border border-cream-2 bg-paper px-4 py-3 font-sans text-base text-ink"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              placeholder="you@agency.com"
              placeholderTextColor="#8A8378"
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
              <Text className="mt-1 font-sans text-xs text-orange">
                {String(field.state.meta.errors[0])}
              </Text>
            ) : null}
          </View>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onBlur: ({ value }) => {
            const result = passwordSchema.safeParse(value);
            return result.success ? undefined : result.error.errors[0].message;
          },
        }}
      >
        {(field) => (
          <View className="mb-6">
            <Text className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">
              Password
            </Text>
            <TextInput
              className="rounded-xl border border-cream-2 bg-paper px-4 py-3 font-sans text-base text-ink"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor="#8A8378"
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
              <Text className="mt-1 font-sans text-xs text-orange">
                {String(field.state.meta.errors[0])}
              </Text>
            ) : null}
          </View>
        )}
      </form.Field>

      <Btn onPress={() => form.handleSubmit()} disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign In'}
      </Btn>
    </View>
  );
}
