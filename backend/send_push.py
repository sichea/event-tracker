import json
import os
import datetime
import httpx
from pywebpush import webpush, WebPushException

# 환경 변수 로드
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@local.com").strip()

# [직착 라이브러리 우회] httpx를 사용하여 Supabase REST API에 직접 통신
def supabase_request(method, path, params=None, json_data=None):
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    with httpx.Client() as client:
        if method == "GET":
            resp = client.get(url, headers=headers, params=params)
        elif method == "POST":
            resp = client.post(url, headers=headers, json=json_data)
        elif method == "DELETE":
            resp = client.delete(url, headers=headers, params=params)
        
        if resp.status_code >= 400:
            print(f"❌ API 오류 ({resp.status_code}): {resp.text}")
            return None
        return resp.json()

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
            # 구독 만료 시 삭제
            supabase_request("DELETE", "push_subscriptions", params={"id": f"eq.{subscription['id']}"})
        return False
    except Exception:
        return False

def process_notifications():
    print("🚀 직접 통신 모드로 알림 스캔 시작...")
    today = str(datetime.date.today())
    yesterday_dt = datetime.datetime.now() - datetime.timedelta(days=1)
    
    # 1. 구독 정보 조회
    subscriptions = supabase_request("GET", "push_subscriptions")
    if not subscriptions:
        print("🔔 진행할 구독 정보가 없습니다.")
        return

    # 2. 이벤트 데이터 조회
    etf_events = supabase_request("GET", "events", params={"status": "eq.진행중"}) or []
    ipo_events = supabase_request("GET", "ipo_events") or []

    # 유저별 기기 분류
    user_devices = {}
    for s in subscriptions:
        uid = s['user_id']
        if uid not in user_devices: user_devices[uid] = []
        user_devices[uid].append(s)

    for user_id, devices in user_devices.items():
        # 로그 확인
        logs = supabase_request("GET", "notification_logs", params={"user_id": f"eq.{user_id}"}) or []
        sent_logs = {(l['target_id'], l['category']) for l in logs}
        
        to_notify = []
        # --- ETF & IPO 로직 ---
        for ev in etf_events:
            # 1. 신규 알림
            scraped_at_val = ev.get('scraped_at') or ev.get('created_at')
            if scraped_at_val and (str(ev['id']), 'new') not in sent_logs:
                try:
                    c_at = datetime.datetime.fromisoformat(scraped_at_val.replace('Z', '+00:00')).replace(tzinfo=None)
                    # 48시간 이내 수집된 건 '신규'로 간주 (테스트를 위해 좀 더 넒힘)
                    if (datetime.datetime.now() - c_at).total_seconds() < 172800:
                        to_notify.append(("🆕 신규 ETF", ev['title'], str(ev['id']), 'etf_event', 'new'))
                except Exception: pass
            
            # 2. 마감 임박 알림
            if (str(ev['id']), 'deadline') not in sent_logs:
                if ev.get('d_day') is not None and 0 <= ev['d_day'] <= 3:
                    to_notify.append(("⏰ 마감 임박", ev['title'], str(ev['id']), 'etf_event', 'deadline'))

        for ipo in ipo_events:
            # 3. 청약 시작
            if str(ipo.get('subscription_start')) == today:
                if (str(ipo['id']), 'start') not in sent_logs:
                    to_notify.append(("📅 청약 시작", ipo['company_name'], str(ipo['id']), 'ipo_event', 'start'))
            # 4. 상장일
            if str(ipo.get('listing_date')) == today:
                if (str(ipo['id']), 'listing') not in sent_logs:
                    to_notify.append(("🚀 상장일", ipo['company_name'], str(ipo['id']), 'ipo_event', 'listing'))

        if not to_notify:
            print(f"👤 유저 {user_id}: 오늘 보낼 새로운 알림이 없습니다.")
            continue

        # 실제 발송
        for title, body, t_id, t_type, cat in to_notify:
            print(f"💌 발송 시도: {title} - {body[:20]}... (대상: {user_id})")
            sent_any = False
            for dev in devices:
                if send_push(dev, title, body):
                    sent_any = True
                    print(f"   ✅ 기기({dev['endpoint'][:20]}...) 전송 성공")
                else:
                    print(f"   ❌ 기기({dev['endpoint'][:20]}...) 전송 실패")
            
            if sent_any:
                supabase_request("POST", "notification_logs", json_data={
                    "user_id": user_id, "target_id": t_id, "target_type": t_type, "category": cat
                })

    print("🎉 모든 알림 발송 프로세스가 완료되었습니다.")

if __name__ == "__main__":
    process_notifications()
