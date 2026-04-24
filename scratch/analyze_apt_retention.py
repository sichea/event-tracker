import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(r"c:\telework\event-tracker\backend\.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

res = supabase.table("apt_subscriptions").select("name, status, subscription_end, winner_date").execute()
for r in res.data:
    print(f"[{r['status']}] {r['name']} - End: {r['subscription_end']}, Winner: {r['winner_date']}")
