import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, ENDPOINTS } from '../config/api';

const OFFLINE_QUEUE_KEY = '@floodspot_offline_reports_queue';
const CACHE_MAP_KEY = '@floodspot_map_cache';
const SETTINGS_KEY = '@floodspot_user_settings';

export const DEFAULT_MOBILE_SETTINGS = {
  p2pMeshEnabled: true,
  lowPowerMode: false,
  mapStyle: 'dark',
  alertRadiusKm: 5,
  unitSystem: 'metric', // 'metric' | 'imperial'
};

export async function getOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[OfflineStorage] Error reading queue:', err);
    return [];
  }
}

export async function saveToOfflineQueue(reportData) {
  try {
    const current = await getOfflineQueue();
    const newItem = {
      ...reportData,
      id: reportData.id || `offline-${Date.now()}`,
      created_at: new Date().toISOString(),
      is_offline: true,
    };
    const updated = [newItem, ...current];
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (err) {
    console.error('[OfflineStorage] Error saving report:', err);
    return null;
  }
}

export async function syncOfflineQueue() {
  const queue = await getOfflineQueue();
  if (!queue || queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  let syncedCount = 0;
  const remainingQueue = [];

  for (const item of queue) {
    try {
      await apiClient.post(ENDPOINTS.REPORTS, item);
      syncedCount++;
    } catch (err) {
      console.warn('[OfflineStorage] Failed syncing item, keeping in queue:', item.id);
      remainingQueue.push(item);
    }
  }

  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
  return { synced: syncedCount, remaining: remainingQueue.length };
}

export async function clearLocalCache() {
  try {
    await AsyncStorage.removeItem(CACHE_MAP_KEY);
    return true;
  } catch (err) {
    console.error('[OfflineStorage] Error clearing cache:', err);
    return false;
  }
}

export async function getSavedSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_MOBILE_SETTINGS;
    return { ...DEFAULT_MOBILE_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    return DEFAULT_MOBILE_SETTINGS;
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    return false;
  }
}
