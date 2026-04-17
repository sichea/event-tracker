import json
import os
import psycopg2
from psycopg2.extras import DictCursor
from pywebpush import webpush, WebPushException
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@local.com")

DB_USER = "postgres"
DB_PASS = os.environ.get("SUPABASE_DB_PASS", "") # Requires raw DB connection or we could use supabase-py. Let's use supabase-py to be safe and consistent

from supabase import create_client, Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def send_push_to_all(title, body):
    response = supabase.table('push_subscriptions').select('*').execute()
    subs = response.data
    
    if not subs:
        print("No push subscriptions found.")
        return

    payload = json.dumps({"title": title, "body": body})
    
    success_count = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub['endpoint'],
                    "keys": {
                        "p256dh": sub['p256dh'],
                        "auth": sub['auth']
                    }
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT}
            )
            success_count += 1
        except WebPushException as ex:
            print("WebPushException:", repr(ex))
            if ex.response and ex.response.status_code == 410:
                # 410 Gone means the subscription is no longer valid.
                supabase.table('push_subscriptions').delete().match({'id': sub['id']}).execute()
                print(f"Removed invalid subscription: {sub['id']}")
            else:
                print(ex)
        except Exception as e:
            print("Unknown Error:", e)

    print(f"Push messages sent: {success_count}/{len(subs)}")

if __name__ == "__main__":
    # Test message
    send_push_to_all(
        "RE:MEMBER 알림", 
        "내일 마감인 공모주 청약이 있습니다. 잊지 말고 참여하세요!"
    )
