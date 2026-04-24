import os
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient
from pathlib import Path

env_path = Path("c:/telework/event-tracker/backend/.env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("SUPABASE_URL", "").strip()
key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

client = SyncPostgrestClient(
    f"{url}/rest/v1", 
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
)

response = client.from_("ipo_events").select("*").ilike("company_name", "%키움%").execute()
for item in response.data:
    print(f"ID: {item['id']}")
    print(f"Name (repr): {repr(item['company_name'])}")
    print(f"Listing Date: {item['listing_date']}")
    print("-" * 20)
