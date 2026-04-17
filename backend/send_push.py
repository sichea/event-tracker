import json
import os
import datetime
from pywebpush import webpush, WebPushException
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# 환경 변수에서 공백 제거 (복사/붙여넣기 시 공백이 포함될 수 있음)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

# 디버깅: 설정값 확인
print(f"DEBUG: SUPABASE_URL length: {len(SUPABASE_URL)}")
print(f"DEBUG: SERVICE_KEY length: {len(SUPABASE_SERVICE_KEY)}")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("환경 변수 로드 실패")

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@local.com").strip()

try:
    # 최신 Supabase 키 형식을 지원하기 위해 클라이언트 생성 시도
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("DEBUG: Supabase Client initialized successfully.")
except Exception as e:
    print(f"DEBUG: First attempt failed: {str(e)}")
    # 대체 방법: SUPABASE_KEY (익명 키)가 있다면 그것으로 시도하거나 환경 변수 재점검 권고
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
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    
    # 1. 모든 유저의 구독 정보 가져오기
    subs_resp = supabase.table('push_subscriptions').select('*').execute()
    subscriptions = subs_resp.data
    if not subscriptions:
        return
    
    # 유저별로 기기 묶기
    user_devices = {}
    for s in subscriptions:
        uid = s['user_id']
        if uid not in user_devices: user_devices[uid] = []
        user_devices[uid].append(s)

    # 2. 데이터 미리 로드
    # ETF 이벤트 (진행중)
    events_resp = supabase.table('events').select('*').eq('status', '진행중').execute()
    etf_events = events_resp.data
    
    # IPO 이벤트
    ipo_resp = supabase.table('ipo_events').select('*').execute()
    ipo_events = ipo_resp.data

    for user_id, devices in user_devices.items():
        # 이미 보낸 알림 로그 확인
        logs_resp = supabase.table('notification_logs').select('target_id, category').eq('user_id', user_id).execute()
        sent_logs = {(l['target_id'], l['category']) for l in logs_resp.data}
        
        to_notify = [] # (title, body, target_id, target_type, category)

        # --- 로직 1: 신규 ETF 이벤트 (24시간 이내 수집) ---
        for ev in etf_events:
            # created_at이 어제 이후인 경우 신규로 간주
            created_at = datetime.datetime.fromisoformat(ev['created_at'].replace('Z', '+00:00')).date()
            if created_at >= yesterday:
                if (str(ev['id']), 'new') not in sent_logs:
                    to_notify.append((
                        "🆕 신규 ETF 이벤트 발견!",
                        f"[{ev['provider']}] {ev['title']}",
                        str(ev['id']), 'etf_event', 'new'
                    ))

        # --- 로직 2: ETF 마감 임박 (D-3 이내, 1회만) ---
        for ev in etf_events:
            if ev.get('d_day') is not None and 0 <= ev['d_day'] <= 3:
                if (str(ev['id']), 'deadline') not in sent_logs:
                    to_notify.append((
                        "⏰ ETF 이벤트 마감 임박",
                        f"마감 D-{ev['d_day']}: {ev['title']}",
                        str(ev['id']), 'etf_event', 'deadline'
                    ))

        # --- 로직 3: 공모주 청약 당일 ---
        for ipo in ipo_events:
            start_date = ipo.get('subscription_start')
            if start_date and str(start_date) == str(today):
                if (str(ipo['id']), 'start') not in sent_logs:
                    to_notify.append((
                        "📅 공모주 청약 시작!",
                        f"오늘부터 '{ipo['company_name']}' 청약이 시작됩니다.",
                        str(ipo['id']), 'ipo_event', 'start'
                    ))
            
            # --- 로직 4: 공모주 상장일 ---
            listing_date = ipo.get('listing_date')
            if listing_date and str(listing_date) == str(today):
                if (str(ipo['id']), 'listing') not in sent_logs:
                    to_notify.append((
                        "🚀 오늘은 상장일입니다!",
                        f"'{ipo['company_name']}' 상장일입니다. 매도 타이밍을 확인하세요.",
                        str(ipo['id']), 'ipo_event', 'listing'
                    ))

        # 알림 발송 및 로그 기록
        for title, body, t_id, t_type, cat in to_notify:
            sent_any = False
            for dev in devices:
                if send_push(dev, title, body):
                    sent_any = True
            
            if sent_any:
                supabase.table('notification_logs').insert({
                    'user_id': user_id,
                    'target_id': t_id,
                    'target_type': t_type,
                    'category': cat
                }).execute()

if __name__ == "__main__":
    process_notifications()
