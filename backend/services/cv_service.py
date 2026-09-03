import io
import hashlib
import logging
from typing import Dict, Any
from PIL import Image, ImageStat

logger = logging.getLogger("floodspot.cv_service")

from services.hydro_vision_pipeline import execute_hydro_vision_analysis

def verify_flood_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Analyzes uploaded image via Hydro Depth Engine (Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline).
    Wraps execute_hydro_vision_analysis for backwards-compatible response attributes.
    """
    result = execute_hydro_vision_analysis(image_bytes, mime_type)
    
    is_v = bool(result.get("verified", False))
    conf = float(result.get("confidence", 0.10))
    rej = result.get("rejection_reason") or "Hydro Depth Engine: No road submergence, standing water, or flood hazards detected."

    return {
        "success": True,
        "is_flood": is_v,
        "verified": is_v,
        "confidence": conf,
        "status": "VERIFIED_FLOOD" if is_v else "REJECTED_NON_FLOOD",
        "detected_features": result.get("detected_features", []),
        "detected_elements": ", ".join(result.get("detected_features", [])) if is_v else "none",
        "depth_est": result.get("estimated_depth_ft", "1.5 ft" if is_v else "0.0 ft"),
        "estimated_depth_ft": result.get("estimated_depth_ft", "1.5 ft" if is_v else "0.0 ft"),
        "severity": result.get("severity_level", "medium" if is_v else "low"),
        "severity_level": result.get("severity_level", "medium" if is_v else "low"),
        "message": "Verified by Hydro Depth Engine (Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline)." if is_v else rej,
        "reason": "Verified by Hydro Depth Engine (Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline)." if is_v else rej,
        "error": None if is_v else rej
    }

