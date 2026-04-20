import os
from postgrest import SyncPostgrestClient
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("SUPABASE_URL", "").strip()
key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

client = SyncPostgrestClient(f"{url}/rest/v1", headers={"apikey": key, "Authorization": f"Bearer {key}"})
data = client.from_("ipo_events").select("company_name, listing_date").execute().data

print("Sample IPO listing dates:")
for d in data[:10]:
    print(f"Name: {d['company_name']}, Listing: {repr(d['listing_date'])}")
