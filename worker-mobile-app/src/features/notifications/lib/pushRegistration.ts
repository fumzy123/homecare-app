import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/shared/lib/api-client';
import { revokePushDevice, savePushDevice } from '../api';

const KEY = 'push-installation-v1';
type Installation = { id: string; secret: string; owner?: string };
let queue: Promise<unknown> = Promise.resolve();
let enabledUser: string | null = null;

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

export function setPushUser(userId: string | null) { enabledUser = userId; }

export function unregisterPush() {
  enabledUser = null;
  if (!supportsPush()) return Promise.resolve();
  return serial(revoke);
}

export function registerPush(userId: string, requestPermission = false) {
  return serial(async () => {
    const notifications = await nativeNotifications();
    if (!notifications) return 'unsupported' as const;
    let saved = await readInstallation();
    if (saved?.owner && saved.owner !== userId) await revoke();
    if (enabledUser !== userId) return 'off' as const;
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
    const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
    const { data: { session } } = await supabase.auth.getSession();
    if (enabledUser !== userId || session?.user.id !== userId) return 'off' as const;
    if (!saved) {
      saved = { id: Crypto.randomUUID(), secret: Crypto.getRandomBytes(32).reduce((text, byte) => text + byte.toString(16).padStart(2, '0'), '') };
    }
    // Persist before the request: even a timed-out response may have saved remotely.
    saved.owner = userId;
    await SecureStore.setItemAsync(KEY, JSON.stringify(saved));
    await savePushDevice(saved.id, saved.secret, token, appId);
    if (enabledUser !== userId) { await revoke(); return 'off' as const; }
    return 'registered' as const;
  });
}
