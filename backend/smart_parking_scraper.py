import os
import json
import requests
import time
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import google.generativeai as genai
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

print("🚀 지능형 스크래퍼 시스템 기동 중...")

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

print(f"🤖 AI 모델 선택 완료: {selected_model_name}")
model = genai.GenerativeModel(selected_model_name)

# 분석 대상 URL
TARGET_URLS = [
    { "institution": "OK저축은행", "product_name": "OK짠테크/파킹플렉스", "url": "https://m.oksavingsbank.com/m/goods/DpstGoodList.do" },
    { "institution": "다올저축은행", "product_name": "Fi 쌈짓돈", "url": "https://www.daolsb.com/fi/deposit/depositInfo.do" },
    { "institution": "애큐온저축은행", "product_name": "머니모으기", "url": "https://www.acuonsb.co.kr/HP11010000.do" },
    { "institution": "토스뱅크", "product_name": "나눠모으기/토스뱅크통장", "url": "https://www.tossbank.com/product-service/savings/account" },
    { "institution": "케이뱅크", "product_name": "플러스박스", "url": "https://www.kbanknow.com/ib20/mnu/FDP0000000" },
    { "institution": "한국투자증권", "product_name": "CMA 발행어음형", "url": "https://www.truefriend.com/main/finance/cma/CMA.jsp" },
    { "institution": "KB증권", "product_name": "my CMA", "url": "https://www.kbsec.com/go.able?realId=01010100" }
]

def fetch_page_text(url):
    print(f"🔍 [{url}] 분석 시작...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
            # 페이지 접속 (타임아웃 넉넉히)
            page.goto(url, wait_until="load", timeout=90000)
            print("   -> 페이지 접속 성공, 렌더링 대기 중...")
            
            # 자바스크립트가 실행되고 데이터가 뜰 때까지 충분히 대기 (10초)
            time.sleep(10)
            
            # 화면 끝까지 스크롤 (숨겨진 내용 로딩용)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(2)
            
            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # 불필요한 요소 제거
            for s in soup(["script", "style", "header", "footer", "nav", "aside"]):
                s.extract()
                
            text = soup.get_text(separator=' ', strip=True)
            text = ' '.join(text.split())
            
            print(f"   ✅ 추출 성공: {len(text)} 자 확보")
            browser.close()
            return text
    except Exception as e:
        print(f"   ❌ 오류 발생: {str(e)[:100]}")
        return None

def analyze_with_gemini(institution, product_name, text):
    try:
        prompt = f"""
        다음은 {institution} {product_name} 페이지의 텍스트야.
        금액 구간별 '최고 금리' 정보를 JSON으로 추출해줘.
        형식: {{"institution": "...", "product_name": "...", "max_rate": 0.0, "rules": [{{"limit": 500000, "rate": 7.0}}, ...], "target": "코멘트", "rating": "등급", "cycle": "주기"}}
        텍스트: {text[:15000]}
        """
        response = model.generate_content(prompt)
        raw = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(raw)
    except:
        return None

def run_smart_scraper():
    print(f"🛠 총 {len(TARGET_URLS)}개의 상품 순찰 시작...")
    results = []
    
    for target in TARGET_URLS:
        text = fetch_page_text(target['url'])
        if text and len(text) > 500: # 최소 500자 이상일 때만 분석
            print(f"   -> AI 분석 중...")
            data = analyze_with_gemini(target['institution'], target['product_name'], text)
            if data and data.get("rules"):
                # 필수 필드 보강
                data["institution"] = data.get("institution") or target['institution']
                data["product_name"] = data.get("product_name") or target['product_name']
                results.append(data)
                print(f"   ✨ 분석 성공: {data['product_name']}")
        else:
            print("   ⚠️ 텍스트 부족으로 분석 스킵")

    # DB 저장
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if results and url and key:
        print(f"\n💾 DB 저장 중 ({len(results)}건)...")
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        for res in results:
            inst = res['institution']
            prod = res['product_name']
            
            # 중복 체크 및 업데이트
            q = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            r = requests.get(q, headers=headers).json()
            
            desc = {
                "text": f"AI 분석 결과: {res.get('target', '')}",
                "target": res.get("target", ""),
                "rating": res.get("rating"),
                "cycle": res.get("cycle"),
                "rules": res.get("rules", [])
            }
            
            payload = {
                "type": "parking" if "cma" not in prod.lower() else "cma",
                "institution": inst,
                "product_name": prod,
                "max_rate": res.get("max_rate") or (res.get("rules")[0]['rate'] if res.get("rules") else 0),
                "tag": "🤖 AI 실시간",
                "description": json.dumps(desc, ensure_ascii=False)
            }
            
            if r:
                requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{r[0]['id']}", headers=headers, json=payload)
            else:
                requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
        print("✅ 모든 데이터 동기화 완료!")

if __name__ == "__main__":
    run_smart_scraper()
