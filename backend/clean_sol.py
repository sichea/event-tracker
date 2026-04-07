
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

def clean():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    # 1. Clean Supabase (SOL events not containing '4월')
    res = supabase.table('events').delete().eq('provider', 'SOL').not_.ilike('title', '%4월%').execute()
    print(f"Deleted {len(res.data)} from Supabase")

    # 2. Clean local events.json
    data_file = Path('events.json')
    if data_file.exists():
        with open(data_file, 'r', encoding='utf-8') as f:
            events = json.load(f)
        
        cleaned = [e for e in events if not (e['provider'] == 'SOL' and '4월' not in e['title'])]
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(cleaned, f, ensure_ascii=False, indent=2)
        print(f"Cleaned local events.json: {len(events)} -> {len(cleaned)}")
    else:
        print("events.json not found locally")

if __name__ == "__main__":
    clean()
