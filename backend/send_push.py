import json
import os
import datetime
from pywebpush import webpush, WebPushException
from supabase import create_client, Client, ClientOptions

# GitHub Actions 환경변수에서 직접 로드
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@local.com").strip()

# [필살기] 라이브러리의 엄격한 검사를 우회하여 직접 클라이언트 생성
try:
    # ClientOptions를 사용하여 헤더를 직접 제어하거나 엄격한 검사를 피함
    options = ClientOptions(
        postgrest_client_timeout=10,
        storage_client_timeout=10
    )
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY, options=options)
    print("✅ Supabase에 성공적으로 연결되었습니다.")
except Exception as e:
    # 만약 위 방식도 실패하면, 라이브러리를 통하지 않고 키만 출력해봅니다 (앞부분만)
    print(f"❌ 연결 실패 원인: {str(e)}")
    if SUPABASE_SERVICE_KEY:
        print(f"DEBUG: 사용 중인 키의 앞부분: {SUPABASE_SERVICE_KEY[:10]}...")
        print(f"DEBUG: 사용 중인 키의 길이: {len(SUPABASE_SERVICE_KEY)}")
    raise e

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
    
    # 데이터 조회
    try:
        subs_resp = supabase.table('push_subscriptions').select('*').execute()
        subscriptions = subs_resp.data
        if not subscriptions:
            print("🔔 진행 가능한 구독 정보가 없습니다.")
            return

        # ... 이하 로직 동일 ...
        user_devices = {}
        for s in subscriptions:
            uid = s['user_id']
            if uid not in user_devices: user_devices[uid] = []
            user_devices[uid].append(s)

        events_resp = supabase.table('events').select('*').eq('status', '진행중').execute()
        etf_events = events_resp.data
        
        ipo_resp = supabase.table('ipo_events').select('*').execute()
        ipo_events = ipo_resp.data

        for user_id, devices in user_devices.items():
            logs_resp = supabase.table('notification_logs').select('target_id, category').eq('user_id', user_id).execute()
            sent_logs = {(l['target_id'], l['category']) for l in logs_resp.data}
            
            to_notify = []
            for ev in etf_events:
                created_at_dt = datetime.datetime.fromisoformat(ev['created_at'].replace('Z', '+00:00'))
                if created_at_dt.replace(tzinfo=None) >= yesterday_dt.replace(tzinfo=None):
                    if (str(ev['id']), 'new') not in sent_logs:
                        to_notify.append(("🆕 신류 ETF", ev['title'], str(ev['id']), 'etf_event', 'new'))
                
                if ev.get('d_day') is not None and 0 <= ev['d_day'] <= 3:
                    if (str(ev['id']), 'deadline') not in sent_logs:
                        to_notify.append(("⏰ 마감 임박", ev['title'], str(ev['id']), 'etf_event', 'deadline'))

            for ipo in ipo_events:
                if str(ipo.get('subscription_start')) == today:
                    if (str(ipo['id']), 'start') not in sent_logs:
                        to_notify.append(("📅 청약 시작", ipo['company_name'], str(ipo['id']), 'ipo_event', 'start'))
                if str(ipo.get('listing_date')) == today:
                    if (str(ipo['id']), 'listing') not in sent_logs:
                        to_notify.append(("🚀 상장일", ipo['company_name'], str(ipo['id']), 'ipo_event', 'listing'))

            for title, body, t_id, t_type, cat in to_notify:
                sent_any = False
                for dev in devices:
                    if send_push(dev, title, body): sent_any = True
                if sent_any:
                    supabase.table('notification_logs').insert({'user_id': user_id, 'target_id': t_id, 'target_type': t_type, 'category': cat}).execute()

        print("🎉 모든 알림 작업이 완료되었습니다.")
    except Exception as e:
        print(f"❌ 데이터 처리 중 오류: {str(e)}")

if __name__ == "__main__":
    process_notifications()
