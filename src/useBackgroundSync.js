/**
 * useBackgroundSync
 * Listens for the browser's 'online' event and drains the
 * floodspot_outbox queue to Supabase the moment connectivity returns.
 * Safe to call multiple times – the event listener is deduped via cleanup.
 */
import { useEffect, useRef } from 'react';
import { supabase } from './db.js';
import { getOutbox, deleteFromOutbox } from './idb.js';

export function useBackgroundSync(onSyncComplete) {
  // Keep onSyncComplete stable so we don't re-register listeners on every render
  const callbackRef = useRef(onSyncComplete);
  useEffect(() => { callbackRef.current = onSyncComplete; }, [onSyncComplete]);

  useEffect(() => {
    const drainOutbox = async () => {
      const outbox = await getOutbox();
      if (outbox.length === 0) return;

      let syncedCount = 0;
      for (const item of outbox) {
        try {
          let publicUrl = null;
          if (item.photo_base64) {
            const res = await fetch(item.photo_base64);
            const blob = await res.blob();
            const fileName = `${Date.now()}-offline.jpg`;
            await supabase.storage.from('flood-pics').upload(fileName, blob);
            publicUrl = supabase.storage.from('flood-pics').getPublicUrl(fileName).data.publicUrl;
          }
          const { error } = await supabase.from('reports').insert([{
            latitude: item.latitude,
            longitude: item.longitude,
            severity: item.severity,
            photo_url: publicUrl,
            place_name: item.place_name,
            user_id: item.user_id,
          }]);
          if (error) throw error;
          
          // Successfully synced, remove from IndexedDB
          await deleteFromOutbox(item.id);
          syncedCount++;
        } catch (err) {
          console.warn('[BackgroundSync] Item failed – will retry:', err.message);
        }
      }

      // Notify App to refresh the live feed if any items were synced
      if (syncedCount > 0 && callbackRef.current) {
        callbackRef.current();
      }
    };

    // Try to sync immediately if already online (e.g. on app launch)
    if (navigator.onLine) drainOutbox();

    const handleOnline = () => drainOutbox();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
}
