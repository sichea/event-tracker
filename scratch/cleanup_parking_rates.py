import os
import requests
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found.")
    exit(1)

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# 제거할 키워드들
EXCLUDE_KEYWORDS = ["적립식", "정기예금", "정기적금", "적금", "만기"]

def cleanup():
    print(f"Connecting to {SUPABASE_URL}...")
    
    # 1. 모든 데이터 가져오기
    url = f"{SUPABASE_URL}/rest/v1/parking_rates?select=id,product_name,institution"
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Failed to fetch data: {response.status_code} {response.text}")
        return

    items = response.json()
    print(f"Total items found: {len(items)}")
    
    to_delete = []
    for item in items:
        name = item.get("product_name", "")
        if any(k in name for k in EXCLUDE_KEYWORDS):
            to_delete.append(item)
            print(f"Found item to delete: [{item['institution']}] {name}")

    if not to_delete:
        print("No items to delete.")
        return

    print(f"\nDeleting {len(to_delete)} items...")
    for item in to_delete:
        delete_url = f"{SUPABASE_URL}/rest/v1/parking_rates?id=eq.{item['id']}"
        del_resp = requests.delete(delete_url, headers=headers)
        if del_resp.status_code in [200, 204]:
            print(f"   Deleted: {item['product_name']}")
        else:
            print(f"   Failed to delete {item['product_name']}: {del_resp.status_code}")

if __name__ == "__main__":
    cleanup()
