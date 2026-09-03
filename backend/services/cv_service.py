import io
import hashlib
import logging
from typing import Dict, Any
from PIL import Image, ImageStat

logger = logging.getLogger("floodspot.cv_service")

from services.hydro_vision_pipeline import execute_hydro_vision_analysis

def verify_flood_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Analyzes uploaded image via Hydro Depth Engine vision pipeline.
    """
    result = execute_hydro_vision_analysis(image_bytes, mime_type)
    
    is_v = bool(result.get("verified", False))
    conf = float(result.get("confidence", 0.10))

    if is_v:
        return {
            "verified": True,
            "confidence": conf,
            "detected_features": result.get("detected_features", ["Submerged asphalt contours", "Standing water surface"]),
            "severity": result.get("severity", "Medium (Ankle Deep)"),
            "depth_est": result.get("depth_est", "1.5 ft")
        }
    else:
        return {
            "verified": False,
            "confidence": conf if conf < 0.60 else 0.12,
            "detected_features": [],
            "error": result.get("error") or "Verification Failed: No floodwater, road inundation, or storm hazard detected in this image."
        }

