import os
import json
import requests
import urllib.parse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import google.generativeai as genai
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

print("[Parking Scraper] Starting...")

# Gemini API 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set.")

genai.configure(api_key=GEMINI_API_KEY)

# 동적 모델 선택
selected_model_name = None
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            if 'flash' in m.name:
                selected_model_name = m.name
                break
            elif 'pro' in m.name and not selected_model_name:
                selected_model_name = m.name
except:
    pass

if not selected_model_name:
    selected_model_name = 'gemini-pro'

print(f"AI Model: {selected_model_name}")
model = genai.GenerativeModel(selected_model_name)

# 💡 이제 복잡한 URL은 필요 없습니다! 타겟 금융사를 대폭 확장했습니다.
TARGET_BANKS = [
    "OK저축은행", "다올저축은행", "애큐온저축은행", "하나저축은행", "DB저축은행",
    "제주은행", "전북은행", "BNK저축은행", "고려저축은행",
    "토스뱅크", "케이뱅크", "카카오뱅크",
    "한국투자증권", "미래에셋증권", "우리종합금융", "현대차증권", "KB증권", "NH투자증권", "삼성증권"
]

def fetch_search_results(bank_name):
    """은행 사이트 대신 네이버 검색 결과를 긁어오는 혁신적인 방식"""
    # 파킹통장과 CMA를 모두 포괄하는 검색어
    query = urllib.parse.quote(f"{bank_name} 파킹통장 CMA 금리 최신")
    url = f"https://search.naver.com/search.naver?where=nexearch&query={query}"
    
    print(f"Searching: [{bank_name}] ...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
            page = context.new_page()
            
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # 검색 결과 텍스트 추출 (뉴스, 블로그, 공식 사이트 정보 포함)
            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # 불필요한 요소 제거
            for s in soup(["script", "style", "header", "footer", "nav"]):
                s.extract()
                
            text = ' '.join(soup.get_text(separator=' ', strip=True).split())
            print(f"   Data length: {len(text)}")
            browser.close()
            return text
    except Exception as e:
        print(f"   Search Error: {str(e)[:50]}")
        return None

def analyze_with_gemini(bank_name, text):
    try:
        prompt = f"""
        다음은 네이버에 '{bank_name}'의 예치금 상품(파킹통장, CMA)을 검색한 최신 결과야.
        검색 결과를 바탕으로 이 금융사의 **모든 경쟁력 있는 파킹통장 및 CMA 상품들**을 찾아내서 JSON 리스트로 출력해.
        (하나의 은행에 여러 상품이 있다면 모두 포함시켜야 함)
        
        [지시사항]
        1. 형식: [
             {{"institution": "{bank_name}", "product_name": "상품명1", "max_rate": 0.0, "rules": [{{"limit": 500000, "rate": 7.0}}, ...], "target": "코멘트", "rating": "등급", "cycle": "주기"}},
             ...
           ]
        2. rules 배열은 한도(limit)가 낮은 순서로 정렬해 (무제한 한도는 limit: null).
        3. 과거 데이터가 섞여 있을 수 있으니, 텍스트 문맥상 가장 '최신'으로 보이는 정보를 우선 채택해.
        4. 상품이 하나도 없으면 빈 리스트 []를 출력해.
        
        텍스트: {text[:20000]}
        """
        response = model.generate_content(prompt)
        raw = response.text.replace('```json', '').replace('```', '').strip()
        # 리스트 형태인지 확인 후 반환
        data = json.loads(raw)
        return data if isinstance(data, list) else [data]
    except Exception as e:
        print(f"   AI Analysis Error: {e}")
        return []

def discover_new_targets():
    """랭킹 및 뉴스 검색을 통해 신규 상품이나 금융사를 발굴하는 탐색 단계"""
    query = urllib.parse.quote("2024년 최신 파킹통장 순위 추천 신상품")
    url = f"https://search.naver.com/search.naver?where=nexearch&query={query}"
    
    print("🌐 [신상품 발굴] 최신 금융 랭킹 탐색 중...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
            page = context.new_page()
            page.goto(url, wait_until="networkidle", timeout=30000)
            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')
            text = ' '.join(soup.get_text(separator=' ', strip=True).split())
            browser.close()
            
            prompt = f"""
            다음은 최근 파킹통장 금리 비교 및 랭킹 검색 결과야.
            여기서 언급된 **모든 금융사(은행, 저축은행, 증권사)** 이름을 추출해줘.
            
            지시사항:
            1. 형식: ["은행이름1", "은행이름2", ...]
            2. 기존 리스트({TARGET_BANKS})에 없는 새로운 곳이 있다면 반드시 포함해.
            3. 순수하게 이름만 리스트로 출력해.
            
            텍스트: {text[:15000]}
            """
            response = model.generate_content(prompt)
            new_banks = json.loads(response.text.replace('```json', '').replace('```', '').strip())
            return list(set(TARGET_BANKS + new_banks))
    except Exception as e:
        print(f"   Discovery Error: {e}")
        return TARGET_BANKS

def run_smart_scraper():
    # 1단계: 신규 타겟 발굴 (동적 확장)
    dynamic_targets = discover_new_targets()
    print(f"🛠 총 {len(dynamic_targets)}개 금융사(신규 포함) 탐색 시작...")
    
    all_results = []
    for bank in dynamic_targets:
        text = fetch_search_results(bank)
        if text and len(text) > 500:
            print(f"   Analyzing [{bank}] with AI...")
            products = analyze_with_gemini(bank, text)
            if products:
                for data in products:
                    if data.get("rules"):
                        data["institution"] = bank
                        all_results.append(data)
                        print(f"   Success: [{data['product_name']}] Max {data['rules'][0]['rate']}%")
        else:
            print(f"   Skipping [{bank}] due to lack of data")

    # DB 저장 (Supabase)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if all_results and url and key:
        print(f"\nUpdating DB ({len(all_results)} items)...")
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        for res in all_results:
            inst = res['institution']
            prod = res['product_name']
            
            q = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            r = requests.get(q, headers=headers).json()
            
            desc = {
                "text": f"포털 검색 자동 분석: {res.get('target', '')}",
                "target": res.get("target", ""),
                "rating": res.get("rating"),
                "cycle": res.get("cycle"),
                "rules": res.get("rules", [])
            }
            
            rates = [rule['rate'] for rule in res.get('rules', [])]
            max_rate = max(rates) if rates else (res.get('max_rate') or 0.0)
            
            payload = {
                "type": "parking" if "cma" not in prod.lower() else "cma",
                "institution": inst,
                "product_name": prod,
                "max_rate": max_rate,
                "tag": "🤖 AI 실시간 탐색",
                "description": json.dumps(desc, ensure_ascii=False)
            }
            
            if r:
                requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{r[0]['id']}", headers=headers, json=payload)
            else:
                requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
        print("Done! Sync completed for all discovered products.")

if __name__ == "__main__":
    run_smart_scraper()
