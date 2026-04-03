import json

with open("events.json", "r", encoding="utf-8") as f:
    events = json.load(f)

print("--- TIGER ETF Links Check ---")
tigers = [e for e in events if e["provider"] == "TIGER"]
for i, e in enumerate(tigers[:5]):
    print(f"#{i+1} 제목: {e['title'][:50]}")
    print(f"    링크: {e['link']}")
print()

print("--- SOL ETF Dates Check ---")
sols = [e for e in events if e["provider"] == "SOL"]
for i, e in enumerate(sols):
    print(f"#{i+1} 제목: {e['title'][:50]}")
    print(f"    기간: {e.get('start_date')} ~ {e.get('end_date')} (D-Day: {e.get('d_day')})")
