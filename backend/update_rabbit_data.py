import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

def update_data():
    print("[Parking] 래빗햇빛님 초정밀 데이터(26.4월) 주입 시작...")
    
    # 래빗햇빛님 이자비교 표 기반 정밀 데이터 (24. 4월 버전 최신화)
    data = [
        # --- 저축은행 및 1금융권 특화 ---
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "OK짠테크/피너츠/다닝다", "base_rate": 1.0, "max_rate": 7.00,
            "tag": "50만원 이하 1위",
            "description": json.dumps({
                "text": "50만원 이하 7.0%, 500만원 이하 2.8%, 5천만원 이하 2.1%",
                "target": "소액 초고금리 파킹의 정석",
                "rating": "BBB+", "cycle": "매월",
                "rules": [{"limit": 500000, "rate": 7.0}, {"limit": 5000000, "rate": 2.8}, {"limit": 50000000, "rate": 2.1}, {"limit": None, "rate": 1.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "파킹플렉스", "base_rate": 1.5, "max_rate": 3.01,
            "tag": "조건없는 고금리",
            "description": json.dumps({
                "text": "500만원 이하 3.01%, 3억 이하 2.4%, 3억 초과 1.5%",
                "target": "500만~3억 고액 예치 추천",
                "rating": "BBB+", "cycle": "매월",
                "rules": [{"limit": 5000000, "rate": 3.01}, {"limit": 300000000, "rate": 2.4}, {"limit": None, "rate": 1.5}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "OK생활비통장", "base_rate": 0.1, "max_rate": 3.20,
            "tag": "생활비 특화",
            "description": json.dumps({
                "text": "300만 이하 3.2%, 500만 이하 2.8%, 4천만 이하 2.4%, 1억 이하 2.1%",
                "target": "잔액 구간별 촘촘한 이율 혜택",
                "rating": "BBB+", "cycle": "매월",
                "rules": [{"limit": 3000000, "rate": 3.2}, {"limit": 5000000, "rate": 2.8}, {"limit": 40000000, "rate": 2.4}, {"limit": 100000000, "rate": 2.1}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "애큐온저축은행", "product_name": "머니모으기", "base_rate": 2.0, "max_rate": 5.00,
            "tag": "최대 1천만원",
            "description": json.dumps({
                "text": "계좌당 200만원(5%)+우대금리, 5개 계좌 운영 가능",
                "target": "부지런한 짠테크족 추천",
                "rating": "A", "cycle": "매월",
                "rules": [{"limit": 2000000, "rate": 5.0}, {"limit": None, "rate": 2.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "하나은행", "product_name": "네이버페이 머니 통장", "base_rate": 0.1, "max_rate": 3.00,
            "tag": "NPay 결제용",
            "description": json.dumps({
                "text": "200만원 이하 3.0%, 초과분 0.1%",
                "target": "네이버페이 결제 연계 추천",
                "rating": "AAA", "cycle": "매월",
                "rules": [{"limit": 2000000, "rate": 3.0}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "KB국민은행", "product_name": "KB비대면입출금(Star)", "base_rate": 0.1, "max_rate": 3.00,
            "tag": "1금융 소액",
            "description": json.dumps({
                "text": "1000만원 이하 3.0%, 초과분 0.1%",
                "target": "국민은행 주거래 고객 추천",
                "rating": "AAA", "cycle": "매월",
                "rules": [{"limit": 10000000, "rate": 3.0}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "다올저축은행", "product_name": "Fi 쌈짓돈/삼짓돈3", "base_rate": 1.0, "max_rate": 5.00,
            "tag": "소액 최강자",
            "description": json.dumps({
                "text": "100만 이하 5%, 500만 이하 3%, 5000만 이하 2%",
                "target": "100만원 소액 비상금용",
                "rating": "A-", "cycle": "매월",
                "rules": [{"limit": 1000000, "rate": 5.0}, {"limit": 5000000, "rate": 3.0}, {"limit": 50000000, "rate": 2.0}, {"limit": None, "rate": 1.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "DB저축은행", "product_name": "DB행복파킹", "base_rate": 0.8, "max_rate": 3.50,
            "tag": "첫거래 추천",
            "description": json.dumps({
                "text": "500만 이하 3.5%, 3천만 이하 1.5%, 초과 0.8%",
                "target": "DB저축은행 신규 고객 추천",
                "rating": "BBB+", "cycle": "매월",
                "rules": [{"limit": 5000000, "rate": 3.5}, {"limit": 30000000, "rate": 1.5}, {"limit": None, "rate": 0.8}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "하나저축은행", "product_name": "하나+파킹통장", "base_rate": 2.9, "max_rate": 3.30,
            "tag": "하나금융지주",
            "description": json.dumps({
                "text": "1억 이하 3.2%, 1억 초과 3.3%",
                "target": "고액을 안전하게 예치하고 싶을 때",
                "rating": "A", "cycle": "매월",
                "rules": [{"limit": 100000000, "rate": 3.2}, {"limit": None, "rate": 3.3}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "제주은행", "product_name": "제주달리자", "base_rate": 0.01, "max_rate": 3.15,
            "tag": "시중은행 안전성",
            "description": json.dumps({
                "text": "500만 이하 3.15%, 5천 이하 2.25%, 1억 이하 2.05%",
                "target": "지방은행의 안전한 파킹",
                "rating": "AA-", "cycle": "매월",
                "rules": [{"limit": 5000000, "rate": 3.15}, {"limit": 50000000, "rate": 2.25}, {"limit": 100000000, "rate": 2.05}, {"limit": None, "rate": 0.01}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "전북은행", "product_name": "씨드모아", "base_rate": 0.01, "max_rate": 3.11,
            "tag": "고액 추천",
            "description": json.dumps({
                "text": "5억 이하 3.0%, 5억 초과 3.11%",
                "target": "고액 자산가 단기 예치용",
                "rating": "AA-", "cycle": "매월",
                "rules": [{"limit": 50000000, "rate": 0.01}, {"limit": 500000000, "rate": 3.0}, {"limit": None, "rate": 3.11}]
            }, ensure_ascii=False)
        },
        # --- 인터넷 은행 ---
        {
            "type": "parking", "institution": "토스뱅크", "product_name": "토스뱅크 통장", "base_rate": 2.0, "max_rate": 2.00,
            "tag": "매일 이자 받기",
            "description": json.dumps({"text": "금액 제한 없이 연 2.0%, 매일 이자 받기 가능", "target": "가장 편리한 입출금 통장", "rating": "AAA", "cycle": "매일", "rules": [{"limit": None, "rate": 2.0}]}, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "케이뱅크", "product_name": "플러스박스", "base_rate": 2.3, "max_rate": 2.30,
            "tag": "최대 10억",
            "description": json.dumps({"text": "최대 10억까지 연 2.3%", "target": "고액 파킹용 인터넷뱅크", "rating": "AAA", "cycle": "매일", "rules": [{"limit": 1000000000, "rate": 2.3}, {"limit": None, "rate": 0.1}]}, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "카카오뱅크", "product_name": "세이프박스", "base_rate": 2.0, "max_rate": 2.00,
            "tag": "보관형",
            "description": json.dumps({"text": "최대 1억까지 연 2.0%", "target": "카카오뱅크 사용자 필수", "rating": "AAA", "cycle": "매월", "rules": [{"limit": 100000000, "rate": 2.0}, {"limit": None, "rate": 0.1}]}, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "BNK저축은행", "product_name": "BNK파킹통장", "base_rate": 0.01, "max_rate": 3.00,
            "tag": "심플한 5천",
            "description": json.dumps({
                "text": "5천만 이하 3.0%, 1억 이하 2.0%, 초과 0.01%",
                "target": "예금자 보호 한도(5천) 딱 맞춤",
                "rating": "A", "cycle": "매월",
                "rules": [{"limit": 50000000, "rate": 3.0}, {"limit": 100000000, "rate": 2.0}, {"limit": None, "rate": 0.01}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "고려저축은행", "product_name": "고수위파킹통장", "base_rate": 2.8, "max_rate": 2.80,
            "tag": "안정적 금리",
            "description": json.dumps({
                "text": "전구간 조건 없이 연 2.8%",
                "target": "신경 쓰기 싫은 분들을 위한 파킹",
                "rating": "A", "cycle": "매월",
                "rules": [{"limit": None, "rate": 2.8}]
            }, ensure_ascii=False)
        },
        # --- 증권사 CMA ---
        {
            "type": "cma", "institution": "삼성증권", "product_name": "모니모 KB/Npay 머니", "base_rate": 0.1, "max_rate": 4.00,
            "tag": "플랫폼 연계",
            "description": json.dumps({
                "text": "200만원 이하 4.0% (초과분 0.1%)",
                "target": "모니모/네이버페이 사용자 필수",
                "rating": "AAA", "cycle": "매일",
                "rules": [{"limit": 2000000, "rate": 4.0}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "한국투자증권", "product_name": "CMA 발행어음형", "base_rate": 3.60, "max_rate": 3.60, "tag": "발행어음",
            "description": json.dumps({"text": "하루만 맡겨도 연 3.6% 수익 발생", "target": "안정적인 대형 증권사 선호", "rating": "AA", "cycle": "매일", "rules": [{"limit": None, "rate": 3.6}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "미래에셋증권", "product_name": "CMA-RP형", "base_rate": 3.55, "max_rate": 3.55, "tag": "네이버페이",
            "description": json.dumps({"text": "네이버페이 통장 연계 시 추가 혜택", "target": "네이버페이 자주 쓰는 분", "rating": "AA", "cycle": "매일", "rules": [{"limit": None, "rate": 3.55}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "우리종합금융", "product_name": "CMA Note", "base_rate": 3.65, "max_rate": 3.65, "tag": "예금자보호",
            "description": json.dumps({"text": "증권사 중 드물게 5천만원 예금자 보호 가능", "target": "안전과 수익을 동시에 잡고 싶을 때", "rating": "A", "cycle": "매일", "rules": [{"limit": None, "rate": 3.65}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "현대차증권", "product_name": "내일이 기대되는 CMA", "base_rate": 3.55, "max_rate": 3.55, "tag": "고금리RP",
            "description": json.dumps({ "text": "조건 없이 누구나 연 3.55% (RP형)", "target": "우대조건 신경 쓰기 싫은 분", "rating": "A", "cycle": "매일", "rules": [{"limit": None, "rate": 3.55}] }, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "KB증권", "product_name": "my CMA (발행어음형)", "base_rate": 3.40, "max_rate": 3.40, "tag": "대형사",
            "description": json.dumps({ "text": "KB금융지주의 안정성, 연 3.40%", "target": "KB 주거래 고객 추천", "rating": "AA", "cycle": "매일", "rules": [{"limit": None, "rate": 3.40}] }, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "NH투자증권", "product_name": "나무 CMA (발행어음형)", "base_rate": 3.30, "max_rate": 3.30, "tag": "편의성",
            "description": json.dumps({ "text": "나무 앱 전용 간편 개설, 연 3.30%", "target": "나무 앱 사용자 추천", "rating": "AA", "cycle": "매일", "rules": [{"limit": None, "rate": 3.30}] }, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "삼성증권", "product_name": "모니모 CMA (RP형)", "base_rate": 3.20, "max_rate": 3.20, "tag": "모니모",
            "description": json.dumps({ "text": "모니모 앱 연계 시 편리한 자금 관리", "target": "모니모 앱 사용자 필수", "rating": "AA", "cycle": "매일", "rules": [{"limit": None, "rate": 3.20}] }, ensure_ascii=False)
        }
    ]

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # 기존 데이터 삭제
    requests.delete(f"{url}/rest/v1/parking_rates?id=not.is.null", headers=headers)
    
    # 새 데이터 삽입
    res = requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=data)
    if res.status_code in [201, 200, 204]:
         print(f"총 {len(data)}건의 래빗햇빛님 초정밀 데이터를 업데이트했습니다.")
    else:
         print(f"업데이트 실패: {res.text}")

if __name__ == "__main__":
    update_data()
