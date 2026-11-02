import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { DevicePushToken } from 'expo-notifications';
import { supabase } from '@/shared/lib/api-client';
import { revokePushDevice, savePushDevice } from '../api';

const KEY = 'push-installation-v1';
type Installation = { id: string; secret: string; owner?: string };
let queue: Promise<unknown> = Promise.resolve();
let enabledUser: string | null = null;
let registrationController = new AbortController();

// Token acquisition can wait indefinitely on native/Expo networking. Only race
// this read: registration/revocation writes must stay ordered in the queue.
function waitForToken<T>(lookup: () => Promise<T>, signal: AbortSignal): Promise<T | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); resolve(null); };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Phone notification registration timed out. Please try again.'));
    }, 15_000);
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(lookup).then(
      value => { cleanup(); resolve(value); },
      error => { cleanup(); reject(error); },
    );
  });
}

export function supportsPush() {
  return Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

// Keep native push imports out of Expo Go. All registration/cleanup is serialized.
export async function nativeNotifications() {
  if (!supportsPush()) return null;
  return import('expo-notifications');
}

function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => undefined);
  return result;
}

async function readInstallation(): Promise<Installation | null> {
  const saved = await SecureStore.getItemAsync(KEY);
  return saved ? JSON.parse(saved) : null;
}

async function revoke() {
  const saved = await readInstallation();
  if (!saved?.owner) return;
  await revokePushDevice(saved.id, saved.secret);
  delete saved.owner;
  await SecureStore.setItemAsync(KEY, JSON.stringify(saved));
}

export function setPushUser(userId: string | null) {
  if (enabledUser !== userId) {
    registrationController.abort();
    registrationController = new AbortController();
  }
  enabledUser = userId;
}

export function unregisterPush() {
  setPushUser(null);
  if (!supportsPush()) return Promise.resolve();
  return serial(revoke);
}

export function registerPush(userId: string, requestPermission = false, devicePushToken?: DevicePushToken) {
  const signal = registrationController.signal;
  return serial(async () => {
    if (!supportsPush()) return 'unsupported' as const;
    if (signal.aborted || enabledUser !== userId) return 'off' as const;
    const notifications = await nativeNotifications();
    if (!notifications) return 'unsupported' as const;
    let saved = await readInstallation();
    if (saved?.owner && saved.owner !== userId) await revoke();
    if (signal.aborted || enabledUser !== userId) return 'off' as const;
    await notifications.setNotificationChannelAsync('default', {
      name: 'Work updates', importance: notifications.AndroidImportance.HIGH,
    });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain) {
      permission = await notifications.requestPermissionsAsync();
    }
    if (!permission.granted) {
      await revoke();
      return permission.canAskAgain ? 'off' as const : 'blocked' as const;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const appId = Constants.expoConfig?.android?.package;
    if (!projectId || !appId) throw new Error('Push configuration is missing');
    // Android's native token getter emits a token event, even for an unchanged
    // token. Reuse listener-supplied tokens to avoid recursively registering.
    const token = await waitForToken(() => notifications.getExpoPushTokenAsync({ projectId, ...(devicePushToken ? { devicePushToken } : {}) }), signal);
    if (!token || signal.aborted || enabledUser !== userId) return 'off' as const;
    const { data: { session } } = await supabase.auth.getSession();
    if (signal.aborted || enabledUser !== userId || session?.user.id !== userId) return 'off' as const;
    if (!saved) {
      saved = { id: Crypto.randomUUID(), secret: Crypto.getRandomBytes(32).reduce((text, byte) => text + byte.toString(16).padStart(2, '0'), '') };
    }
    // Persist before the request: even a timed-out response may have saved remotely.
    saved.owner = userId;
    await SecureStore.setItemAsync(KEY, JSON.stringify(saved));
    await savePushDevice(saved.id, saved.secret, token.data, appId);
    if (signal.aborted || enabledUser !== userId) { await revoke(); return 'off' as const; }
    return 'registered' as const;
  });
}
