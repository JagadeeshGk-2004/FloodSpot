/**
 * FloodSpot Weather Engine
 * -------------------------------------------------------------
 * Fetches real-time weather & precipitation data from OpenWeatherMap API,
 * determines Smart Seasonal Modes (Active Flood Mode vs. Preparedness Mode),
 * multi-tier rainfall alert classifications, and caches data to LocalStorage for offline resilience.
 */

const OPENWEATHER_API_KEY = import.meta.env?.VITE_OPENWEATHER_API_KEY || 'demo_key';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export const WEATHER_STORAGE_KEY = 'floodspot_weather_cache';
export const DEFAULT_CHENNAI_COORDS = { lat: 13.0827, lng: 80.2707 };

/**
 * Reads cached weather data from LocalStorage
 * @returns {Object|null}
 */
export function getCachedWeather() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[WeatherEngine] Error reading weather cache:', err);
    return null;
  }
}

/**
 * Persists weather data to LocalStorage
 * @param {Object} weatherObj 
 */
export function cacheWeather(weatherObj) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = {
      ...weatherObj,
      cached_at: Date.now()
    };
    localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('[WeatherEngine] Error caching weather:', err);
  }
}

/**
 * Evaluates rain rate tier based on mm/h
 * @param {number} rain1h 
 * @returns {'none' | 'light' | 'moderate' | 'severe'}
 */
export function getRainRateTier(rain1h) {
  if (!rain1h || rain1h < 0.5) return 'none';
  if (rain1h <= 2.5) return 'light';
  if (rain1h <= 7.5) return 'moderate';
  return 'severe';
}

/**
 * Formats OpenWeather API response into normalized FloodSpot weather schema
 * @param {Object} rawData 
 * @returns {Object}
 */
export function normalizeWeatherData(rawData) {
  const rain1h = rawData.rain?.['1h'] || rawData.rain?.['3h'] || 0;
  const weatherId = rawData.weather?.[0]?.id || 800;
  const condition = rawData.weather?.[0]?.main || 'Clear';
  const description = rawData.weather?.[0]?.description || 'clear sky';
  const temp = Math.round(rawData.main?.temp ?? 30);
  const humidity = rawData.main?.humidity ?? 70;
  const windSpeed = rawData.wind?.speed ?? 0;
  const cityName = rawData.name || 'Chennai';

  const rainTier = getRainRateTier(rain1h);
  const isFloodMode = rain1h > 0 || (weatherId >= 200 && weatherId < 600);
  const isSevereAlert = rainTier === 'severe' || (weatherId >= 200 && weatherId <= 232) || (weatherId >= 502 && weatherId <= 531);
  const mode = isFloodMode ? 'ACTIVE_FLOOD' : 'PREPAREDNESS_DRY';

  return {
    cityName,
    temp,
    humidity,
    rain1h,
    rainTier,
    windSpeed,
    condition,
    description,
    weatherId,
    mode,
    isFloodMode,
    isSevereAlert,
    timestamp: Date.now()
  };
}

/**
 * Fetches live weather data from OpenWeatherMap API with offline LocalStorage fallback.
 * 
 * @param {number} [lat=13.0827] 
 * @param {number} [lng=80.2707] 
 * @returns {Promise<Object>} Normalized weather data object
 */
export async function fetchLiveWeather(lat = DEFAULT_CHENNAI_COORDS.lat, lng = DEFAULT_CHENNAI_COORDS.lng) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = getCachedWeather();
    if (cached) {
      return { ...cached, isOfflineFallback: true };
    }
  }

  try {
    const url = `${OPENWEATHER_BASE_URL}?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OpenWeather API returned status: ${response.status}`);
    }

    const rawData = await response.json();
    const normalized = normalizeWeatherData(rawData);

    cacheWeather(normalized);

    return normalized;
  } catch (err) {
    console.warn('[WeatherEngine] Live fetch failed, using fallback cache:', err.message);
    const cached = getCachedWeather();
    if (cached) {
      return { ...cached, isOfflineFallback: true };
    }

    return {
      cityName: 'Chennai',
      temp: 31,
      humidity: 78,
      rain1h: 0,
      rainTier: 'none',
      windSpeed: 3.5,
      condition: 'Clear',
      description: 'clear sky',
      weatherId: 800,
      mode: 'PREPAREDNESS_DRY',
      isFloodMode: false,
      isSevereAlert: false,
      timestamp: Date.now(),
      isDefaultFallback: true
    };
  }
}

/**
 * Initializes weather polling at given interval (default: 5 minutes = 300,000 ms)
 * 
 * @param {Function} callback Function invoked on fresh weather data
 * @param {number} [intervalMs=300000] 
 * @param {number} [lat] 
 * @param {number} [lng] 
 * @returns {Function} Unsubscribe stop function
 */
export function startWeatherPolling(callback, intervalMs = 300000, lat, lng) {
  let isStopped = false;

  const executeFetch = async () => {
    if (isStopped) return;
    const data = await fetchLiveWeather(lat, lng);
    if (!isStopped && callback) {
      callback(data);
    }
  };

  executeFetch();

  const timerId = setInterval(executeFetch, intervalMs);

  return () => {
    isStopped = true;
    clearInterval(timerId);
  };
}

export default {
  fetchLiveWeather,
  getCachedWeather,
  cacheWeather,
  normalizeWeatherData,
  getRainRateTier,
  startWeatherPolling,
  WEATHER_STORAGE_KEY,
  DEFAULT_CHENNAI_COORDS
};
