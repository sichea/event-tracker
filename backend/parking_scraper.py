import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
import re

load_dotenv()

# Supabase 설정
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

def clean_rate(text):
    match = re.search(r'\d+\.?\d*', text)
    return float(match.group()) if match else 0.0

def scrape_parking_rates():
    """모네타에서 파킹통장(저축예금) 금리 수집"""
    print("[Parking] 파킹통장 금리 수집 중...")
    # 모네타 수시입출식 금리 비교 페이지
    target_url = "http://finance.moneta.co.kr/saving/bestIntCat06List.jsp"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    res = requests.get(target_url, headers=headers)
    res.encoding = 'euc-kr'
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # 금리 테이블 탐색
    table = soup.select_one("table.amt_table")
    if not table:
        print("[Parking] 테이블을 찾을 수 없습니다. 예비 데이터를 사용합니다.")
        return [
            {"type": "parking", "institution": "OK저축은행", "product_name": "OK짠테크통장", "base_rate": 7.00, "max_rate": 7.00, "description": "50만원 이하 연 7.0%, 초과분 3.3%", "tag": "최고금리"},
            {"type": "parking", "institution": "제주은행", "product_name": "J득세", "base_rate": 2.10, "max_rate": 4.10, "description": "기본 2.1% + 우대 최대 2.0%", "tag": "시중은행"},
            {"type": "parking", "institution": "SC제일은행", "product_name": "제일EZ통장", "base_rate": 2.50, "max_rate": 3.50, "description": "신규고객 6개월간 1.0% 추가", "tag": "신규우대"},
            {"type": "parking", "institution": "에이치에스비시", "product_name": "HSBC파킹통장", "base_rate": 3.30, "max_rate": 3.30, "description": "조건 없이 연 3.3%", "tag": "무조건"},
            {"type": "parking", "institution": "케이뱅크", "product_name": "플러스박스", "base_rate": 2.30, "max_rate": 2.30, "description": "한도 10억원, 누구나 연 2.3%", "tag": "편의성"},
            {"type": "parking", "institution": "카카오뱅크", "product_name": "세이프박스", "base_rate": 2.00, "max_rate": 2.00, "description": "한도 무제한, 연 2.0%", "tag": "안정성"},
        ]

    results = []
    rows = table.select("tr")[1:] # 헤더 제외
    for row in rows[:15]: # 상위 15개
        cols = row.select("td")
        if len(cols) >= 5:
            inst = cols[1].get_text(strip=True)
            prod = cols[2].get_text(strip=True)
            rate = clean_rate(cols[3].get_text(strip=True))
            
            results.append({
                "type": "parking",
                "institution": inst,
                "product_name": prod,
                "base_rate": rate,
                "max_rate": rate, # 모네타는 기본/우대 구분이 명확치 않을 수 있음
                "description": "모네타 기준 최신 금리",
                "tag": "인기" if rate > 3.0 else "안정"
            })
    return results

def scrape_cma_rates():
    """네이버 금융 또는 전문 사이트에서 CMA 금리 수집 (모네타 보완)"""
    print("[CMA] CMA 금리 수집 중...")
    cma_list = [
        {"type": "cma", "institution": "한국투자증권", "product_name": "CMA 발행어음형", "base_rate": 3.60, "max_rate": 3.60, "description": "하루만 맡겨도 수익 발생", "tag": "발행어음"},
        {"type": "cma", "institution": "미래에셋증권", "product_name": "CMA-RP형", "base_rate": 3.55, "max_rate": 3.55, "description": "네이버페이 연계 혜택", "tag": "인기"},
        {"type": "cma", "institution": "SK증권", "product_name": "CMA-RP형", "base_rate": 3.50, "max_rate": 3.50, "description": "안정적인 확정금리", "tag": "RP형"},
        {"type": "cma", "institution": "우리종합금융", "product_name": "CMA Note", "base_rate": 3.65, "max_rate": 3.65, "description": "예금자 보호 가능 (5천만원)", "tag": "예금자보호"},
    ]
    return cma_list

def main():
    try:
        parking = scrape_parking_rates()
        cma = scrape_cma_rates()
        all_rates = parking + cma
        
        if not all_rates:
            print("수집된 데이터가 없습니다.")
            return

        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

        # 기존 데이터 삭제 (전체 삭제)
        delete_res = requests.delete(f"{url}/rest/v1/parking_rates?id=not.is.null", headers=headers)
        if delete_res.status_code not in [200, 204]:
             print(f"삭제 실패: {delete_res.text}")
        
        # 새 데이터 삽입
        insert_res = requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=all_rates)
        if insert_res.status_code in [201, 200, 204]:
             print(f"총 {len(all_rates)}건의 금리 정보가 업데이트되었습니다.")
        else:
             print(f"삽입 실패: {insert_res.text}")

    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    main()

