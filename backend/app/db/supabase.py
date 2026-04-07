from supabase import create_client, Client
from app.core.config import settings

# Lazy Singleton: The client is created ONCE on the first call,
# then reused for every subsequent request. This avoids the cost of
# rebuilding HTTP connection pools, auth headers, and internal
# sub-clients (GoTrue, PostgREST, etc.) on every single request.
_client: Client | None = None

def get_supabase_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            settings.supabase_url,
            settings.supabase_key  # Secret Key — backend only
        )
    return _client