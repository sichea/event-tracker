import json
import os
from supabase import create_client, Client

from dotenv import load_dotenv
load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def upload_events():
    with open("events.json", "r", encoding="utf-8") as f:
        events = json.load(f)
    
    # Supabase events 테이블 형식에 맞게 데이터 변환
    records = []
    for e in events:
        records.append({
            "id": e["id"],
            "provider": e["provider"],
            "title": e["title"],
            "start_date": e.get("start_date") or None,
            "end_date": e.get("end_date") or None,
            "d_day": e.get("d_day"),
            "status": e["status"],
            "link": e.get("link"),
            "scraped_at": e.get("scraped_at")
        })

    # Upsert (중복 id는 업데이트됨)
    response = supabase.table("events").upsert(records).execute()
    print(f"✅ {len(response.data)}건의 이벤트가 Supabase로 성공적으로 업로드되었습니다.")

if __name__ == "__main__":
    upload_events()
