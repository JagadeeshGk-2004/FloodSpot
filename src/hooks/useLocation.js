import { useState, useCallback, useRef } from 'react';

/**
 * useLocation — Manages GPS position acquisition and reverse geocoding.
 */
export function useLocation() {
  const [coords, setCoords] = useState(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [address, setAddress] = useState('Acquiring Signal...');
  const [locationLoading, setLocationLoading] = useState(false);
  const lastFetchTime = useRef(0);

  const requestLocation = useCallback(() => {
    if (locationLoading) return;
    if (!('geolocation' in navigator)) {
      return { error: 'GPS not available on this device.' };
    }

    // Throttle: don't re-request within 3 seconds
    const now = Date.now();
    if (now - lastFetchTime.current < 3000 && coords) return;
    lastFetchTime.current = now;

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude } = p.coords;
        setCoords({ latitude, longitude });
        setIsLocationActive(true);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(res => res.json())
          .then(data => {
            if (data?.display_name) {
              const parts = data.display_name.split(',');
              setAddress(`${parts[0]}${parts[1] ? ', ' + parts[1] : ''}`);
            }
          })
          .catch(() => {
            setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          })
          .finally(() => setLocationLoading(false));
      },
      () => {
        setIsLocationActive(false);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, [locationLoading, coords]);

  return {
    coords,
    isLocationActive,
    address,
    locationLoading,
    requestLocation,
  };
}
