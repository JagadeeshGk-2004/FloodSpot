import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("floodspot.local_db")

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "local_reports.db"

def get_connection() -> sqlite3.Connection:
    """
    Returns a SQLite database connection with row factory configured.
    Creates backend/data/ directory if it does not exist.
    """
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_local_db():
    """
    Initializes the local_reports SQLite table schema.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS local_reports (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                full_name TEXT,
                location_name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                severity TEXT DEFAULT 'medium',
                water_depth TEXT DEFAULT '1.5 ft',
                water_level TEXT DEFAULT '1.5 ft',
                description TEXT,
                verified INTEGER DEFAULT 1,
                ai_confidence REAL DEFAULT 0.95,
                image_url TEXT,
                image_base64 TEXT,
                created_at TEXT NOT NULL,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE',
                level TEXT DEFAULT 'REPORT'
            )
        """)
        conn.commit()
        conn.close()
        logger.info(f"Local SQLite database initialized at {DB_PATH}")
    except Exception as err:
        logger.error(f"Error initializing local SQLite database: {err}")

def insert_local_report(report_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Inserts a flood report into the local SQLite database.
    """
    try:
        init_local_db()
        conn = get_connection()
        cursor = conn.cursor()

        report_id = report_data.get("id") or f"local-{int(datetime.utcnow().timestamp() * 1000)}"
        created_at = report_data.get("created_at") or (datetime.utcnow().isoformat() + "Z")
        w_depth = report_data.get("water_depth") or report_data.get("water_level") or "1.5 ft"
        w_level = report_data.get("water_level") or w_depth

        cursor.execute("""
            INSERT OR REPLACE INTO local_reports (
                id, user_id, full_name, location_name, latitude, longitude,
                severity, water_depth, water_level, description, verified,
                ai_confidence, image_url, image_base64, created_at, upvotes,
                downvotes, status, level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report_id,
            report_data.get("user_id"),
            report_data.get("full_name", "Anonymous User"),
            report_data.get("location_name", "Reported Hazard Zone"),
            float(report_data.get("latitude", 13.0827)),
            float(report_data.get("longitude", 80.2707)),
            report_data.get("severity", "medium"),
            w_depth,
            w_level,
            report_data.get("description", ""),
            1 if report_data.get("verified", True) else 0,
            float(report_data.get("ai_confidence", 0.95)),
            report_data.get("image_url"),
            report_data.get("image_base64"),
            created_at,
            int(report_data.get("upvotes", 0)),
            int(report_data.get("downvotes", 0)),
            report_data.get("status", "ACTIVE"),
            report_data.get("level", "REPORT"),
        ))

        conn.commit()

        cursor.execute("SELECT * FROM local_reports WHERE id = ?", (report_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            res = dict(row)
            res["verified"] = bool(res["verified"])
            return res

        return report_data
    except Exception as err:
        logger.error(f"Error inserting report into local SQLite DB: {err}")
        return report_data

def fetch_local_reports() -> List[Dict[str, Any]]:
    """
    Fetches all local reports from SQLite ordered by created_at DESC.
    Excludes reports with 3+ downvotes or FLAGGED_REMOVED status.
    """
    try:
        init_local_db()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM local_reports WHERE downvotes < 3 AND status != 'FLAGGED_REMOVED' ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()

        results = []
        for r in rows:
            item = dict(r)
            item["verified"] = bool(item["verified"])
            results.append(item)
        return results
    except Exception as err:
        logger.error(f"Error fetching reports from local SQLite DB: {err}")
        return []

def update_local_report_votes(report_id: str, vote_type: str) -> Optional[Dict[str, Any]]:
    """
    Updates upvotes or downvotes for a report in local SQLite DB.
    Automatically sets status to FLAGGED_REMOVED if downvotes reach 3.
    """
    try:
        init_local_db()
        conn = get_connection()
        cursor = conn.cursor()

        if vote_type == "up":
            cursor.execute("UPDATE local_reports SET upvotes = upvotes + 1 WHERE id = ?", (report_id,))
        elif vote_type == "down":
            cursor.execute("""
                UPDATE local_reports 
                SET downvotes = downvotes + 1,
                    status = CASE WHEN downvotes + 1 >= 3 THEN 'FLAGGED_REMOVED' ELSE status END 
                WHERE id = ?
            """, (report_id,))

        conn.commit()

        cursor.execute("SELECT * FROM local_reports WHERE id = ?", (report_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            res = dict(row)
            res["verified"] = bool(res["verified"])
            return res
        return None
    except Exception as err:
        logger.error(f"Error updating report votes in local SQLite DB: {err}")
        return None
