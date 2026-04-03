import json

with open('events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

print("=== TIGER LINKS ===")
for e in [e for e in events if e['provider'] == 'TIGER'][:5]:
    print(f"[{e['title'][:15]}...] -> {e['link']}")
    
print("\n=== SOL DATES ===")
for e in [e for e in events if e['provider'] == 'SOL'][:5]:
    print(f"[{e['title'][:15]}...] -> {e['start_date']} ~ {e['end_date']}")
