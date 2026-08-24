import Constants from 'expo-constants';
import axios from 'axios';

// Computer's active LAN IP on your Wi-Fi network
const DEFAULT_LAN_IP = '10.39.130.198';

// Robust Auto-Detection of Host IP for Expo Go across SDK 51-54
const getBackendBaseUrl = () => {
  try {
    const candidates = [
      Constants.expoConfig?.hostUri,
      Constants.linkingUri,
      Constants.experienceUrl,
      Constants.manifest2?.extra?.expoGo?.debuggerHost,
      Constants.manifest?.debuggerHost,
    ];

    for (const item of candidates) {
      if (item && typeof item === 'string') {
        const cleaned = item.replace(/^exp:\/\//, '').replace(/^http:\/\//, '');
        const ip = cleaned.split(':')[0];
        if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && ip !== '::1') {
          console.log('[FloodSpot API] Auto-detected Host IP:', ip);
          return `http://${ip}:8000`;
        }
      }
    }
  } catch (err) {
    console.log('[API Config] Error auto-detecting host IP:', err);
  }

  // Fallback to active local Wi-Fi IP
  return `http://${DEFAULT_LAN_IP}:8000`;
};

export const API_BASE_URL = getBackendBaseUrl();

console.log('[FloodSpot API] Connecting to Backend at:', API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s timeout for image uploads and Computer Vision processing
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Endpoints reference matching FastAPI backend routes
export const ENDPOINTS = {
  HEALTH: '/api/health',
  WEATHER_CURRENT: '/api/weather/current',
  REPORTS: '/api/reports',
  VERIFY_IMAGE: '/api/reports/verify-image',
  DIRECT_VERIFY_IMAGE: '/api/verify-image',
  ALERTS_LIVE: '/api/alerts/live',
  SAFE_ROUTE_CHECK: '/api/routes/safe-check',
  REPORT_VOTE: (id) => `/api/reports/${id}/vote`,
};
