"""
Teacher Register - Authentication Module
Handles JWT generation/verification and Google Sign-in verification.
Includes offline demo support for viva/sessional presentations.
"""

import os
import time
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

JWT_SECRET = os.environ.get("JWT_SECRET", "iet-lucknow-teacher-register-secret-2026")
JWT_ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

def create_jwt_token(payload: dict) -> str:
    """Generates a signed JWT valid for 7 days."""
    data = payload.copy()
    data["exp"] = int(time.time()) + (7 * 24 * 60 * 60) # 7 days
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    """Decodes and verifies JWT signature and expiration."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None

def verify_google_token(token_str: str) -> dict:
    """
    Verifies Google ID Token against Google Public Keys.
    Returns user info dict if valid, or None if invalid.
    """
    if not GOOGLE_CLIENT_ID:
        # If no client ID configured, allow demo fallback
        return None
    try:
        id_info = id_token.verify_oauth2_token(
            token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        return {
            "google_id": id_info.get("sub"),
            "email": id_info.get("email"),
            "name": id_info.get("name"),
            "picture": id_info.get("picture")
        }
    except Exception as e:
        print(f"Google token verification failed: {e}")
        return None
