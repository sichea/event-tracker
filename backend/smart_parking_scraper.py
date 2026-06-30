import os
import json
import requests
import sys
import io
from dotenv import load_dotenv

# Windows 터미널 한글/이모지 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 환경 변수 로드
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

print("[Parking Scraper] Starting Static Update Engine (June 2026)...")

# 사용자 제공 데이터 리스트 (26.6월 기준)
USER_PROVIDED_PRODUCTS = [
    {
        "institution": "KB국민은행",
        "product_name": "KB GS Pay통장",
        "type": "parking",
        "base_rate": 0.1,
        "max_rate": 2.0,
        "tag": "우대금리",
        "description": {
            "text": "10만원 이하 연 2.0% (기본 0.1% + 우대 최대 1.9%). GS PAY 연결 결제 시 2만 포인트 증정.",
            "target": "첫거래고객, GS편의점 자주 가시는 분",
            "preferential_conditions": "1) 첫거래 고객 1.9% (그외 0.9%) 2) GS PAY 자동충전 연결 후 결제",
            "rules": [
                {"limit": 100000, "base_rate": 0.1, "max_rate": 2.0}
            ]
        }
    },
    {
        "institution": "애큐온저축은행",
        "product_name": "미니모으기",
        "type": "parking",
        "base_rate": 2.0,
        "max_rate": 5.0,
        "tag": "최고 5.0%",
        "description": {
            "text": "200만원 이하 기본 2.0% + 우대 최고 3.0% (목표 달성 2.0% + 출석체크 또는 마케팅동의).",
            "target": "제한없음 (1인당 5개 계좌 가입 가능, 최대 1천만원)",
            "preferential_conditions": "목표 저축액 모으기 성공(2.0%) + 출석체크 12회(1.0%) 또는 마케팅 동의(0.5%)",
            "rules": [
                {"limit": 2000000, "base_rate": 2.0, "max_rate": 5.0}
            ]
        }
    },
    {
        "institution": "전북은행",
        "product_name": "씨드모아 통장",
        "type": "parking",
        "base_rate": 2.0,
        "max_rate": 4.11,
        "tag": "3개월 우대",
        "description": {
            "text": "첫거래 고객 3개월 우대금리 제공. 2백만원 이하 최고 연 4.11% (초과분 최고 연 3.11%).",
            "target": "첫거래 고객, 3개월만 짧게 예치할 분",
            "preferential_conditions": "마케팅 동의(0.6%) + 2백만원 이하 우대 1.51% (초과분 우대 0.51%)",
            "rules": [
                {"limit": 2000000, "base_rate": 2.0, "max_rate": 4.11}
            ]
        }
    },
    {
        "institution": "OK저축은행",
        "product_name": "파킹플렉스 통장",
        "type": "parking",
        "base_rate": 3.01,
        "max_rate": 3.01,
        "tag": "조건없음",
        "description": {
            "text": "우대조건 없음. 5백만원 이하 연 3.01% (3억 이하 연 2.4%, 3억 초과 연 1.5%).",
            "target": "우대조건 없는 고금리 파킹통장 선호 고객",
            "preferential_conditions": "조건 없음",
            "rules": [
                {"limit": 5000000, "base_rate": 3.01, "max_rate": 3.01}
            ]
        }
    },
    {
        "institution": "SC제일은행",
        "product_name": "스마트박스통장",
        "type": "parking",
        "base_rate": 0.3,
        "max_rate": 5.0,
        "tag": "신규/고액",
        "description": {
            "text": "통장 잔액의 50% 구간에 최고 연 5.0% 우대금리 적용 (신규고객 및 2억 이상 예치 시).",
            "target": "첫거래 고객 + 2억 이상 예치 고객",
            "preferential_conditions": "신규고객(1%) + 2억이상 예치(0.5%) + 마케팅동의(0.2%) + 급여이체(0.3%)",
            "rules": [
                {"limit": 200000000, "base_rate": 0.3, "max_rate": 5.0}
            ]
        }
    },
    {
        "institution": "케이뱅크",
        "product_name": "플러스박스",
        "type": "parking",
        "base_rate": 1.7,
        "max_rate": 2.2,
        "tag": "제한없음",
        "description": {
            "text": "5천만원 이하 연 1.7%, 5천만원 초과분 연 2.2% 기본금리 적용 (우대조건 없음).",
            "target": "제한 없음",
            "preferential_conditions": "조건 없음",
            "rules": [
                {"limit": 50000000, "base_rate": 1.7, "max_rate": 2.2}
            ]
        }
    },
    {
        "institution": "카카오뱅크",
        "product_name": "세이프박스",
        "type": "parking",
        "base_rate": 1.6,
        "max_rate": 1.6,
        "tag": "제한없음",
        "description": {
            "text": "전구간 기본이자 연 1.6% 제공 (우대조건 없음, 하루만 맡겨도 이자 지급).",
            "target": "제한 없음",
            "preferential_conditions": "조건 없음",
            "rules": [
                {"limit": None, "base_rate": 1.6, "max_rate": 1.6}
            ]
        }
    },
    {
        "institution": "토스뱅크",
        "product_name": "나눠모으기",
        "type": "parking",
        "base_rate": 1.4,
        "max_rate": 1.4,
        "tag": "제한없음",
        "description": {
            "text": "전구간 기본이자 연 1.4% 제공 (매일 이자가 복리로 쌓이는 방식, 조건 없음).",
            "target": "제한 없음",
            "preferential_conditions": "조건 없음",
            "rules": [
                {"limit": None, "base_rate": 1.4, "max_rate": 1.4}
            ]
        }
    }
]

def run_smart_scraper():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("[Error] Supabase 환경 변수가 설정되지 않았습니다.")
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    # 1. 기존 파킹통장 데이터 삭제 (사용자가 제공한 자료로만 구성하기 위함)
    print("\n[Parking Scraper] Clearing existing parking rates from DB...")
    delete_url = f"{url}/rest/v1/parking_rates?id=not.is.null"
    try:
        del_resp = requests.delete(delete_url, headers=headers)
        if del_resp.status_code >= 400:
            print(f"[Warn] 기존 데이터 삭제 중 오류 발생: {del_resp.text}")
        else:
            print("[Success] Existing parking rates cleared.")
    except Exception as e:
        print(f"[Error] Delete failed: {e}")

    # 2. 신규 데이터 업로드
    print(f"\n[Parking Scraper] Uploading {len(USER_PROVIDED_PRODUCTS)} user-provided products...")
    payloads = []
    for item in USER_PROVIDED_PRODUCTS:
        desc_json = json.dumps(item["description"], ensure_ascii=False)
        payload = {
            "type": item["type"],
            "institution": item["institution"],
            "product_name": item["product_name"],
            "base_rate": item["base_rate"],
            "max_rate": item["max_rate"],
            "tag": item["tag"],
            "description": desc_json
        }
        payloads.append(payload)

    try:
        post_resp = requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=payloads)
        if post_resp.status_code >= 400:
            print(f"[Error] 데이터 업로드 실패: {post_resp.text}")
        else:
            print(f"[Success] {len(post_resp.json())}개 상품 업로드 완료!")
    except Exception as e:
        print(f"[Error] Post failed: {e}")

if __name__ == "__main__":
    run_smart_scraper()
