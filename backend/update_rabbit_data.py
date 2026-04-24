import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

def update_data():
    print("[Parking] AI 실시간 분석 데이터 동기화 시작...")
    
    # AI 엔진이 분석한 최신 파킹/CMA 데이터
    data = [
        # --- 저축은행 (OK) ---
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "OK짠테크/피너츠/다닝다", "base_rate": 1.0, "max_rate": 7.00,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "50만원 이하 7.0%, 500만원 이하 2.8%, 5천만원 이하 2.1%",
                "target": "소액 초고금리 파킹의 정석",
                "rating": "BBB+", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 500000, "rate": 7.0}, {"limit": 5000000, "rate": 2.8}, {"limit": 50000000, "rate": 2.1}, {"limit": None, "rate": 1.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "파킹플렉스", "base_rate": 1.5, "max_rate": 3.01,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "500만원 이하 3.01%, 3억 이하 2.4%, 3억 초과 1.5%",
                "target": "500만~3억 고액 예치 추천",
                "rating": "BBB+", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 5000000, "rate": 3.01}, {"limit": 300000000, "rate": 2.4}, {"limit": None, "rate": 1.5}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "OK생활비통장", "base_rate": 0.1, "max_rate": 3.20,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "300만 이하 3.2%, 800만 이하 2.8%, 4억 이하 2.4%, 10억 이하 2.1%",
                "target": "잔액 구간별 촘촘한 이율 혜택",
                "rating": "BBB+", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 3000000, "rate": 3.2}, {"limit": 8000000, "rate": 2.8}, {"limit": 400000000, "rate": 2.4}, {"limit": 1000000000, "rate": 2.1}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        # --- 저축은행 (애큐온, 다올, DB) ---
        {
            "type": "parking", "institution": "애큐온저축은행", "product_name": "머니모으기", "base_rate": 2.0, "max_rate": 5.00,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "100만원 이하 5%, 500만원 이하 3%, 5000만원 이하 2%",
                "target": "부지런한 짠테크족 추천",
                "rating": "A", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 1000000, "rate": 5.0}, {"limit": 5000000, "rate": 3.0}, {"limit": 50000000, "rate": 2.0}, {"limit": None, "rate": 2.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "다올저축은행", "product_name": "Fi 짠테크/삼짓돈", "base_rate": 1.0, "max_rate": 2.60,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "1억 이하 2.6%, 초과 1.5%",
                "target": "깔끔한 고금리 파킹",
                "rating": "A-", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 100000000, "rate": 2.6}, {"limit": None, "rate": 1.5}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "다올저축은행", "product_name": "Fi 방치통", "base_rate": 1.0, "max_rate": 3.30,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "300만 이하 3.3%, 300만 초과 2.8%",
                "target": "소액 및 고액 혼합 추천",
                "rating": "A-", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 3000000, "rate": 3.3}, {"limit": None, "rate": 2.8}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "DB저축은행", "product_name": "DB행복파킹", "base_rate": 2.0, "max_rate": 3.50,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "500만 이하 3.5%, 3천만 이하 2.7%, 초과 2.0%",
                "target": "DB저축은행 주력 파킹",
                "rating": "BBB+", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 5000000, "rate": 3.5}, {"limit": 30000000, "rate": 2.7}, {"limit": None, "rate": 2.0}]
            }, ensure_ascii=False)
        },
        # --- 저축은행 (하나, 고수익) ---
        {
            "type": "parking", "institution": "하나저축은행", "product_name": "하나+파킹통장", "base_rate": 0.2, "max_rate": 3.30,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "100만원 이하 3.2%, 100만원 초과 시 전액 3.3%",
                "target": "잔액이 많을 때 유리",
                "rating": "A", "cycle": "매월", "mode": "whole",
                "rules": [{"limit": 1000000, "rate": 3.2}, {"limit": None, "rate": 3.3}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "고려저축은행", "product_name": "고수익자유예금", "base_rate": 2.8, "max_rate": 2.80,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "조건 없이 전 구간 연 2.8%",
                "target": "가장 심플한 고금리",
                "rating": "A", "cycle": "매월", "mode": "whole",
                "rules": [{"limit": None, "rate": 2.8}]
            }, ensure_ascii=False)
        },
        # --- 시중/지방은행 ---
        {
            "type": "parking", "institution": "전북은행", "product_name": "씨드모아", "base_rate": 3.0, "max_rate": 3.11,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "5억 이하 3.0%, 5억 초과 3.11%",
                "target": "안전한 1금융권 고액 파킹",
                "rating": "AA-", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 500000000, "rate": 3.0}, {"limit": None, "rate": 3.11}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "제주은행", "product_name": "제주달리자", "base_rate": 0.1, "max_rate": 3.15,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "500만 이하 3.15%, 5천만 이하 2.25%",
                "target": "안정적인 지방은행 금리",
                "rating": "AA-", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 5000000, "rate": 3.15}, {"limit": 50000000, "rate": 2.25}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "BNK저축은행", "product_name": "BNK파킹통장", "base_rate": 0.01, "max_rate": 3.00,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "5천만 이하 3.0%, 1억 이하 2.0%",
                "target": "예금자보호 한도 맞춤형",
                "rating": "A", "cycle": "매월", "mode": "tiered",
                "rules": [{"limit": 50000000, "rate": 3.0}, {"limit": 100000000, "rate": 2.0}, {"limit": None, "rate": 0.01}]
            }, ensure_ascii=False)
        },
        # --- 증권사 CMA (모니모/Npay 등) ---
        {
            "type": "cma", "institution": "삼성증권", "product_name": "모니모 KB/Npay 머니", "base_rate": 0.1, "max_rate": 4.00,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "200만원 이하 4.0%, 초과분 0.1%",
                "target": "소액 결제용 최고 금리",
                "rating": "AAA", "cycle": "매일", "mode": "whole",
                "rules": [{"limit": 2000000, "rate": 4.0}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "한국투자증권", "product_name": "CMA 발행어음형", "base_rate": 3.60, "max_rate": 3.60, "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({"text": "전 구간 연 3.60%", "target": "대형 증권사 안정성", "rating": "AA", "cycle": "매일", "mode": "whole", "rules": [{"limit": None, "rate": 3.6}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "미래에셋증권", "product_name": "CMA-RP형", "base_rate": 3.55, "max_rate": 3.55, "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({"text": "전 구간 연 3.55%", "target": "네이버페이 통장 연계", "rating": "AA", "cycle": "매일", "mode": "whole", "rules": [{"limit": None, "rate": 3.55}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "현대차증권", "product_name": "내일이 기대되는 CMA", "base_rate": 3.55, "max_rate": 3.55, "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({"text": "전 구간 연 3.55%", "target": "조건 없는 고금리", "rating": "A", "cycle": "매일", "mode": "whole", "rules": [{"limit": None, "rate": 3.55}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "KB증권", "product_name": "my CMA (발행어음형)", "base_rate": 3.40, "max_rate": 3.40, "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({"text": "전 구간 연 3.40%", "target": "주거래 고객 추천", "rating": "AA", "cycle": "매일", "mode": "whole", "rules": [{"limit": None, "rate": 3.40}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "NH투자증권", "product_name": "나무 CMA (발행어음형)", "base_rate": 3.30, "max_rate": 3.30, "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({"text": "전 구간 연 3.30%", "target": "나무 앱 사용자 추천", "rating": "AA", "cycle": "매일", "mode": "whole", "rules": [{"limit": None, "rate": 3.30}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "우리종합금융", "product_name": "CMA Note", "base_rate": 3.65, "max_rate": 3.65,
            "tag": "🤖 AI 실시간 탐색",
            "description": json.dumps({
                "text": "전 구간 연 3.65% (예금자보호 가능)",
                "target": "안전과 수익의 조화",
                "rating": "A", "cycle": "매일", "mode": "whole",
                "rules": [{"limit": None, "rate": 3.65}]
            }, ensure_ascii=False)
        }
    ]

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # 기존 데이터 삭제 후 클린 업데이트
    requests.delete(f"{url}/rest/v1/parking_rates?id=not.is.null", headers=headers)
    res = requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=data)
    
    if res.status_code in [201, 200, 204]:
         print(f"Success: Total {len(data)} items updated to match AI analysis results.")
    else:
         print(f"Update failed: {res.text}")

if __name__ == "__main__":
    update_data()
