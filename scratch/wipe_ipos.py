import os
import requests
from dotenv import load_dotenv

load_dotenv(r"c:\telework\event-tracker\backend\.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# 1. IPO 테이블 전체 삭제 (TRUNCATE 대신 DELETE 사용)
print("Wiping all records from ipo_events to start fresh...")
requests.delete(f"{url}/rest/v1/ipo_events?id=gt.0", headers=headers) # ID가 0보다 큰 것 모두 삭제 (사실상 전체)
# ID가 문자열일 수도 있으니 안전하게 filter 없이 delete (단, Supabase는 filter가 필요하므로 ne.-1 등 사용)
requests.delete(f"{url}/rest/v1/ipo_events?id=neq.-1", headers=headers)

print("Wipe completed. Now fixing scraper...")
