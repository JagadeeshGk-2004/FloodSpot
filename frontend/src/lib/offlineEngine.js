import { supabase } from './supabase';

/**
 * FloodSpot Offline & Geolocation Engine
 * -------------------------------------------------------------
 * Provides high-accuracy geolocation with LocalStorage caching,
 * accuracy filtering to force hardware GPS over low-precision IP estimates,
 * resilient offline queuing for flood reports and SOS alerts,
 * and automatic synchronization with Supabase when online.
 */

// LocalStorage Keys
export const STORAGE_KEYS = {
  LAST_LOCATION: 'floodspot_last_location',
  OFFLINE_QUEUE: 'floodspot_offline_queue'
};

// Item Types supported by the Queue & Sync engine
export const QUEUE_ITEM_TYPES = {
  FLOOD_REPORT: 'flood_reports',
  SOS_ALERT: 'sos_alerts'
};

// Default high-accuracy hardware GPS geolocation configuration
export const DEFAULT_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0
};

// Maximum allowed accuracy threshold (in meters) before fallback checking occurs
export const ACCURACY_THRESHOLD_METERS = 1000;

// ============================================================================
// 1. HIGH-ACCURACY GEOLOCATION & CACHING SYSTEM (Poonamallee Hardware Fix)
// ============================================================================

/**
 * Reads the cached user coordinates from LocalStorage.
 * Useful for zero-delay UI startup while waiting for a fresh GPS lock.
 * 
 * @returns {Object|null} Cached position object { latitude, longitude, accuracy, timestamp } or null
 */
export function getCachedLocation() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('[OfflineEngine] Error reading cached location:', err);
    return null;
  }
}

/**
 * Persists high-accuracy coordinates to LocalStorage.
 * 
 * @param {Object} locationObj - Location properties to cache
 * @returns {Object} Cached location object
 */
export function cacheLocation(locationObj) {
  if (typeof window === 'undefined' || !window.localStorage) return locationObj;
  try {
    const payload = {
      latitude: locationObj.latitude,
      longitude: locationObj.longitude,
      accuracy: locationObj.accuracy || null,
      heading: locationObj.heading || null,
      speed: locationObj.speed || null,
      timestamp: locationObj.timestamp || Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify(payload));
    return payload;
  } catch (err) {
    console.error('[OfflineEngine] Error caching location:', err);
    return locationObj;
  }
}

/**
 * Evaluates whether a location fix should be accepted or rejected based on accuracy.
 * Discards low-precision IP location estimates (>1000m) if a accurate cached GPS coordinate exists.
 * 
 * @param {number} accuracy - Accuracy in meters
 * @returns {{ accept: boolean, fallback: Object|null }}
 */
export function validateLocationAccuracy(accuracy) {
  const cached = getCachedLocation();
  if (accuracy > ACCURACY_THRESHOLD_METERS && cached && cached.accuracy && cached.accuracy <= ACCURACY_THRESHOLD_METERS) {
    console.warn(
      `[OfflineEngine] Discarded low-precision IP location fix (${Math.round(accuracy)}m) in favor of precise cached GPS fix (${Math.round(cached.accuracy)}m).`
    );
    return { accept: false, fallback: cached };
  }
  return { accept: true, fallback: null };
}

/**
 * Starts continuous position tracking using strict high-accuracy geolocation settings.
 * Filters low-precision IP estimates and caches accurate coordinates to LocalStorage.
 * 
 * @param {Function} onSuccess - Callback invoked on position update (receives normalized position object)
 * @param {Function} [onError] - Callback invoked on geolocation error
 * @param {PositionOptions} [customOptions] - Override geolocation options
 * @returns {Function} Stop watch function () => void
 */
