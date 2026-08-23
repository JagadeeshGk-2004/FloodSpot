import math
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from routes.reports import get_flood_reports
from services.weather_service import WeatherService

router = APIRouter(prefix="/api/routes", tags=["Safe Navigation Routing"])

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points in kilometers.
    """
    R = 6371.0  # Radius of the Earth in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class RoutePoint(BaseModel):
    lat: float = Field(..., example=13.0827, description="Latitude")
    lon: float = Field(..., example=80.2707, description="Longitude")
    name: Optional[str] = Field(None, example="Current Location")

class RouteCheckRequest(BaseModel):
    origin: RoutePoint
    destination: RoutePoint
    waypoints: Optional[List[RoutePoint]] = Field(default=[], description="Optional intermediate route waypoints")
    max_hazard_distance_km: Optional[float] = Field(default=0.8, description="Risk proximity radius threshold in km")

@router.post("/safe-check", summary="Evaluate safe navigation points against flood reports and weather hazards")
async def check_route_safety(request: RouteCheckRequest) -> Dict[str, Any]:
    """
    Evaluates whether origin, destination, or waypoints intersect high-risk flood report zones
    or areas of heavy precipitation (>15 mm/h). Returns flagged high-risk waypoints.
    """
    try:
        # Combine all route inspection points (origin, waypoints, destination)
        all_points: List[RoutePoint] = [request.origin] + (request.waypoints or []) + [request.destination]

        # Fetch active flood reports
        reports = await get_flood_reports()
        
        # Check current weather at midpoint or origin
        mid_lat = (request.origin.lat + request.destination.lat) / 2.0
        mid_lon = (request.origin.lon + request.destination.lon) / 2.0
        weather_info = await WeatherService.get_current_weather(mid_lat, mid_lon)

        rain_mm_h = weather_info.get("rain_mm_h", 0.0)
        is_heavy_rain = rain_mm_h > 15.0

        flagged_hazards: List[Dict[str, Any]] = []
        highest_severity_val = 0

        severity_weights = {
            "low": 20,
            "medium": 50,
            "high": 80,
            "critical": 100
        }

        # Check proximity of each route point to known flood reports
        for idx, point in enumerate(all_points):
            p_label = f"Waypoint #{idx}" if idx > 0 and idx < len(all_points) - 1 else ("Origin" if idx == 0 else "Destination")
            if point.name:
                p_label = f"{p_label} ({point.name})"

            for rep in reports:
                rep_lat = rep.get("latitude")
                rep_lon = rep.get("longitude")
                if rep_lat is None or rep_lon is None:
                    continue

                dist_km = haversine_km(point.lat, point.lon, rep_lat, rep_lon)
                threshold = request.max_hazard_distance_km or 0.8

                if dist_km <= threshold:
                    sev = (rep.get("severity") or "medium").lower()
                    sev_score = severity_weights.get(sev, 50)
                    if sev_score > highest_severity_val:
                        highest_severity_val = sev_score

                    flagged_hazards.append({
                        "point_label": p_label,
                        "point_coords": {"lat": point.lat, "lon": point.lon},
                        "hazard_location": rep.get("location_name", "Reported Hazard Zone"),
                        "hazard_severity": sev,
                        "water_depth": rep.get("water_depth", "Unknown"),
                        "distance_km": round(dist_km, 3),
                        "description": rep.get("description", ""),
                        "verified": rep.get("verified", False),
                        "recommendation": f"Avoid {rep.get('location_name')}. Seek alternate elevated path."
                    })

        # Calculate overall risk score (0 - 100)
        base_risk = highest_severity_val
        if is_heavy_rain:
            base_risk = min(100, base_risk + 25)

        is_safe = (base_risk < 50) and (len(flagged_hazards) == 0)

        recommendations = []
        if not is_safe:
            recommendations.append("High risk detected along selected route.")
            if flagged_hazards:
                recommendations.append(f"{len(flagged_hazards)} flood report hotspot(s) detected near navigation path.")
            if is_heavy_rain:
                recommendations.append(f"Heavy rainfall alert active ({rain_mm_h} mm/h). Reduced visibility and water accumulation likely.")
        else:
            recommendations.append("Route is clear of major active flood reports and extreme weather risks.")

        return {
            "is_route_safe": is_safe,
            "overall_risk_score": base_risk,
            "origin": {"lat": request.origin.lat, "lon": request.origin.lon, "name": request.origin.name},
            "destination": {"lat": request.destination.lat, "lon": request.destination.lon, "name": request.destination.name},
            "rainfall_status": {
                "rain_mm_h": rain_mm_h,
                "is_heavy_rain": is_heavy_rain,
                "condition": weather_info.get("condition", "Clear")
            },
            "flagged_waypoints": flagged_hazards,
            "recommendations": recommendations
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to process safe route check: {str(err)}")
