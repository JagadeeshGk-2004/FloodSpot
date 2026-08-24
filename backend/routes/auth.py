import logging
import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("floodspot.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory user database store fallback (complemented by local SQLite)
USER_DB: Dict[str, Dict[str, Any]] = {
    "citizen@floodspot.org": {
        "id": "usr-001",
        "email": "citizen@floodspot.org",
        "password": "password123",
        "full_name": "Jagadeesh G (Citizen)",
        "role": "Verified Citizen",
    }
}

class SignUpPayload(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    full_name: Optional[str] = Field("Citizen User", description="User full name")

class LoginPayload(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")

class AuthResponse(BaseModel):
    token: str
    user: Dict[str, Any]

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignUpPayload):
    """
    Registers a new FloodSpot citizen account.
    """
    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address provided.")

    if email_clean in USER_DB:
        user = USER_DB[email_clean]
        token = f"token-{user['id']}-{uuid.uuid4().hex[:8]}"
        return {"token": token, "user": {"id": user["id"], "email": user["email"], "full_name": user["full_name"], "role": user["role"]}}

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    new_user = {
        "id": user_id,
        "email": email_clean,
        "password": payload.password,
        "full_name": payload.full_name or "Citizen User",
        "role": "Verified Citizen",
    }

    USER_DB[email_clean] = new_user
    token = f"token-{user_id}-{uuid.uuid4().hex[:8]}"

    logger.info(f"Registered new FloodSpot account: {email_clean}")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email_clean,
            "full_name": new_user["full_name"],
            "role": new_user["role"],
        },
    }

@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginPayload):
    """
    Authenticates a FloodSpot user and returns an access token.
    """
    email_clean = payload.email.strip().lower()

    if email_clean in USER_DB:
        user = USER_DB[email_clean]
        if user["password"] != payload.password:
            raise HTTPException(status_code=401, detail="Incorrect password. Please check your credentials.")
        token = f"token-{user['id']}-{uuid.uuid4().hex[:8]}"
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"],
            },
        }

    # Auto-provision guest citizen account if missing
    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    new_user = {
        "id": user_id,
        "email": email_clean,
        "password": payload.password,
        "full_name": email_clean.split("@")[0].capitalize(),
        "role": "Verified Citizen",
    }
    USER_DB[email_clean] = new_user
    token = f"token-{user_id}-{uuid.uuid4().hex[:8]}"

    logger.info(f"Authenticated user: {email_clean}")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email_clean,
            "full_name": new_user["full_name"],
            "role": new_user["role"],
        },
    }

@router.get("/me")
async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Returns authenticated user profile information.
    """
    if not authorization:
        return {"id": "guest", "email": "guest@floodspot.org", "full_name": "Guest User", "role": "Citizen"}
    
    return {
        "id": "usr-active",
        "email": "active@floodspot.org",
        "full_name": "Active Citizen",
        "role": "Verified Citizen",
    }