export function watchUserPosition(onSuccess, onError, customOptions = {}) {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    const err = new Error('Geolocation is not supported by this browser/environment.');
    if (onError) onError(err);
    return () => {};
  }

  const options = {
    ...DEFAULT_GEOLOCATION_OPTIONS,
    ...customOptions
  };

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const rawAccuracy = position.coords.accuracy;
      const accuracyCheck = validateLocationAccuracy(rawAccuracy);

      if (!accuracyCheck.accept && accuracyCheck.fallback) {
        if (onSuccess) {
          onSuccess({
            ...accuracyCheck.fallback,
            isCached: true,
            discardedLowPrecisionAccuracy: rawAccuracy
          });
        }
        return;
      }

      const normalizedLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: rawAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        altitude: position.coords.altitude,
        timestamp: position.timestamp || Date.now(),
        isCached: false
      };

      // Cache accurate location for zero-delay UI access
      cacheLocation(normalizedLocation);

      if (onSuccess) {
        onSuccess(normalizedLocation);
      }
    },
    (err) => {
      console.warn('[OfflineEngine] Geolocation watch error:', err.message || err);
      const cached = getCachedLocation();
      if (onError) {
        onError({ error: err, cachedFallback: cached });
      }
    },
    options
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

/**
 * Request a single high-accuracy location update, falling back to cached coordinates if necessary.
 * 
 * @param {PositionOptions} [customOptions]
 * @returns {Promise<Object>} Position object { latitude, longitude, accuracy, timestamp, isCached }
 */
export function getCurrentLocation(customOptions = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      const cached = getCachedLocation();
      if (cached) return resolve({ ...cached, isCached: true });
      return reject(new Error('Geolocation unavailable and no cached location found.'));
    }

    const options = {
      ...DEFAULT_GEOLOCATION_OPTIONS,
      ...customOptions
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawAccuracy = position.coords.accuracy;
        const accuracyCheck = validateLocationAccuracy(rawAccuracy);

        if (!accuracyCheck.accept && accuracyCheck.fallback) {
          return resolve({
            ...accuracyCheck.fallback,
            isCached: true,
            discardedLowPrecisionAccuracy: rawAccuracy
          });
        }

        const normalizedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: rawAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          altitude: position.coords.altitude,
          timestamp: position.timestamp || Date.now(),
          isCached: false
        };

        cacheLocation(normalizedLocation);
        resolve(normalizedLocation);
      },
      (err) => {
        console.warn('[OfflineEngine] getCurrentPosition failed, attempting cache fallback:', err.message);
        const cached = getCachedLocation();
        if (cached) {
          resolve({ ...cached, isCached: true, positionError: err.message });
        } else {
          reject(err);
        }
      },
      options
    );
  });
}

// ============================================================================
// 2. OFFLINE STORAGE QUEUE SYSTEM
// ============================================================================

/**
 * Fetches all pending offline queued items from LocalStorage (`floodspot_offline_queue`).
 * 
 * @returns {Array<Object>} List of queued items
 */
export function getOfflineQueue() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[OfflineEngine] Error reading offline queue:', err);
    return [];
  }
}

/**
 * Saves a list of items to the LocalStorage offline queue.
 * 
 * @param {Array<Object>} queue - Full queue array
 */
function setOfflineQueue(queue) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  } catch (err) {
    console.error('[OfflineEngine] Error setting offline queue:', err);
  }
}

/**
 * Adds an item (Flood Report or SOS Signal) to the offline queue.
 * 
 * @param {string} type - 'flood_reports' or 'sos_alerts'
 * @param {Object} payload - Data payload to insert into Supabase
 * @returns {Object} The created queue item
 */
export function saveToOfflineQueue(type, payload) {
  const queue = getOfflineQueue();
  const queueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: type, // 'flood_reports' or 'sos_alerts'
    payload: {
      ...payload,
      created_at: payload.created_at || new Date().toISOString()
    },
    queued_at: new Date().toISOString(),
    attempts: 0
  };

  queue.push(queueItem);
  setOfflineQueue(queue);
  console.log(`[OfflineEngine] Queued offline item (${type}):`, queueItem.id);
  return queueItem;
}

/**
 * Convenience method to queue a flood report.
 * 
 * @param {Object} reportData 
 * @returns {Object} Queue item
 */
