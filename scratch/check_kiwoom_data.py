import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(r"c:\telework\event-tracker\backend\.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

res = supabase.table("ipo_events").select("*").ilike("company_name", "%키움%").execute()
for r in res.data:
    print(f"[{r['id']}] {r['company_name']} - Start: {r['subscription_start']}, End: {r['subscription_end']}, Listing: {r['listing_date']}")
