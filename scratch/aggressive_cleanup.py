import os
import requests
from dotenv import load_dotenv

load_dotenv(r"c:\telework\event-tracker\backend\.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# 1. 강력한 조건으로 쓰레기 데이터 삭제
print("Starting aggressive DB cleanup...")

# 1) 줄바꿈이 포함된 종목명 (전형적인 테이블 긁힘 현상)
# 2) 너무 긴 종목명 (50자 이상)
# 3) 청약일이 없는 데이터
# Supabase API로 복합 쿼리가 어려울 수 있으니 전체를 가져와서 ID별로 삭제하겠습니다.

response = requests.get(f"{url}/rest/v1/ipo_events?select=id,company_name,subscription_start", headers=headers)
data = response.json()

to_delete = []
for r in data:
    name = r.get('company_name', '')
    start = r.get('subscription_start')
    
    # 삭제 조건: 줄바꿈 포함 OR 50자 초과 OR 시작일 없음
    if '\n' in name or len(name) > 50 or start is None:
        to_delete.append(r['id'])

print(f"Found {len(to_delete)} garbage records to delete.")

for rid in to_delete:
    requests.delete(f"{url}/rest/v1/ipo_events?id=eq.{rid}", headers=headers)
    print(f"Deleted garbage record: {rid}")

print("Aggressive cleanup completed.")
