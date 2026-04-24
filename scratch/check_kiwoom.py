import os
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient
from pathlib import Path

env_path = Path("c:/telework/event-tracker/backend/.env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("SUPABASE_URL", "").strip()
key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

print(f"URL: {url}")

if not url.startswith("http"):
    print("Error: URL must start with http")
    exit(1)

client = SyncPostgrestClient(
    f"{url}/rest/v1", 
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
)

response = client.from_("ipo_events").select("*").ilike("company_name", "%키움%").execute()
import json
print(json.dumps(response.data, indent=2, ensure_ascii=False))
