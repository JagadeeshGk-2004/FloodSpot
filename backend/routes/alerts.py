from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from services.weather_service import WeatherService

router = APIRouter(prefix="/api/alerts", tags=["Emergency Alerts"])

@router.get("/live", summary="Fetch live emergency flood alerts and weather advisories")
async def get_live_alerts(
    lat: Optional[float] = Query(default=13.0827, description="Latitude of target area"),
    lon: Optional[float] = Query(default=80.2707, description="Longitude of target area")
) -> Dict[str, Any]:
    """
    Returns active flood warnings, regional emergency alerts, and helpline contacts.
    """
    try:
        weather = await WeatherService.get_current_weather(lat, lon)
        weather_alerts = weather.get("active_alerts", [])

        # Standard emergency response helplines & default critical advisories
        system_advisories = [
            {
                "id": "sys-adv-101",
                "title": "Chennai Corporation Emergency Control Room",
                "helpline": "1913",
                "category": "Helpline",
                "description": "24/7 Toll-Free helpline for waterlogging drainage, tree falls, and boat rescue requests."
            },
            {
                "id": "sys-adv-102",
                "title": "NDRF Disaster Relief Response Force",
                "helpline": "1070 / 1077",
                "category": "State Control Room",
                "description": "State & District Disaster Management Center for evacuation assistance."
            }
        ]

        if weather.get("rain_mm_h", 0) > 15.0:
            system_advisories.append({
                "id": "sys-adv-103",
                "title": "Heavy Precipitation Traffic Advisory",
                "helpline": "103 (Traffic)",
                "category": "Traffic Warning",
                "description": "Avoid underpasses at Velachery, Subways in T. Nagar and Vyasarpadi due to water accumulation."
            })

        return {
            "status": "success",
            "location_monitored": weather.get("location"),
            "rainfall_rate_mm_h": weather.get("rain_mm_h"),
            "weather_alerts": weather_alerts,
            "emergency_helplines": system_advisories
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to fetch live alerts: {str(err)}")
