import logging
from typing import Optional, Any
from supabase import create_client, Client
from config import settings

logger = logging.getLogger("floodspot.supabase")

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    """
    Returns a single instance of Supabase Client.
    If SUPABASE_URL or SUPABASE_KEY are missing or placeholder, returns None.
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY

    if not url or not key or "your-supabase" in url:
        logger.warning("Supabase credentials not configured or set to placeholder in .env. Falling back to local/mock operations.")
        return None

    try:
        _supabase_client = create_client(url, key)
        logger.info("Supabase client initialized successfully.")
        return _supabase_client
    except Exception as err:
        logger.error(f"Failed to initialize Supabase client: {err}")
        return None

async def fetch_all_reports_from_db() -> Optional[list[dict[str, Any]]]:
    """
    Asynchronously queries active flood reports from Supabase DB table 'flood_reports'.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Supabase client execution
        response = client.table("flood_reports").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as err:
        logger.error(f"Error querying 'flood_reports' from Supabase: {err}")
        return None

async def insert_report_to_db(report_data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    Inserts a new flood report into Supabase DB table 'flood_reports'.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        response = client.table("flood_reports").insert(report_data).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as err:
        logger.error(f"Error inserting report into Supabase: {err}")
        return None

async def update_report_votes_in_db(report_id: str, vote_type: str) -> Optional[dict[str, Any]]:
    """
    Updates upvotes or downvotes for a specific report in Supabase.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Fetch current record
        current_res = client.table("flood_reports").select("*").eq("id", report_id).execute()
        if not current_res.data or len(current_res.data) == 0:
            return None

        current = current_res.data[0]
        current_up = current.get("upvotes", 0) or 0
        current_down = current.get("downvotes", 0) or 0

        update_payload = {}
        if vote_type == "up":
            update_payload["upvotes"] = current_up + 1
        elif vote_type == "down":
            update_payload["downvotes"] = current_down + 1
        else:
            return None

        res = client.table("flood_reports").eq("id", report_id).update(update_payload).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as err:
        logger.error(f"Error updating report votes in Supabase: {err}")
        return None
