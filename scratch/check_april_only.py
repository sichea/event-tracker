import os
import requests
from dotenv import load_dotenv
import sys

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv(r"c:\telework\event-tracker\backend\.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

response = requests.get(f"{url}/rest/v1/ipo_events?select=*", headers=headers)
data = response.json()

print("--- Records on April 14/15 ---")
for r in data:
    if r['subscription_start'] in ['2026-04-14', '2026-04-15']:
        print(f"ID: {r['id']}, Name: {repr(r['company_name'])}, Start: {r['subscription_start']}, Listing: {r['listing_date']}")
