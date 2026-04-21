import json
import os
import datetime
import httpx
import sys
import io
from pywebpush import webpush, WebPushException
from dotenv import load_dotenv

# Windows 터미널 한글/이모지 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 환경 변수 로드
load_dotenv()
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
        
        if not resp: return None
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
            supabase_request("DELETE", "push_subscriptions", params={"id": f"eq.{subscription['id']}"})
        return False
    except Exception:
        return False

def process_notifications():
    print("🚀 직접 통신 모드로 알림 스캔 시작...")
    today = str(datetime.date.today())
    yesterday_dt = datetime.datetime.now() - datetime.timedelta(days=1)
    
    try:
        # 1. 구독 정보 조회
        subscriptions = supabase_request("GET", "push_subscriptions")
        if not subscriptions:
            print("🔔 진행할 구독 정보가 없습니다.")
            return

        # 2. 이벤트 데이터 조회
        etf_events = supabase_request("GET", "events", params={"status": "eq.진행중"}) or []
        ipo_events = supabase_request("GET", "ipo_events") or []
        apt_events = supabase_request("GET", "apt_subscriptions", params={"is_lotto": "eq.true"}) or []

        # 유저별 기기 분류
        user_devices = {}
        for s in subscriptions:
            uid = s['user_id']
            if uid not in user_devices: user_devices[uid] = []
            user_devices[uid].append(s)

        # 유저별 발송 프로세스
        for user_id, devices in user_devices.items():
            logs = supabase_request("GET", "notification_logs", params={"user_id": f"eq.{user_id}"}) or []
            sent_logs = {(l['target_id'], l['category']) for l in logs}
            
            to_notify = []
            # 1. ETF 로직
            for ev in etf_events:
                # 신규 체크
                scraped_at_val = ev.get('scraped_at') or ev.get('created_at')
                if scraped_at_val and (str(ev['id']), 'new') not in sent_logs:
                    try:
                        c_at = datetime.datetime.fromisoformat(scraped_at_val.replace('Z', '+00:00')).replace(tzinfo=None)
                        if (datetime.datetime.now() - c_at).total_seconds() < 86400:
                            to_notify.append(("🆕 신규 ETF 이벤트", f"[{ev['provider']}] {ev['title']}", str(ev['id']), 'etf_event', 'new'))
                    except Exception: pass
                # 마감 임박
                if (str(ev['id']), 'deadline') not in sent_logs:
                    if ev.get('d_day') is not None and 0 <= ev['d_day'] <= 3:
                        to_notify.append(("⏰ 마감 임박 안내", f"D-{ev['d_day']}: {ev['title']}", str(ev['id']), 'etf_event', 'deadline'))

            # 2. 공모주 로직
            for ipo in ipo_events:
                sub_start = str(ipo.get('subscription_start'))
                sub_end = str(ipo.get('subscription_end'))
                listing_date = str(ipo.get('listing_date'))

                if sub_start == today:
                    if (str(ipo['id']), 'start') not in sent_logs:
                        to_notify.append(("📅 청약 시작!", f"'{ipo['company_name']}' 청약이 오늘 시작됩니다.", str(ipo['id']), 'ipo_event', 'start'))
                
                if sub_end == today:
                    if (str(ipo['id']), 'end') not in sent_logs:
                        to_notify.append(("⏰ 청약 마감일!", f"'{ipo['company_name']}' 청약이 오늘 마감됩니다. 늦지 않게 신청하세요!", str(ipo['id']), 'ipo_event', 'end'))

                if listing_date == today:
                    if (str(ipo['id']), 'listing') not in sent_logs:
                        to_notify.append(("🚀 오늘은 상장일!", f"'{ipo['company_name']}' 상장일입니다. 매도 전략을 체크하세요!", str(ipo['id']), 'ipo_event', 'listing'))

            # 3. 아파트 로또 로직
            for apt in apt_events:
                apt_start = str(apt.get('subscription_start'))
                if apt_start == today:
                    if (str(apt['id']), 'lotto_start') not in sent_logs:
                        to_notify.append(("🎰 로또 청약 시작!", f"'{apt['name']}' 청약이 오늘 시작됩니다. 잭팟 기회를 잡으세요!", str(apt['id']), 'apt_event', 'lotto_start'))

            # 발송 실행
            for title, body, t_id, t_type, cat in to_notify:
                print(f"📦 발송 준비: {title} - {body}")
                sent_any = False
                for dev in devices:
                    if send_push(dev, title, body): 
                        sent_any = True
                        print(f"  ✅ 발송 성공: User {user_id[-6:]}, Device {dev['id']}")
                    else:
                        print(f"  ❌ 발송 실패: User {user_id[-6:]}, Device {dev['id']}")
                
                if sent_any:
                    supabase_request("POST", "notification_logs", json_data={
                        "user_id": user_id, "target_id": t_id, "target_type": t_type, "category": cat
                    })

        print("🎉 모든 알림 발송 프로세스가 안정적으로 완료되었습니다.")
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")

if __name__ == "__main__":
    process_notifications()
