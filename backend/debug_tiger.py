import json

with open("events.json", "r", encoding="utf-8") as f:
    events = json.load(f)

tigers = [e for e in events if e["provider"] == "TIGER"]

with open("debug_output.txt", "w", encoding="utf-8") as out:
    out.write(f"TIGER 이벤트 총 {len(tigers)}건\n\n")
    for i, e in enumerate(tigers):
        out.write(f"#{i+1}\n")
        out.write(f"  제목: {e['title'][:70]}\n")
        out.write(f"  상태: {e['status']}\n")
        out.write(f"  기간: {e.get('start_date','?')} ~ {e.get('end_date','?')}\n")
        out.write(f"  D-Day: {e.get('d_day')}\n\n")

print("debug_output.txt에 저장 완료")
