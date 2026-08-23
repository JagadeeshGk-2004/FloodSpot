import logging
import httpx
from typing import Dict, Any, List, Optional
from config import settings

logger = logging.getLogger("floodspot.weather")

class WeatherService:
    """
    Service to fetch real-time rainfall rate (mm/h), weather conditions,
    and active storm alerts from OpenWeatherMap API with realistic fallbacks.
    """

    @staticmethod
    async def get_current_weather(lat: float, lon: float) -> Dict[str, Any]:
        api_key = settings.OPENWEATHER_API_KEY
        
        if not api_key or api_key == "your_openweather_api_key":
            logger.info("OpenWeather API Key missing or default. Returning synthetic real-time weather metrics.")
            return WeatherService._generate_mock_weather(lat, lon)

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    return WeatherService._format_openweather_response(data, lat, lon)
                else:
                    logger.warning(f"OpenWeather API returned status code {response.status_code}. Using fallback.")
                    return WeatherService._generate_mock_weather(lat, lon)
        except Exception as err:
            logger.error(f"Error requesting OpenWeather API: {err}. Using fallback mock dataset.")
            return WeatherService._generate_mock_weather(lat, lon)

    @staticmethod
    def _format_openweather_response(data: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
        rain_info = data.get("rain", {})
        rain_1h = rain_info.get("1h", 0.0)
        rain_3h = rain_info.get("3h", 0.0)
        
        # Calculate mm/h estimate
        rain_rate_mm_h = rain_1h if rain_1h > 0 else (rain_3h / 3.0 if rain_3h > 0 else 0.0)

        weather_list = data.get("weather", [{}])
        main_cond = weather_list[0].get("main", "Clear") if weather_list else "Clear"
        desc_cond = weather_list[0].get("description", "clear sky") if weather_list else "clear sky"

        main_data = data.get("main", {})
        temp = main_data.get("temp", 28.0)
        humidity = main_data.get("humidity", 75)
        pressure = main_data.get("pressure", 1012)
        wind_speed = data.get("wind", {}).get("speed", 3.5)

        # Generate alert status if heavy rainfall detected
        alerts: List[Dict[str, Any]] = []
        if rain_rate_mm_h > 15.0 or "thunderstorm" in desc_cond.lower() or "extreme" in desc_cond.lower():
            alerts.append({
                "id": "alert-owm-01",
                "event": "Heavy Rainfall & Flood Flash Warning",
                "severity": "Severe" if rain_rate_mm_h > 30 else "Moderate",
                "description": f"Heavy localized precipitation detected ({rain_rate_mm_h:.1f} mm/h). Risk of urban waterlogging.",
                "area": data.get("name", "Target Location")
            })

        return {
            "location": {
                "name": data.get("name", "Unknown Area"),
                "latitude": lat,
                "longitude": lon
            },
            "condition": main_cond,
            "description": desc_cond.capitalize(),
            "temperature_celsius": temp,
            "humidity_percent": humidity,
            "pressure_hpa": pressure,
            "wind_speed_m_s": wind_speed,
            "rain_mm_h": round(rain_rate_mm_h, 2),
            "is_raining": rain_rate_mm_h > 0.5 or "rain" in desc_cond.lower(),
            "active_alerts": alerts,
            "source": "OpenWeatherMap API"
        }

    @staticmethod
    def _generate_mock_weather(lat: float, lon: float) -> Dict[str, Any]:
        """
        Provides realistic mock weather tailored for coastal & flood-monitored urban zones (e.g. Chennai).
        """
        # Deterministic simulation based on coordinate seed
        lat_int = int(abs(lat * 100))
        lon_int = int(abs(lon * 100))
        seed = (lat_int + lon_int) % 10

        if seed in [0, 1, 2]:
            rain_rate = 24.5
            condition = "Rain"
            description = "Heavy monsoon downpour"
            alerts = [
                {
                    "id": "alert-sim-1",
                    "event": "Red Warning: High Intensity Rainfall",
                    "severity": "Critical",
                    "description": "Continuous heavy rainfall (24.5 mm/h). High probability of road inundation.",
                    "area": f"Zone ({lat:.2f}, {lon:.2f})"
                }
            ]
        elif seed in [3, 4, 5]:
            rain_rate = 8.2
            condition = "Rain"
            description = "Moderate rain showers"
            alerts = [
                {
                    "id": "alert-sim-2",
                    "event": "Yellow Warning: Moderate Rain",
                    "severity": "Moderate",
                    "description": "Steady rain (8.2 mm/h). Drive with caution around low-lying areas.",
                    "area": f"Zone ({lat:.2f}, {lon:.2f})"
                }
            ]
        else:
            rain_rate = 0.0
            condition = "Clouds"
            description = "Overcast sky"
            alerts = []

        return {
            "location": {
                "name": f"Monitored Spot ({lat:.4f}, {lon:.4f})",
                "latitude": lat,
                "longitude": lon
            },
            "condition": condition,
            "description": description,
            "temperature_celsius": 27.5,
            "humidity_percent": 88,
            "pressure_hpa": 1008,
            "wind_speed_m_s": 5.4,
            "rain_mm_h": rain_rate,
            "is_raining": rain_rate > 0.0,
            "active_alerts": alerts,
            "source": "FloodSpot Synthetic Weather Engine (Fallback)"
        }
