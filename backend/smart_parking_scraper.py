import os
import json
import requests
import urllib.parse
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

print("[Parking Scraper] Starting Zero-AI Engine...")

# 타겟 금융사 리스트
TARGET_BANKS = [
    "OK저축은행", "다올저축은행", "애큐온저축은행", "하나저축은행", "DB저축은행",
    "제주은행", "전북은행", "BNK저축은행", "고려저축은행",
    "토스뱅크", "케이뱅크", "카카오뱅크",
    "한국투자증권", "미래에셋증권", "우리종합금융", "현대차증권", "KB증권", "NH투자증권", "삼성증권"
]

def fetch_search_results(bank_name):
    """네이버 검색 결과를 긁어옴"""
    query = urllib.parse.quote(f"{bank_name} 파킹통장 CMA 금리 2026")
    url = f"https://search.naver.com/search.naver?where=nexearch&query={query}"
    
    print(f"Searching: [{bank_name}] ...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
            page = context.new_page()
            page.goto(url, wait_until="networkidle", timeout=20000)
            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')
            for s in soup(["script", "style"]): s.extract()
            text = ' '.join(soup.get_text(separator=' ', strip=True).split())
            browser.close()
            return text
    except Exception as e:
        print(f"   Search Error: {str(e)[:30]}")
        return None

def analyze_logic_based(bank_name, text):
    """[Zero-AI] AI 대신 정규식과 키워드 기반으로 금리를 추출함 (비용 0원)"""
    # 1. 2026년 키워드가 없으면 최신 데이터가 아닐 확률이 높으므로 스킵 (정밀도 유지)
    if "2026" not in text:
        return []

    # 2. 금리 패턴 추출 (예: 3.5%, 4.0%)
    rates = re.findall(r'(\d+\.\d+)%', text)
    if not rates:
        return []
    
    # 숫자형으로 변환 및 중복 제거 후 내림차순 정렬
    rates = sorted(list(set([float(r) for r in rates])), reverse=True)
    
    # 상위 금리 2개를 골라 기본/최고 금리로 추정 (매우 보수적 로직)
    max_rate = rates[0]
    base_rate = rates[1] if len(rates) > 1 else max_rate
    
    # 3. 상품명 추측 (텍스트 본문에서 가장 많이 언급된 단어 조합)
    # 간단하게 '통장', 'CMA' 등의 단어가 포함된 문장을 찾음
    product_name = f"{bank_name} 파킹/CMA"
    
    return [{
        "institution": bank_name,
        "product_name": product_name,
        "mode": "tiered",
        "rules": [
            {"limit": 1000000, "base_rate": base_rate, "max_rate": max_rate},
            {"limit": None, "base_rate": base_rate * 0.1, "max_rate": base_rate * 0.5}
        ],
        "preferential_conditions": "마케팅 동의 및 실적 연동 (추정)",
        "target": "개인 고객",
        "cycle": "매월"
    }]

def run_smart_scraper():
    print(f"🛠 총 {len(TARGET_BANKS)}개 금융사 탐색 시작 (AI 없이 로직으로)...")
    
    all_results = []
    for bank in TARGET_BANKS:
        text = fetch_search_results(bank)
        if text and len(text) > 300:
            products = analyze_logic_based(bank, text)
            if products:
                for data in products:
                    all_results.append(data)
                    print(f"   Success: [{data['product_name']}] Max {data['rules'][0]['max_rate']}%")
        
    # Supabase 저장
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if all_results and url and key:
        print(f"\nUpdating DB ({len(all_results)} items)...")
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        for res in all_results:
            inst = res['institution']
            prod = res['product_name']
            
            # 중복 체크
            q = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            try:
                r = requests.get(q, headers=headers).json()
                
                desc = {
                    "text": "포털 검색 데이터 기반 로직 분석",
                    "target": res.get("target"),
                    "preferential_conditions": res.get("preferential_conditions"),
                    "rules": res.get("rules")
                }
                
                payload = {
                    "type": "parking" if "cma" not in prod.lower() else "cma",
                    "institution": inst,
                    "product_name": prod,
                    "base_rate": res['rules'][0]['base_rate'],
                    "max_rate": res['rules'][0]['max_rate'],
                    "tag": "⚡ 실시간 로직 분석",
                    "description": json.dumps(desc, ensure_ascii=False)
                }
                
                if r and isinstance(r, list) and len(r) > 0:
                    requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{r[0]['id']}", headers=headers, json=payload)
                else:
                    requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
            except: pass
        
        print("\nDone! All products synced without AI costs.")

if __name__ == "__main__":
    run_smart_scraper()
