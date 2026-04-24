import os
import requests
from dotenv import load_dotenv
import sys

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv(r"c:\telework\event-tracker\backend\.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

# Fetch items with subscription_start on 2026-04-14 or 2026-04-15
response = requests.get(f"{url}/rest/v1/ipo_events?subscription_start=eq.2026-04-14", headers=headers)
print(f"April 14: {response.json()}")

response = requests.get(f"{url}/rest/v1/ipo_events?subscription_start=eq.2026-04-15", headers=headers)
print(f"April 15: {response.json()}")
