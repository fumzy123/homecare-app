import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL ?? 'http://localhost:8000';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// Persists the Supabase session (JWT + refresh token) in the device's secure enclave
// so sign-in survives app restarts without requiring re-authentication.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

console.log('🛠️ INITIALIZED API CLIENT WITH BASE URL:', `${BACKEND_URL}/api`);

apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// On 401: let Supabase refresh the session and retry once
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    console.error('❌ API NETWORK ERROR:', error?.message, 'URL:', error?.config?.url);
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !data.session) return Promise.reject(error);
      original.headers.Authorization = `Bearer ${data.session.access_token}`;
      return apiClient(original);
    }
    return Promise.reject(error);
  },
);
