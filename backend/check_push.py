import os, sys, io
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
load_dotenv()
url = os.environ.get('SUPABASE_URL','').strip()
key = os.environ.get('SUPABASE_SERVICE_KEY','').strip()
client = SyncPostgrestClient(f'{url}/rest/v1', headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Prefer': 'return=representation'})

# 1. 구독 정보
subs = client.from_('push_subscriptions').select('*').execute()
print(f'=== 푸시 구독자 수: {len(subs.data)} ===')
for s in subs.data:
    uid = s["user_id"][:8]
    ep = s["endpoint"][:60]
    print(f'  User: {uid}... | Endpoint: {ep}...')

# 2. 알림 발송 로그
try:
    logs = client.from_('notification_logs').select('*').order('created_at', desc=True).limit(10).execute()
    print(f'\n=== 최근 알림 발송 로그: {len(logs.data)}건 ===')
    for l in logs.data:
        cat = l.get("category", "?")
        tt = l.get("target_type", "?")
        uid = l["user_id"][:8]
        ca = l.get("created_at", "?")
        print(f'  {ca} | User: {uid}... | {tt} | {cat}')
except Exception as e:
    print(f'\n=== notification_logs 테이블 조회 실패: {e} ===')
    print('(테이블이 존재하지 않을 수 있음)')

# 3. VAPID 키 확인
vpub = os.environ.get('VAPID_PUBLIC_KEY', '')
vpriv = os.environ.get('VAPID_PRIVATE_KEY', '')
print(f'\n=== VAPID 키 상태 ===')
print(f'  PUBLIC_KEY:  {"설정됨 (" + vpub[:10] + "...)" if vpub else "❌ 미설정"}')
print(f'  PRIVATE_KEY: {"설정됨 (" + vpriv[:10] + "...)" if vpriv else "❌ 미설정"}')

# 4. 오늘 발송 대상 이벤트 확인
import datetime
today = str(datetime.date.today())
print(f'\n=== 오늘({today}) 알림 대상 이벤트 확인 ===')

# ETF 이벤트
etf = client.from_('events').select('id, title, d_day, status').eq('status', '진행중').execute()
etf_targets = [e for e in etf.data if e.get('d_day') is not None and 0 <= e['d_day'] <= 3]
print(f'  ETF 마감임박 (D-3 이내): {len(etf_targets)}건')

# IPO 이벤트
ipo = client.from_('ipo_events').select('id, company_name, subscription_start, subscription_end, listing_date').execute()
ipo_start = [i for i in ipo.data if i.get('subscription_start') == today]
ipo_end = [i for i in ipo.data if i.get('subscription_end') == today]
ipo_list = [i for i in ipo.data if i.get('listing_date') == today]
print(f'  IPO 청약시작: {len(ipo_start)}건 {[i["company_name"] for i in ipo_start]}')
print(f'  IPO 청약마감: {len(ipo_end)}건 {[i["company_name"] for i in ipo_end]}')
print(f'  IPO 상장일:   {len(ipo_list)}건 {[i["company_name"] for i in ipo_list]}')

# APT 이벤트
try:
    apt = client.from_('apt_subscriptions').select('id, name, subscription_start').eq('is_lotto', True).execute()
    apt_today = [a for a in apt.data if a.get('subscription_start') == today]
    print(f'  APT 로또청약: {len(apt_today)}건')
except:
    print(f'  APT: 조회 실패')
