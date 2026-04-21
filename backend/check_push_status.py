import os
import httpx
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

def check():
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    with httpx.Client() as client:
        # Check subscriptions
        r = client.get(f"{SUPABASE_URL}/rest/v1/push_subscriptions", headers=headers)
        subs = r.json()
        print(f"Total Subscriptions: {len(subs)}")
        for s in subs:
            print(f"  User: {s['user_id']}, Created: {s['created_at']}")

        # Check logs
        r = client.get(f"{SUPABASE_URL}/rest/v1/notification_logs?order=created_at.desc&limit=5", headers=headers)
        logs = r.json()
        print(f"\nLast 5 Notification Logs:")
        for l in logs:
            print(f"  User: {l['user_id']}, Type: {l['target_type']}, Created: {l['created_at']}")

check()
