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

print("🚀 [궁극의 검색 기반 스크래퍼] 기동 중...")

# Gemini API 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

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

print(f"🤖 AI 모델: {selected_model_name}")
model = genai.GenerativeModel(selected_model_name)

# 💡 이제 복잡한 URL은 필요 없습니다! 타겟 은행 이름만 관리하면 됩니다.
TARGET_BANKS = [
    "OK저축은행",
    "다올저축은행",
    "애큐온저축은행",
    "토스뱅크",
    "케이뱅크",
    "한국투자증권",
    "KB증권"
]

def fetch_search_results(bank_name):
    """은행 사이트 대신 네이버 검색 결과를 긁어오는 혁신적인 방식"""
    # 파킹통장과 CMA를 모두 포괄하는 검색어
    query = urllib.parse.quote(f"{bank_name} 파킹통장 금리 최신")
    if "증권" in bank_name:
        query = urllib.parse.quote(f"{bank_name} CMA 금리 최신")
        
    url = f"https://search.naver.com/search.naver?where=nexearch&query={query}"
    
    print(f"🔍 [{bank_name}] 포털 검색 중...")
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
            print(f"   ✅ 검색 데이터 확보: {len(text)} 자")
            browser.close()
            return text
    except Exception as e:
        print(f"   ❌ 검색 오류: {str(e)[:50]}")
        return None

def analyze_with_gemini(bank_name, text):
    try:
        prompt = f"""
        다음은 네이버에 '{bank_name}'의 주력 예치금 상품(파킹통장 또는 CMA)을 검색한 최신 결과야.
        검색 결과를 바탕으로 현재 이 은행의 **가장 대표적인 파킹통장(또는 CMA) 상품명**과 **금액 구간별 최고 금리(우대금리 포함)**를 찾아내서 JSON으로 출력해.
        
        [지시사항]
        1. 형식: {{"institution": "{bank_name}", "product_name": "찾아낸상품명", "max_rate": 0.0, "rules": [{{"limit": 500000, "rate": 7.0}}, ...], "target": "어떤 사람에게 좋은지 코멘트", "rating": "신용등급(있으면)", "cycle": "이자지급주기(예: 매일, 매월)"}}
        2. rules 배열은 한도(limit)가 낮은 순서로 정렬해 (무제한 한도는 limit: null).
        3. 과거 데이터가 섞여 있을 수 있으니, 텍스트 문맥상 가장 '최신'으로 보이는 금리 정보를 우선 채택해.
        
        텍스트: {text[:20000]}
        """
        response = model.generate_content(prompt)
        raw = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(raw)
    except Exception as e:
        print(f"   ❌ AI 분석 실패: {e}")
        return None

def run_smart_scraper():
    print(f"🛠 총 {len(TARGET_BANKS)}개 금융사 자동 탐색 시작...")
    results = []
    
    for bank in TARGET_BANKS:
        text = fetch_search_results(bank)
        if text and len(text) > 500:
            print(f"   -> AI가 신상품 및 금리 분석 중...")
            data = analyze_with_gemini(bank, text)
            if data and data.get("rules"):
                data["institution"] = bank # 은행명은 강제 보정
                results.append(data)
                print(f"   ✨ 탐색 성공: [{data['product_name']}] 최고 {data['rules'][0]['rate']}%")
        else:
            print("   ⚠️ 검색 결과 부족으로 스킵")

    # DB 저장 (Supabase)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if results and url and key:
        print(f"\n💾 DB 업데이트 ({len(results)}건)...")
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        for res in results:
            inst = res['institution']
            prod = res['product_name']
            
            # 기존 동일 상품명 있는지 체크 (있으면 업데이트, 없으면 신규로 뜸!)
            q = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            r = requests.get(q, headers=headers).json()
            
            desc = {
                "text": f"포털 검색 자동 분석: {res.get('target', '')}",
                "target": res.get("target", ""),
                "rating": res.get("rating"),
                "cycle": res.get("cycle"),
                "rules": res.get("rules", [])
            }
            
            payload = {
                "type": "parking" if "cma" not in prod.lower() else "cma",
                "institution": inst,
                "product_name": prod,
                "max_rate": res.get("max_rate") or res.get("rules")[0]['rate'],
                "tag": "🤖 AI 실시간 탐색",
                "description": json.dumps(desc, ensure_ascii=False)
            }
            
            if r:
                requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{r[0]['id']}", headers=headers, json=payload)
            else:
                requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
        print("✅ DB 동기화 완료! 진정한 의미의 완전 자동화가 적용되었습니다.")

if __name__ == "__main__":
    run_smart_scraper()
