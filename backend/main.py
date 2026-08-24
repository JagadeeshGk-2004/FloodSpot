import logging
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional

import sys
from pathlib import Path

# Register root and backend directory in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import settings
from routes import alerts, reports, routes, auth
from services.weather_service import WeatherService

from services.local_db import init_local_db

# Initialize Local SQLite persistent database
try:
    init_local_db()
except Exception as db_err:
    logging.warning(f"Could not initialize local SQLite database: {db_err}")

# Load dummy CNN Flood Classification model weights on startup
try:
    from models.model_loader import FloodModelInference
    model_inference = FloodModelInference()
except Exception as err:
    logging.warning(f"Could not initialize FloodModelInference: {err}")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("floodspot.main")

# Initialize FastAPI App
app = FastAPI(
    title="FloodSpot API Backend",
    description="Clean, robust, and asynchronous backend server for FloodSpot community flood monitoring and safe navigation.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware for local React frontend (http://localhost:5173)
origins = settings.cors_origins_list
logger.info(f"Enabling CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Ensure static uploads directory exists for persistent asset storage
STATIC_DIR = BACKEND_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Register Sub-routers
app.include_router(alerts.router)
app.include_router(reports.router)
app.include_router(reports.router, prefix="/api/incidents", tags=["Incidents Alias"])
app.include_router(routes.router)
app.include_router(auth.router)

import base64
from pydantic import BaseModel, Field
from services.cv_service import verify_flood_image

class ImagePayload(BaseModel):
    image_base64: str = Field(..., description="Base64 image data string")

@app.post("/api/verify-image", tags=["Hydro Depth Engine"], summary="Analyze image with Hydro Depth Engine")
async def verify_image_endpoint(payload: ImagePayload) -> Dict[str, Any]:
    """
    Direct FloodNet-CV Hydro-Depth Engine verification endpoint.
    Examines uploaded image and returns { "is_flood": bool, "confidence": float, "detected_elements": str, "reason": str }.
    """
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(raw_b64)
        result = verify_flood_image(image_bytes)
        return result
    except Exception as err:
        logger.error(f"Error in /api/verify-image: {err}")
        raise HTTPException(status_code=400, detail=f"Image verification error: {str(err)}")

# Core & Weather Endpoints
@app.get("/api/health", tags=["Health"], summary="Health check endpoint")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint returning application status, service name, and version.
    """
    return {
        "status": "healthy",
        "service": "FloodSpot FastAPI Backend",
        "version": "1.0.0",
        "supabase_configured": bool(settings.SUPABASE_URL and settings.SUPABASE_KEY and "your-supabase" not in settings.SUPABASE_URL),
        "openweather_configured": bool(settings.OPENWEATHER_API_KEY and settings.OPENWEATHER_API_KEY != "your_openweather_api_key")
    }

@app.get("/api/weather/current", tags=["Weather"], summary="Fetch real-time weather and rainfall rate")
async def get_current_weather(
    lat: float = Query(default=13.0827, description="Latitude coordinate"),
    lon: float = Query(default=80.2707, description="Longitude coordinate")
) -> Dict[str, Any]:
    """
    Fetch current weather condition, rainfall rate (mm/h), and active severe weather alerts
    for specified GPS coordinates.
    """
    try:
        weather_data = await WeatherService.get_current_weather(lat, lon)
        return weather_data
    except Exception as err:
        logger.error(f"Error fetching current weather: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather data: {str(err)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
