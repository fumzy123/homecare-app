from supabase import create_client, Client
from app.core.config import settings

# This creates a "Singleton" instance of the Supabase client.
# Because this is outside of any function, Python executes this EXACTLY ONCE
# when the server starts. We can then import this `supabase` variable anywhere
# in our app without ever having to recreate it!
def get_supabase_client() -> Client:
    return create_client(
        settings.supabase_url,
        settings.supabase_key  # secret key — backend only
    )