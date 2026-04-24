import os
import json
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import google.generativeai as genai
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# Gemini API 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY가 환경 변수에 설정되지 않았습니다.")

genai.configure(api_key=GEMINI_API_KEY)

# 동적으로 사용 가능한 최신 모델 검색 및 자동 선택 (2026년 최신 모델 호환성 확보)
selected_model_name = None
print("🔍 사용 가능한 Gemini AI 모델을 검색 중...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            if 'flash' in m.name:
                selected_model_name = m.name
                break
            elif 'pro' in m.name and not selected_model_name:
                selected_model_name = m.name
except Exception as e:
    print(f"⚠️ 모델 목록 조회 실패: {e}")

if not selected_model_name:
    selected_model_name = 'gemini-pro'

print(f"🤖 최종 선택된 AI 모델: {selected_model_name}")
model = genai.GenerativeModel(selected_model_name)

# 분석할 금융 상품 URL 리스트
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
    """실제 브라우저(Playwright)를 사용해 페이지 렌더링 후 텍스트 추출"""
    print(f"-> [{url}] 브라우저 기동 중...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
            # 페이지 이동
            response = page.goto(url, wait_until="networkidle", timeout=60000)
            if not response or response.status != 200:
                print(f"⚠️ [{url}] 접근 실패 (HTTP {response.status if response else 'Unknown'})")
                browser.close()
                return None
                
            page.wait_for_timeout(3000) # JS 실행 대기
            
            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')
            for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                script.extract()
            
            text = soup.get_text(separator=' ', strip=True)
            text = ' '.join(text.split())
            
            print(f"✅ [{url}] 텍스트 추출 성공 ({len(text)} 자)")
            browser.close()
            return text
    except Exception as e:
        print(f"❌ [{url}] 브라우저 제어 오류: {e}")
        return None

def analyze_with_gemini(institution, product_name, text_content):
    """Gemini를 사용해 복잡한 금리 구간 추출"""
    text_snippet = text_content[:15000] # 좀 더 길게
    
    prompt = f"""
다음은 {institution}의 '{product_name}' 관련 페이지에서 추출한 텍스트야.
이 텍스트를 읽고, 파킹통장 계산기에 필요한 '금액 구간별 최고 금리(우대금리 포함)' 정보를 추출해줘.

[지시사항]
1. 결과는 반드시 JSON 형식으로만 출력해.
2. 'rules' 배열은 한도가 낮은 순서대로 정렬해.
3. 'limit'은 구간 상한액(원), 무제한이면 null.
4. 'rate'는 해당 구간의 최고 이율(%).
5. 'rating'은 은행 신용등급, 'cycle'은 이자지급 주기. 없으면 null.
6. 'target'은 이 상품이 어떤 사람에게 가장 추천되는지 20자 내외 코멘트.
7. 'product_name'은 텍스트에서 찾은 정확한 상품명을 적어줘.

[텍스트 데이터]
{text_snippet}
"""
    try:
        response = model.generate_content(prompt)
        raw_json = response.text.replace('```json', '').replace('```', '').strip()
        parsed_data = json.loads(raw_json)
        return parsed_data
    except Exception as e:
        print(f"[{product_name}] Gemini 분석 실패: {e}")
        return None

def run_smart_scraper():
    print("🤖 지능형 금리 분석 스크래퍼 실행 중...")
    results = []
    
    for target in TARGET_URLS:
        print(f"-> [{target['institution']}] {target['product_name']} 분석 시작...")
        text = fetch_page_text(target['url'])
        
        if text:
            print(f"-> Gemini로 금리 구조 분석 중...")
            parsed_data = analyze_with_gemini(target['institution'], target['product_name'], text)
            if parsed_data:
                # 은행명 보강 (AI가 누락할 경우 대비)
                if not parsed_data.get("institution"):
                    parsed_data["institution"] = target['institution']
                if not parsed_data.get("product_name"):
                    parsed_data["product_name"] = target['product_name']
                results.append(parsed_data)
                print(f"✅ 분석 완료: {parsed_data['product_name']}")
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if results and url and key:
        print("\n💾 Supabase에 데이터 저장 중...")
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        
        for res in results:
            inst = res.get("institution")
            prod = res.get("product_name") or res.get("productName")
            
            if not inst or not prod:
                print(f"⚠️ 필수 정보 누락으로 스킵합니다.")
                continue
                
            query_url = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            check_res = requests.get(query_url, headers=headers)
            existing_records = check_res.json()
            
            description_json = {
                "text": res.get("description", {}).get("text", "") if isinstance(res.get("description"), dict) else str(res.get("description")),
                "target": res.get("target", ""),
                "rating": res.get("rating"),
                "cycle": res.get("cycle"),
                "rules": res.get("rules", [])
            }
            
            # AI 분석 결과가 너무 부실하면(rules가 비어있으면) 업데이트하지 않음
            if not res.get("rules") or len(res.get("rules")) == 0:
                print(f"⚠️ [{prod}] 유효한 금리 정보를 찾지 못해 업데이트를 건너뜁니다.")
                continue

            payload = {
                "type": "parking" if "cma" not in prod.lower() else "cma",
                "institution": inst,
                "product_name": prod,
                "max_rate": res.get("max_rate") or (res.get("rules")[0].get("rate") if res.get("rules") else 0),
                "tag": "🤖 AI 실시간",
                "description": json.dumps(description_json, ensure_ascii=False)
            }
            
            if existing_records:
                record_id = existing_records[0]['id']
                print(f"-> [{prod}] 업데이트 중...")
                requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{record_id}", headers=headers, json=payload)
            else:
                print(f"-> [{prod}] 신규 추가 중...")
                requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
                
        print(f"✅ DB 스마트 동기화 완료!")
            
    print(f"\n🎉 모든 처리를 마쳤습니다.")

if __name__ == "__main__":
    run_smart_scraper()
