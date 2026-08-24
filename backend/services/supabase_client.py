import logging
from typing import Optional, Any, List, Dict
from supabase import create_client, Client
from config import settings
from services.local_db import (
    init_local_db,
    insert_local_report,
    fetch_local_reports,
    update_local_report_votes,
)

logger = logging.getLogger("floodspot.supabase")

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    """
    Returns a single instance of Supabase Client.
    If SUPABASE_URL or SUPABASE_KEY are missing, placeholder, or unreachable, returns None.
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY

    if not url or not key or "your-supabase" in url:
        logger.warning("Supabase credentials not configured or set to placeholder in .env. Using local SQLite database.")
        return None

    try:
        _supabase_client = create_client(url, key)
        logger.info("Supabase client initialized successfully.")
        return _supabase_client
    except Exception as err:
        logger.error(f"Failed to initialize Supabase client: {err}")
        return None

async def fetch_all_reports_from_db() -> Optional[List[Dict[str, Any]]]:
    """
    Queries flood reports from Supabase DB table 'flood_reports'.
    Falls back seamlessly to local SQLite database if Supabase fails (e.g., DNS getaddrinfo failed).
    """
    local_items = fetch_local_reports()

    client = get_supabase_client()
    if not client:
        return local_items if local_items else None

    try:
        response = client.table("flood_reports").select("*").order("created_at", desc=True).execute()
        supabase_items = response.data or []

        # Merge local and Supabase reports, deduplicating by ID
        seen_ids = set()
        combined = []

        for item in local_items + supabase_items:
            item_id = item.get("id")
            if item_id and item_id not in seen_ids:
                seen_ids.add(item_id)
                combined.append(item)

        # Sort by created_at DESC
        combined.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return combined if combined else local_items
    except Exception as err:
        logger.error(f"Error querying Supabase 'flood_reports' ({err}). Falling back to local SQLite DB.")
        return local_items if local_items else None

async def insert_report_to_db(report_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Inserts a new flood report into local SQLite DB first, then syncs with Supabase if reachable.
    """
    # 1. Always persist to local SQLite store first
    local_saved = insert_local_report(report_data)

    client = get_supabase_client()
    if not client:
        return local_saved

    try:
        response = client.table("flood_reports").insert(report_data).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
    except Exception as err:
        logger.error(f"Error inserting report into Supabase: {err}. Report safely saved in local SQLite DB.")

    return local_saved

async def update_report_votes_in_db(report_id: str, vote_type: str) -> Optional[Dict[str, Any]]:
    """
    Updates upvotes or downvotes in local SQLite DB and Supabase.
    """
    local_updated = update_local_report_votes(report_id, vote_type)

    client = get_supabase_client()
    if not client:
        return local_updated

    try:
        current_res = client.table("flood_reports").select("*").eq("id", report_id).execute()
        if current_res.data and len(current_res.data) > 0:
            current = current_res.data[0]
            current_up = current.get("upvotes", 0) or 0
            current_down = current.get("downvotes", 0) or 0

            update_payload = {}
            if vote_type == "up":
                update_payload["upvotes"] = current_up + 1
            elif vote_type == "down":
                update_payload["downvotes"] = current_down + 1

            if update_payload:
                res = client.table("flood_reports").eq("id", report_id).update(update_payload).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
    except Exception as err:
        logger.error(f"Error updating report votes in Supabase: {err}")

    return local_updated
