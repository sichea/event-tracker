import os
import requests
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

def wipe_data():
    print("[DB] 파킹통장/CMA 데이터 전량 삭제 시작...")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }
    # 모든 데이터 삭제
    res = requests.delete(f"{url}/rest/v1/parking_rates?id=not.is.null", headers=headers)
    if res.status_code in [200, 204]:
        print("✅ 모든 데이터가 성공적으로 삭제되었습니다.")
    else:
        print(f"❌ 삭제 실패: {res.text}")

if __name__ == "__main__":
    wipe_data()