export function queueFloodReport(reportData) {
  return saveToOfflineQueue(QUEUE_ITEM_TYPES.FLOOD_REPORT, reportData);
}

/**
 * Convenience method to queue an SOS alert.
 * 
 * @param {Object} sosData 
 * @returns {Object} Queue item
 */
export function queueSosAlert(sosData) {
  return saveToOfflineQueue(QUEUE_ITEM_TYPES.SOS_ALERT, sosData);
}

/**
 * Removes an item from the offline queue by item ID.
 * 
 * @param {string} itemId - ID of the item to remove
 * @returns {boolean} True if item was removed
 */
export function removeFromOfflineQueue(itemId) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  if (filtered.length !== queue.length) {
    setOfflineQueue(filtered);
    return true;
  }
  return false;
}

/**
 * Clears all queued offline items.
 */
export function clearOfflineQueue() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
}

// ============================================================================
// 3. AUTO-SYNC ENGINE
// ============================================================================

/**
 * Flushes queued offline items to Supabase tables (`flood_reports` and `sos_alerts`).
 * Checks browser online status and validates connectivity.
 * 
 * @returns {Promise<{ synced: number, failed: number, total: number }>}
 */
export async function syncOfflineQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[OfflineEngine] Device is offline. Auto-sync deferred.');
    return { synced: 0, failed: 0, total: getOfflineQueue().length, offline: true };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, total: 0 };
  }

  console.log(`[OfflineEngine] Starting auto-sync for ${queue.length} item(s)...`);

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (supabase) {
        const targetTable = item.type === QUEUE_ITEM_TYPES.SOS_ALERT ? 'sos_alerts' : 'flood_reports';
        
        const cleanPayload = { ...item.payload };
        delete cleanPayload._offlineId;

        const { error } = await supabase
          .from(targetTable)
          .insert([cleanPayload]);

        if (error) {
          console.error(`[OfflineEngine] Supabase insert error for item ${item.id}:`, error.message);
          failed++;
          continue;
        }

        console.log(`[OfflineEngine] Successfully synced item ${item.id} to table '${targetTable}'`);
        removeFromOfflineQueue(item.id);
        synced++;
      } else {
        console.warn('[OfflineEngine] Supabase client unavailable. Retaining item in offline queue.');
        failed++;
      }
    } catch (err) {
      console.error(`[OfflineEngine] Exception syncing item ${item.id}:`, err);
      failed++;
    }
  }

  console.log(`[OfflineEngine] Sync finished. Synced: ${synced}, Failed: ${failed}`);
  return { synced, failed, total: queue.length };
}

/**
 * Initializes auto-sync listener that listens to the browser `online` event.
 * Automatically triggers syncOfflineQueue() when connection is restored.
 * 
 * @param {Function} [onSyncComplete] Optional callback invoked after auto-sync attempts
 * @returns {Function} Unsubscribe function to remove event listeners
 */
export function initAutoSync(onSyncComplete) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    console.log('[OfflineEngine] Browser came ONLINE. Triggering automatic sync...');
    const result = await syncOfflineQueue();
    if (onSyncComplete) onSyncComplete(result);
  };

  window.addEventListener('online', handleOnline);

  if (navigator.onLine && getOfflineQueue().length > 0) {
    syncOfflineQueue().then((res) => {
      if (onSyncComplete) onSyncComplete(res);
    });
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

// Default export object containing all offline engine utilities
export default {
  STORAGE_KEYS,
  QUEUE_ITEM_TYPES,
  DEFAULT_GEOLOCATION_OPTIONS,
  ACCURACY_THRESHOLD_METERS,
  getCachedLocation,
  cacheLocation,
  validateLocationAccuracy,
  watchUserPosition,
  getCurrentLocation,
  getOfflineQueue,
  saveToOfflineQueue,
  queueFloodReport,
  queueSosAlert,
  removeFromOfflineQueue,
  clearOfflineQueue,
  syncOfflineQueue,
  initAutoSync
};
