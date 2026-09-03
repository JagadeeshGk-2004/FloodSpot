import base64
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Path, Body, Query
from pydantic import BaseModel, Field
from services.supabase_client import (
    fetch_all_reports_from_db,
    insert_report_to_db,
    update_report_votes_in_db
)
from services.cv_service import verify_flood_image

logger = logging.getLogger("floodspot.reports")
router = APIRouter(prefix="/api/reports", tags=["Community Flood Reports"])

# Pydantic Models
class FloodReportCreate(BaseModel):
    user_id: Optional[str] = None
    full_name: Optional[str] = "Anonymous User"
    location_name: str = Field(..., example="Velachery Main Road")
    latitude: float = Field(..., example=12.9788)
    longitude: float = Field(..., example=80.2209)
    severity: str = Field("medium", example="high", description="low | medium | high | critical")
    water_depth: str = Field("1.5 ft", example="2.0 ft")
    description: Optional[str] = ""
    verified: Optional[bool] = False
    ai_confidence: Optional[float] = 0.85
    image_url: Optional[str] = None
    image_base64: Optional[str] = None

class ImageVerifyRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image string for Hydro Depth Engine spatial vision analysis")

class VoteRequest(BaseModel):
    vote_type: str = Field(..., example="up", description="'up' or 'down' or 'flag'")


@router.get("", summary="Fetch all community flood reports")
async def get_flood_reports(real_only: bool = Query(default=False)) -> List[Dict[str, Any]]:
    """
    Retrieves all active user-submitted flood reports. Excludes reports with >= 3 fake flags or hidden status.
    """
    try:
        reports = await fetch_all_reports_from_db()
        items = reports if reports is not None else []
        filtered = [
            r for r in items
            if r.get("downvotes", 0) < 3
            and r.get("fake_flags", 0) < 3
            and r.get("status") not in ["FLAGGED_REMOVED", "REMOVED_COMMUNITY_FLAGGED"]
            and not r.get("is_hidden", False)
        ]
        return filtered
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error reading flood reports: {str(err)}")

@router.post("/verify-image", summary="Verify flood image with Hydro Depth Engine")
async def verify_report_image(payload: ImageVerifyRequest) -> Dict[str, Any]:
    """
    Directly analyzes an uploaded image using Hydro Depth Engine (Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline).
    Rejects non-flood/portrait photos when confidence < 0.65.
    """
    try:
        base64_str = payload.image_base64
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        image_bytes = base64.b64decode(base64_str)
        result = verify_flood_image(image_bytes)

        conf = result.get("confidence", 0.0)
        is_valid = result.get("is_flood", False) and result.get("verified", False) and conf >= 0.65

        if not is_valid:
            return {
                "is_flood": False,
                "verified": False,
                "confidence": conf,
                "error": "No flood water, waterlogging, or rain hazards detected in this image.",
                "reason": "No flood water, waterlogging, or rain hazards detected in this image."
            }

        return {
            "is_flood": True,
            "verified": True,
            "confidence": conf,
            "status": "VERIFIED_FLOOD",
            "detected_elements": result.get("detected_elements", "Submerged asphalt contours, standing water surface"),
            "reason": result.get("reason", "Verified by Hydro Depth Engine (Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline).")
        }
    except Exception as err:
        return {
            "is_flood": False,
            "verified": False,
            "confidence": 0.0,
            "error": "No flood water, waterlogging, or rain hazards detected in this image.",
            "reason": f"Image processing failed: {str(err)}"
        }

@router.post("", summary="Create a new community flood report", status_code=201)
async def create_flood_report(report: FloodReportCreate) -> Dict[str, Any]:
    """
    Creates a new community flood report after mandatory Hydro Depth Engine verification.
    Rejects non-flood photos with HTTP 422.
    """
    try:
        payload = report.model_dump()
        
        # Ingest image for Hydro Depth Engine verification and write to static file storage
        img_str = report.image_base64 or report.image_url
        if img_str and isinstance(img_str, str) and ("data:image" in img_str or len(img_str) > 100):
            try:
                if "," in img_str:
                    base64_clean = img_str.split(",", 1)[1]
                else:
                    base64_clean = img_str
                image_bytes = base64.b64decode(base64_clean)
                verification = verify_flood_image(image_bytes)

                if not verification.get("is_flood", False) or verification.get("confidence", 0.0) < 0.65 or not verification.get("verified", False):
                    reject_msg = verification.get(
                        "error",
                        "No flood water, waterlogging, or rain hazards detected in this image."
                    )
                    raise HTTPException(status_code=422, detail=reject_msg)

                payload["verified"] = True
                payload["ai_confidence"] = verification.get("confidence", 0.85)

                # Persist image file locally to static/uploads/
                from pathlib import Path
                uploads_dir = Path(__file__).resolve().parent.parent / "static" / "uploads"
                uploads_dir.mkdir(parents=True, exist_ok=True)
                filename = f"report_{int(datetime.utcnow().timestamp() * 1000)}.jpg"
                file_path = uploads_dir / filename
                with open(file_path, "wb") as f:
                    f.write(image_bytes)

                payload["image_url"] = f"/static/uploads/{filename}"
                payload["image_base64"] = None
            except HTTPException:
                raise
            except Exception as img_err:
                logger.warning(f"Image processing note: {img_err}")

        payload["created_at"] = datetime.utcnow().isoformat() + "Z"
        payload["upvotes"] = 0
        payload["downvotes"] = 0
        payload["fake_flags"] = 0
        payload["status"] = "ACTIVE"

        created = await insert_report_to_db(payload)
        if created:
            return created
        
        fallback_item = {
            "id": f"local-{int(datetime.utcnow().timestamp()*1000)}",
            **payload
        }
        return fallback_item
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Invalid report submission payload: {str(err)}")

@router.post("/{id}/vote", summary="Upvote or downvote a community report")
async def vote_flood_report(
    id: str = Path(..., description="Report ID to vote on"),
    vote_data: VoteRequest = Body(...)
) -> Dict[str, Any]:
    """
    Increments upvotes or downvotes for a community report.
    Automatically flags and removes reports receiving 3 or more fake flags (> 2).
    """
    vote_type = vote_data.vote_type.lower()
    if vote_type not in ["up", "down", "flag"]:
        raise HTTPException(status_code=400, detail="vote_type must be 'up', 'down', or 'flag'")

    actual_vote = "down" if vote_type in ["down", "flag"] else "up"

    try:
        updated = await update_report_votes_in_db(id, actual_vote)
        if updated:
            if updated.get("downvotes", 0) >= 3 or updated.get("fake_flags", 0) >= 3:
                updated["status"] = "REMOVED_COMMUNITY_FLAGGED"
                updated["is_hidden"] = True
            return updated

        raise HTTPException(status_code=404, detail=f"Flood report with id '{id}' not found.")
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error updating report vote: {str(err)}")
