import os
import sys
import io
from dotenv import load_dotenv
import httpx
from pathlib import Path
import json

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

env_path = Path("c:/telework/event-tracker/backend/.env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("SUPABASE_URL", "").strip()
key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

with httpx.Client() as client:
    resp = client.get(
        f"{url}/rest/v1/apt_subscriptions?name=eq.문수로 라티에르 673",
        headers=headers
    )
    data = resp.json()

print(json.dumps(data, indent=2, ensure_ascii=False))
