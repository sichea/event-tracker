import json

with open('events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

with open('verify_output_utf8.txt', 'w', encoding='utf-8') as out:
    out.write("=== TIGER LINKS ===\n")
    for e in [e for e in events if e['provider'] == 'TIGER'][:5]:
        out.write(f"[{e['title'][:15]}...] -> {e['link']}\n")
        
    out.write("\n=== SOL DATES ===\n")
    for e in [e for e in events if e['provider'] == 'SOL'][:5]:
        out.write(f"[{e['title'][:15]}...] -> {e['start_date']} ~ {e['end_date']}\n")
