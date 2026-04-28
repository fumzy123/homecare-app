import base64
import json
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_user_id_or_ip(request) -> str:
    """
    For authenticated requests, rate limit by user ID (extracted from JWT payload
    without verification — the actual verification still happens in require_admin/require_owner).
    Falls back to IP for unauthenticated requests.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload_b64 = auth.split(".")[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            user_id = payload.get("sub")
            if user_id:
                return str(user_id)
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=get_user_id_or_ip, default_limits=["200/minute"])
