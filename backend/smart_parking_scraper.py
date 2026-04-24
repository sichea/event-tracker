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

print("🚀 [아이프레임 추적 버전] 지능형 스크래퍼 기동...")

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

# 분석 대상 URL
TARGET_URLS = [
    { "institution": "OK저축은행", "product_name": "OK짠테크/파킹플렉스", "url": "https://www.oksavingsbank.com/product/deposit/interest/731" },
    { "institution": "다올저축은행", "product_name": "Fi 쌈짓돈", "url": "https://m.daolsb.com/deposit/goods.do?gds_cd=DC215" },
    { "institution": "애큐온저축은행", "product_name": "머니모으기", "url": "https://www.acuonsb.co.kr/product/deposit/list/moneyGathering" },
    { "institution": "토스뱅크", "product_name": "나눠모으기/토스뱅크통장", "url": "https://www.tossbank.com/product-service/savings/account" },
    { "institution": "케이뱅크", "product_name": "플러스박스", "url": "https://www.kbanknow.com/ib20/mnu/FDP0000000" },
    { "institution": "한국투자증권", "product_name": "CMA 발행어음형", "url": "https://www.truefriend.com/main/customer/guide/CMA.jsp" },
    { "institution": "KB증권", "product_name": "my CMA", "url": "https://www.kbsec.com/go.able?realId=01010100" }
]

def get_clean_text(html):
    soup = BeautifulSoup(html, 'html.parser')
    for s in soup(["script", "style", "header", "footer", "nav", "aside"]):
        s.extract()
    return ' '.join(soup.get_text(separator=' ', strip=True).split())

def fetch_page_text(url):
    print(f"🔍 [{url}] 분석 중...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
            page = context.new_page()
            
            page.goto(url, wait_until="load", timeout=90000)
            time.sleep(7) # 넉넉한 대기
            
            # 모든 텍스트 수집 (메인 페이지 + 모든 아이프레임)
            full_text = get_clean_text(page.content())
            
            # 아이프레임 추적 및 텍스트 합치기
            for frame in page.frames:
                try:
                    if frame.url and "http" in frame.url:
                        frame_text = get_clean_text(frame.content())
                        if len(frame_text) > 100:
                            full_text += " " + frame_text
                except:
                    continue
            
            print(f"   ✅ 추출 성공: {len(full_text)} 자 확보")
            browser.close()
            return full_text
    except Exception as e:
        print(f"   ❌ 오류: {str(e)[:50]}")
        return None

def analyze_with_gemini(institution, product_name, text):
    try:
        prompt = f"""
        다음 텍스트에서 {institution} {product_name}의 '금액 구간별 최고 금리' 정보를 JSON으로만 추출해.
        예: {{"rules": [{{"limit": 500000, "rate": 7.0}}, {{"limit": null, "rate": 1.0}}], "target": "코멘트", "rating": "등급", "cycle": "주기"}}
        텍스트: {text[:20000]}
        """
        response = model.generate_content(prompt)
        raw = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(raw)
    except:
        return None

def run_smart_scraper():
    print(f"🛠 총 {len(TARGET_URLS)}개 상품 순찰...")
    results = []
    
    for target in TARGET_URLS:
        text = fetch_page_text(target['url'])
        if text and len(text) > 300:
            print(f"   -> AI 분석 중...")
            data = analyze_with_gemini(target['institution'], target['product_name'], text)
            if data and data.get("rules"):
                data["institution"] = target['institution']
                data["product_name"] = target['product_name']
                results.append(data)
                print(f"   ✨ 분석 성공: {data['product_name']} (금리: {data['rules'][0]['rate']}%)")
        else:
            print("   ⚠️ 정보 부족으로 스킵")

    # DB 저장 (Supabase)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if results and url and key:
        print(f"\n💾 DB 업데이트 ({len(results)}건)...")
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        for res in results:
            inst = res['institution']
            prod = res['product_name']
            
            q = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            r = requests.get(q, headers=headers).json()
            
            desc = {
                "text": res.get("target", "최근 AI 분석 완료"),
                "target": res.get("target", ""),
                "rating": res.get("rating"),
                "cycle": res.get("cycle"),
                "rules": res.get("rules", [])
            }
            
            payload = {
                "type": "parking" if "cma" not in prod.lower() else "cma",
                "institution": inst,
                "product_name": prod,
                "max_rate": res.get("rules")[0]['rate'] if res.get("rules") else 0,
                "tag": "🤖 AI 실시간",
                "description": json.dumps(desc, ensure_ascii=False)
            }
            
            if r:
                requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{r[0]['id']}", headers=headers, json=payload)
            else:
                requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
        print("✅ DB 동기화 완료!")

if __name__ == "__main__":
    run_smart_scraper()
