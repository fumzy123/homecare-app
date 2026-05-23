import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL ?? 'http://localhost:8000';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: refresh session and retry once
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !data.session) return Promise.reject(error);
      await SecureStore.setItemAsync('access_token', data.session.access_token);
      original.headers.Authorization = `Bearer ${data.session.access_token}`;
      return apiClient(original);
    }
    return Promise.reject(error);
  },
);
