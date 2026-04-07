
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

async def check():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase: Client = create_client(url, key)
    # Get one SOL event's link
    response = supabase.table("events").select("link, title").eq("provider", "SOL").limit(1).execute()
    if response.data:
        print("SOL Link:", response.data[0]['link'])
        print("SOL Title:", response.data[0]['title'])

asyncio.run(check())
