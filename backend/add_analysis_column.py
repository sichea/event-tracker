import os
from postgrest import SyncPostgrestClient
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("SUPABASE_URL", "").strip()
key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

# We can't easily run ALTER TABLE via REST API unless we have an RPC function.
# However, I can provide the SQL to the user.
# But wait, I have pushed the code change to analyze_market.py which attempts to push 'analysis'.
# If the column doesn't exist, it will error out.

print(f"Please run this SQL in your Supabase SQL Editor:")
print("ALTER TABLE public.market_insights ADD COLUMN analysis TEXT;")
