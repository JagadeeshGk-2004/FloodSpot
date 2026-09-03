import io
import hashlib
import logging
from typing import Dict, Any
from PIL import Image, ImageStat

logger = logging.getLogger("floodspot.cv_service")

from services.hydro_vision_pipeline import execute_hydro_vision_analysis, execute_hydro_vision_analysis_async

async def verify_flood_image_async(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Asynchronous vision evaluation with 3.5s timeout and sub-200ms OpenCV fallback.
    """
    return await execute_hydro_vision_analysis_async(image_bytes, mime_type)

def verify_flood_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Fast sub-200ms synchronous vision pipeline.
    """
    return execute_hydro_vision_analysis(image_bytes, mime_type)

