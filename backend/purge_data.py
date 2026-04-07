import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def purge_providers():
    providers = ["1Q", "AMUNDI"]
    print(f"대표님, {providers} 데이터를 Supabase에서 삭제(Purge)합니다...")
    
    for provider in providers:
        try:
            # 해당 운용사의 모든 데이터를 삭제
            response = supabase.table("events").delete().eq("provider", provider).execute()
            print(f"✅ {provider}: {len(response.data)}건 삭제 완료")
        except Exception as e:
            print(f"❌ {provider} 삭제 중 오류: {e}")

if __name__ == "__main__":
    purge_providers()
