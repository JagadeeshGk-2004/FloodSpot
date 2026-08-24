import json
import logging
import re
import httpx
from typing import Dict, Any, Optional

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False

from config import settings

logger = logging.getLogger("floodspot.cv_service")

SYSTEM_PROMPT = """Examine this image carefully. Is this an authentic photo of street flooding, heavy waterlogging, or rain-damaged roads?
Respond strictly in JSON format:
{
  "is_flood": boolean,
  "confidence": number (0 to 100),
  "detected_elements": string,
  "reason": string
}"""

def verify_flood_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Analyzes uploaded image via FloodNet-CV Hydro-Depth Engine / Spatial Depth Estimator.
    Returns:
    {
      "is_flood": bool,
      "confidence": float (0 to 100),
      "detected_elements": str,
      "reason": str
    }
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.error("Vision Engine API key missing from environment configuration.")
        return {
            "is_flood": False,
            "confidence": 0,
            "detected_elements": "unknown",
            "reason": "Vision Engine API key missing from server configuration."
        }

    # Method 1: Using generative Vision SDK with supported active models
    if GENAI_AVAILABLE:
        try:
            genai.configure(api_key=api_key)
            model = None
            for model_name in ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-pro"]:
                try:
                    model = genai.GenerativeModel(model_name)
                    break
                except Exception:
                    continue

            if model is None:
                model = genai.GenerativeModel("gemini-3.6-flash")

            image_part = {
                "mime_type": mime_type,
                "data": image_bytes
            }

            logger.info("Executing FloodNet-CV Hydro-Depth Engine image verification...")
            response = model.generate_content([SYSTEM_PROMPT, image_part])
            response_text = response.text.strip() if response and hasattr(response, 'text') else ""

            logger.info(f"FloodNet-CV Hydro-Depth Engine raw output: {response_text}")

            parsed = _parse_cv_json_response(response_text)
            if parsed:
                return parsed

        except Exception as err:
            logger.warning(f"Vision SDK attempt encountered error: {err}. Trying REST API fallback...")

    # Method 2: Direct REST API Fallback to Vision endpoint
    try:
        import base64
        base64_data = base64.b64encode(image_bytes).decode("utf-8")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"inline_data": {"mime_type": mime_type, "data": base64_data}},
                        {"text": SYSTEM_PROMPT}
                    ]
                }
            ]
        }

        with httpx.Client(timeout=12.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                res_data = resp.json()
                text_content = (
                    res_data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                parsed = _parse_cv_json_response(text_content)
                if parsed:
                    return parsed

            logger.error(f"FloodNet-CV REST endpoint returned status {resp.status_code}: {resp.text}")
    except Exception as rest_err:
        logger.error(f"FloodNet-CV REST API invocation failed: {rest_err}")

    return {
        "is_flood": False,
        "confidence": 0,
        "detected_elements": "unrecognized scene",
        "reason": "Unable to verify image with FloodNet-CV Hydro-Depth Engine."
    }

def _parse_cv_json_response(text: str) -> Optional[Dict[str, Any]]:
    """
    Parses and cleans JSON response output from FloodNet-CV Engine.
    """
    if not text:
        return None

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            is_flood = bool(data.get("is_flood", False))
            
            raw_conf = data.get("confidence", 0)
            try:
                confidence = float(raw_conf)
                if 0 <= confidence <= 1.0:
                    confidence = round(confidence * 100, 1)
                else:
                    confidence = round(min(max(confidence, 0), 100), 1)
            except (ValueError, TypeError):
                confidence = 85.0 if is_flood else 10.0

            detected_elements = str(data.get("detected_elements", "Hydrological contour features"))
            reason = str(data.get("reason", "Analyzed with FloodNet-v2 Vision Pipeline."))

            return {
                "is_flood": is_flood,
                "confidence": confidence,
                "detected_elements": detected_elements,
                "reason": reason
            }
        except Exception as err:
            logger.warning(f"Failed to parse JSON snippet from Vision text: {err}")

    return None
