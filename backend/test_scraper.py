"""스크래퍼 테스트 스크립트"""
import asyncio
import traceback
from scraper import scrape_all
from db import upsert_events

async def test():
    try:
        events = await scrape_all()
        print(f"\n=== 총 {len(events)}건 수집 ===")
        for e in events:
            print(f"  [{e['provider']}] {e['title'][:60]}")
            print(f"    기간: {e.get('start_date', '?')} ~ {e.get('end_date', '?')}")
            print(f"    상태: {e.get('status', '?')}, D-Day: {e.get('d_day', '?')}")
        
        if events:
            merged = upsert_events(events)
            print(f"\n[DB] {len(merged)}건 저장 완료")
    except Exception as e:
        print(f"에러 발생: {e}")
        traceback.print_exc()

asyncio.run(test())
