import os
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

def check_nh():
    url = f"{SUPABASE_URL}/rest/v1/parking_rates?institution=eq.NH투자증권&select=product_name"
    # Try with encoded name as well if needed
    response = requests.get(url, headers=headers)
    items = response.json()
    print(f"NH items: {items}")

if __name__ == "__main__":
    check_nh()
