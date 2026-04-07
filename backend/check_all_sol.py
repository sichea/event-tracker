
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

async def check():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase: Client = create_client(url, key)
    # Get all SOL events
    response = supabase.table("events").select("*").eq("provider", "SOL").execute()
    for e in response.data:
        print(f"Title: {e['title']}, Link: {e['link']}, Status: {e.get('status','')}")

asyncio.run(check())
