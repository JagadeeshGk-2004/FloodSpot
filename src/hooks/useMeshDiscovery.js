import { useState, useEffect } from 'react';

/**
 * useMeshDiscovery — BLE scan with simulation fallback for P2P survivor detection.
 */
export function useMeshDiscovery() {
  const [nearbySurvivors, setNearbySurvivors] = useState(0);

  useEffect(() => {
    let scanInterval;

    const startMeshDiscovery = async () => {
      // 1. Attempt genuine BLE scan if supported (Experimental Web Bluetooth Scanning)
      if (navigator.bluetooth && navigator.bluetooth.requestLEScan) {
        try {
          await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true });
          navigator.bluetooth.addEventListener('advertisementreceived', () => {
            setNearbySurvivors(prev => Math.min(prev + 1, 5));
          });
          return; // If real hardware works, skip simulation
        } catch {
          console.log('[Mesh] Hardware BLE scan unavailable, falling back to simulation.');
        }
      }

      // 2. Fallback: Simulated Radar for environments without Web BLE Support
      scanInterval = setInterval(() => {
        const mockFound = Math.floor(Math.random() * 4);
        setNearbySurvivors(mockFound);
      }, 8000);
    };

    startMeshDiscovery();

    return () => {
      if (scanInterval) clearInterval(scanInterval);
    };
  }, []);

  return { nearbySurvivors };
}
