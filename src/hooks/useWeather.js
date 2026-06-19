import { useState, useEffect, useRef } from 'react';

/**
 * useWeather — Fetches weather data from Open-Meteo when coords become available.
 * Caches result to avoid refetching on view switches.
 */
export function useWeather(coords, shouldFetch) {
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!shouldFetch || !coords || fetchedRef.current) return;
    fetchedRef.current = true;

    setWeatherLoading(true);
    Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,visibility,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`
      ).then(res => res.json()),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}&current=us_aqi`
      ).then(res => res.json()).catch(() => null),
    ])
      .then(([weather, aqi]) => {
        setWeatherData({ ...weather, aqi });
        setWeatherLoading(false);
      })
      .catch(() => {
        setWeatherLoading(false);
        fetchedRef.current = false; // Allow retry on failure
      });
  }, [shouldFetch, coords]);

  const refreshWeather = () => {
    fetchedRef.current = false;
    setWeatherData(null);
  };

  return { weatherData, weatherLoading, refreshWeather };
}
