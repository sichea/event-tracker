import os
import requests
from dotenv import load_dotenv

load_dotenv(r"c:\telework\event-tracker\backend\.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# 1. 쓰레기 데이터 삭제 (subscription_start가 없는 것들)
print("Cleaning garbage data...")
requests.delete(f"{url}/rest/v1/ipo_events?subscription_start=is.null", headers=headers)

# 2. 키움스팩 상장일 명시적 업데이트 (ID: 2d336ab3b40a)
# 이 ID는 아까 조회했을 때 키움히어로스팩2호의 ID였습니다.
print("Updating Kiwoom SPAC listing date...")
update_data = {"listing_date": "2026-04-23"}
requests.patch(f"{url}/rest/v1/ipo_events?id=eq.2d336ab3b40a", headers=headers, json=update_data)

print("Cleanup and specific update completed.")
