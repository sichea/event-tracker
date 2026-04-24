import os
import requests
from dotenv import load_dotenv
import sys

# Ensure output is UTF-8
sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(r"c:\telework\event-tracker\backend\.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

response = requests.get(f"{url}/rest/v1/ipo_events?select=*", headers=headers)
data = response.json()

for r in data:
    name = r['company_name']
    print(f"ID: {r['id']}, Name: {repr(name)}, Start: {r['subscription_start']}, End: {r['subscription_end']}, Listing: {r['listing_date']}")
