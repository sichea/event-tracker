import json
import os
import datetime
from pywebpush import webpush, WebPushException
from supabase import create_client, Client

# GitHub Actions 환경변수에서 직접 로드
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@local.com")

# 디버깅: 값이 비어있는지 체크 (값 자체는 출력하지 않음)
if not SUPABASE_URL: print("ERROR: SUPABASE_URL is missing in environment!")
if not SUPABASE_SERVICE_KEY: print("ERROR: SUPABASE_SERVICE_KEY is missing in environment!")

# 클라이언트 생성
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def send_push(subscription, title, body):
    payload = json.dumps({"title": title, "body": body})
    try:
        webpush(
            subscription_info={
                "endpoint": subscription['endpoint'],
                "keys": {
                    "p256dh": subscription['p256dh'],
                    "auth": subscription['auth']
                }
            },
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT}
        )
        return True
    except WebPushException as ex:
        if ex.response and ex.response.status_code == 410:
            supabase.table('push_subscriptions').delete().match({'id': subscription['id']}).execute()
        return False
    except Exception:
        return False

def process_notifications():
    today = str(datetime.date.today())
    yesterday_dt = datetime.datetime.now() - datetime.timedelta(days=1)
    
    # 1. 구독 정보 가져오기
    subs_resp = supabase.table('push_subscriptions').select('*').execute()
    subscriptions = subs_resp.data
    if not subscriptions:
        print("구독 정보가 없습니다.")
        return
    
    user_devices = {}
    for s in subscriptions:
        uid = s['user_id']
        if uid not in user_devices: user_devices[uid] = []
        user_devices[uid].append(s)

    # 2. 데이터 조회
    events_resp = supabase.table('events').select('*').eq('status', '진행중').execute()
    etf_events = events_resp.data
    
    ipo_resp = supabase.table('ipo_events').select('*').execute()
    ipo_events = ipo_resp.data

    for user_id, devices in user_devices.items():
        logs_resp = supabase.table('notification_logs').select('target_id, category').eq('user_id', user_id).execute()
        sent_logs = {(l['target_id'], l['category']) for l in logs_resp.data}
        
        to_notify = []

        # --- 로직 1: 신규 ETF 이벤트 ---
        for ev in etf_events:
            created_at_dt = datetime.datetime.fromisoformat(ev['created_at'].replace('Z', '+00:00'))
            if created_at_dt.replace(tzinfo=None) >= yesterday_dt.replace(tzinfo=None):
                if (str(ev['id']), 'new') not in sent_logs:
                    to_notify.append(("🆕 신규 ETF 이벤트!", f"[{ev['provider']}] {ev['title']}", str(ev['id']), 'etf_event', 'new'))

        # --- 로직 2: ETF 마감 임박 (D-3) ---
        for ev in etf_events:
            if ev.get('d_day') is not None and 0 <= ev['d_day'] <= 3:
                if (str(ev['id']), 'deadline') not in sent_logs:
                    to_notify.append(("⏰ 마감 임박 안내", f"D-{ev['d_day']}: {ev['title']}", str(ev['id']), 'etf_event', 'deadline'))

        # --- 로직 3: 공모주 청약/상장일 ---
        for ipo in ipo_events:
            if str(ipo.get('subscription_start')) == today:
                if (str(ipo['id']), 'start') not in sent_logs:
                    to_notify.append(("📅 청약 시작!", f"'{ipo['company_name']}' 청약이 오늘 시작됩니다.", str(ipo['id']), 'ipo_event', 'start'))
            
            if str(ipo.get('listing_date')) == today:
                if (str(ipo['id']), 'listing') not in sent_logs:
                    to_notify.append(("🚀 오늘 상장일!", f"'{ipo['company_name']}' 상장일입니다.", str(ipo['id']), 'ipo_event', 'listing'))

        # 발송
        for title, body, t_id, t_type, cat in to_notify:
            sent_any = False
            for dev in devices:
                if send_push(dev, title, body):
                    sent_any = True
            
            if sent_any:
                supabase.table('notification_logs').insert({
                    'user_id': user_id, 'target_id': t_id, 'target_type': t_type, 'category': cat
                }).execute()

if __name__ == "__main__":
    process_notifications()
    print("모든 알림 발송 프로세스가 완료되었습니다.")
