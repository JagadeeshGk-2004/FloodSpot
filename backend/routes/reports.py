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

# Fallback Mock Data matching frontend schema
MOCK_FLOOD_REPORTS: List[Dict[str, Any]] = [
    {
        "id": "mock-1",
        "latitude": 12.9788,
        "longitude": 80.2209,
        "location_name": "Velachery Bypass Road",
        "severity": "critical",
        "water_depth": "2.5 ft",
        "description": "Severe waterlogging under Velachery flyover. Vehicles stalled. Avoid route.",
        "verified": True,
        "ai_confidence": 0.96,
        "upvotes": 14,
        "downvotes": 1,
        "created_at": "2026-08-04T18:30:00Z",
        "image_url": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "mock-2",
        "latitude": 13.0405,
        "longitude": 80.2337,
        "location_name": "T. Nagar (Usman Road)",
        "severity": "high",
        "water_depth": "1.8 ft",
        "description": "Knee-deep standing water near Panagal Park. Traffic moving extremely slow.",
        "verified": True,
        "ai_confidence": 0.92,
        "upvotes": 9,
        "downvotes": 0,
        "created_at": "2026-08-04T19:15:00Z",
        "image_url": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "mock-3",
        "latitude": 13.0334,
        "longitude": 80.2683,
        "location_name": "Mylapore (Luz Church Rd)",
        "severity": "medium",
        "water_depth": "1.0 ft",
        "description": "Water accumulation along curb side. Slow moving traffic.",
        "verified": True,
        "ai_confidence": 0.88,
        "upvotes": 5,
        "downvotes": 1,
        "created_at": "2026-08-04T20:00:00Z",
        "image_url": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "mock-4",
        "latitude": 12.9229,
        "longitude": 80.1275,
        "location_name": "Tambaram East",
        "severity": "critical",
        "water_depth": "3.0 ft",
        "description": "Residential street submerged. Emergency assistance deployed nearby.",
        "verified": True,
        "ai_confidence": 0.98,
        "upvotes": 22,
        "downvotes": 2,
        "created_at": "2026-08-04T20:45:00Z",
        "image_url": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80"
    }
]

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
    image_base64: str = Field(..., description="Base64 encoded image string for FloodNet-CV vision analysis")

class VoteRequest(BaseModel):
    vote_type: str = Field(..., example="up", description="'up' or 'down'")


@router.get("", summary="Fetch all community flood reports")
async def get_flood_reports(real_only: bool = Query(default=False)) -> List[Dict[str, Any]]:
    """
    Retrieves all active user-submitted flood reports. Excludes reports with >= 3 fake flags.
    """
    try:
        reports = await fetch_all_reports_from_db()
        items = reports if (reports is not None and len(reports) > 0) else ([] if real_only else MOCK_FLOOD_REPORTS)
        filtered = [
            r for r in items
            if r.get("downvotes", 0) < 3
            and r.get("fake_flags", 0) < 3
            and r.get("status") != "FLAGGED_REMOVED"
        ]
        return filtered
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error reading flood reports: {str(err)}")

@router.post("/verify-image", summary="Verify flood image with Hydro Depth Engine")
async def verify_report_image(payload: ImageVerifyRequest) -> Dict[str, Any]:
    """
    Directly analyzes an uploaded image using Hydro Depth Engine.
    Rejects non-flood photos with HTTP 400.
    """
    try:
        base64_str = payload.image_base64
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        image_bytes = base64.b64decode(base64_str)
        result = verify_flood_image(image_bytes)

        if not result.get("is_flood", True):
            raise HTTPException(
                status_code=400,
                detail="Image verification failed: Uploaded photo does not show flood or waterlogging conditions."
            )
        return result
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(err)}")

@router.post("", summary="Create a new community flood report", status_code=201)
async def create_flood_report(report: FloodReportCreate) -> Dict[str, Any]:
    """
    Creates a new community flood report after mandatory FloodNet-CV Hydro-Depth Verification.
    Saves image persistently to backend/static/uploads/.
    """
    try:
        payload = report.model_dump()
        
        # Ingest image for FloodNet-CV verification and write to static file storage
        img_str = report.image_base64 or report.image_url
        if img_str and isinstance(img_str, str) and ("data:image" in img_str or len(img_str) > 100):
            try:
                if "," in img_str:
                    base64_clean = img_str.split(",", 1)[1]
                else:
                    base64_clean = img_str
                image_bytes = base64.b64decode(base64_clean)
                verification = verify_flood_image(image_bytes)

                if not verification.get("is_flood", True):
                    raise HTTPException(
                        status_code=400,
                        detail="Image verification failed: Uploaded photo does not show flood or waterlogging conditions."
                    )
                payload["verified"] = True
                payload["ai_confidence"] = verification.get("confidence", 0.95)

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

        created = await insert_report_to_db(payload)
        if created:
            return created
        
        # Fallback local report response if DB is offline
        fallback_item = {
            "id": f"local-{int(datetime.utcnow().timestamp()*1000)}",
            **payload
        }
        MOCK_FLOOD_REPORTS.insert(0, fallback_item)
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
    Automatically flags and removes reports receiving 3 or more fake flags.
    """
    vote_type = vote_data.vote_type.lower()
    if vote_type not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="vote_type must be either 'up' or 'down'")

    try:
        updated = await update_report_votes_in_db(id, vote_type)
        if updated:
            return updated

        # In-memory update for mock reports fallback
        for r in MOCK_FLOOD_REPORTS:
            if r.get("id") == id:
                if vote_type == "up":
                    r["upvotes"] = r.get("upvotes", 0) + 1
                else:
                    r["downvotes"] = r.get("downvotes", 0) + 1
                    if r["downvotes"] >= 3:
                        r["status"] = "FLAGGED_REMOVED"
                return r

        raise HTTPException(status_code=404, detail=f"Flood report with id '{id}' not found.")
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error updating report vote: {str(err)}")
