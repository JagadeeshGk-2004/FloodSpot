import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../theme/colors';
import { CloudRain, CloudLightning, Sun } from 'lucide-react-native';

export function WeatherPill({ weather, onPress }) {
  if (!weather) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.pillContainer}>
        <CloudRain size={14} color={COLORS.skyBlue} />
        <Text style={styles.pillText}>28°C • Chennai</Text>
      </TouchableOpacity>
    );
  }

  const rain1h = typeof weather.rain1h === 'number' ? weather.rain1h : (typeof weather.rainfall_rate_mm_h === 'number' ? weather.rainfall_rate_mm_h : 0);
  const temp = Math.round(
    typeof weather.temp === 'number'
      ? weather.temp
      : (typeof weather.temperature_celsius === 'number' ? weather.temperature_celsius : 28)
  );

  let city = 'Chennai';
  if (typeof weather.cityName === 'string' && weather.cityName) {
    city = weather.cityName;
  } else if (typeof weather.location_monitored === 'string' && weather.location_monitored) {
    city = weather.location_monitored;
  } else if (typeof weather.location === 'string' && weather.location) {
    city = weather.location;
  } else if (typeof weather.location === 'object' && weather.location !== null) {
    city = weather.location.name || weather.location.location_name || (weather.location.latitude && weather.location.longitude ? `Zone (${weather.location.latitude.toFixed(2)}, ${weather.location.longitude.toFixed(2)})` : 'Chennai');
  }

  return (
    <TouchableOpacity onPress={onPress} style={styles.pillContainer}>
      {rain1h > 7.5 ? (
        <CloudLightning size={14} color={COLORS.danger} />
      ) : rain1h >= 1.0 ? (
        <CloudRain size={14} color={COLORS.skyBlue} />
      ) : (
        <Sun size={14} color={COLORS.mediumYellow} />
      )}
      <Text style={styles.pillText}>
        {temp}°C • {String(city)}
        {rain1h > 0 ? ` (${rain1h} mm/h)` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  pillText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
