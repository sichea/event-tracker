import os
import sys
import io
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient
from pathlib import Path
import json

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

env_path = Path("c:/telework/event-tracker/backend/.env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("SUPABASE_URL", "").strip()
key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

client = SyncPostgrestClient(
    f"{url}/rest/v1", 
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
)

response = client.from_("ipo_events").select("id, company_name, listing_date").ilike("company_name", "%키움%").execute()
print("Search by Name '키움':")
for item in response.data:
    print(f"ID: {item['id']}, Name: {item['company_name']}, Date: {item['listing_date']}")

response2 = client.from_("ipo_events").select("id, company_name, listing_date").eq("listing_date", "2026-04-23").execute()
print("\nSearch by Listing Date '2026-04-23':")
for item in response2.data:
    print(f"ID: {item['id']}, Name: {item['company_name']}, Date: {item['listing_date']}")
