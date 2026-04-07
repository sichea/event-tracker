import json
from datetime import datetime

def verify():
    file_path = 'backend/events.json'
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    amundi = [e for e in data if e['provider'] == 'AMUNDI']
    oneq = [e for e in data if e['provider'] == '1Q']

    print("=== AMUNDI Summary ===")
    active_amundi = [e for e in amundi if e['status'] == '진행중']
    print(f"Active Count: {len(active_amundi)}")
    for e in active_amundi:
        print(f" - [ACTIVE] {e['title']} (End: {e['end_date']})")
    for e in [e for e in amundi if e['status'] == '종료']:
        print(f" - [ENDED] {e['title']} (End: {e['end_date']})")

    print("\n=== 1Q Summary ===")
    active_oneq = [e for e in oneq if e['status'] == '진행중']
    print(f"Active Count: {len(active_oneq)}")
    for e in active_oneq:
        print(f" - [ACTIVE] {e['title']} (End: {e['end_date']})")
    for e in [e for e in oneq if e['status'] == '종료'][:5]: # Show recent 5 ended
        print(f" - [ENDED] {e['title']} (End: {e['end_date']})")

if __name__ == "__main__":
    verify()
