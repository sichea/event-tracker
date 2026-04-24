import os
import json
import requests
from bs4 import BeautifulSoup
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
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        # 가성비/속도가 좋은 flash 모델을 최우선으로 찾고, 없으면 pro나 일반 모델 선택
        if 'flash' in m.name:
            selected_model_name = m.name
            break
        elif 'pro' in m.name and not selected_model_name:
            selected_model_name = m.name

if not selected_model_name:
    selected_model_name = 'gemini-pro' # 기본값 폴백

print(f"🤖 최종 선택된 AI 모델: {selected_model_name}")
model = genai.GenerativeModel(selected_model_name)

# 분석할 금융 상품 URL 리스트 (각 금융사 예금 공시/상품 안내 페이지)
TARGET_URLS = [
    # 저축은행 (고금리 파킹통장 주력)
    { "institution": "OK저축은행", "product_name": "OK짠테크/파킹플렉스", "url": "https://m.oksavingsbank.com/m/goods/DpstGoodList.do" },
    { "institution": "다올저축은행", "product_name": "Fi 쌈짓돈", "url": "https://www.daolsb.com/fi/deposit/depositInfo.do" },
    { "institution": "애큐온저축은행", "product_name": "머니모으기", "url": "https://www.acuonsb.co.kr/HP11010000.do" },
    
    # 인터넷전문은행 (앱 기반이지만 공시 페이지 존재)
    { "institution": "토스뱅크", "product_name": "나눠모으기/토스뱅크통장", "url": "https://www.tossbank.com/product-service/savings/account" },
    { "institution": "케이뱅크", "product_name": "플러스박스", "url": "https://www.kbanknow.com/ib20/mnu/FDP0000000" },
    
    # 증권사 CMA
    { "institution": "한국투자증권", "product_name": "CMA 발행어음형", "url": "https://www.truefriend.com/main/finance/cma/CMA.jsp" },
    { "institution": "KB증권", "product_name": "my CMA", "url": "https://www.kbsec.com/go.able?realId=01010100" }
]

def fetch_page_text(url):
    """URL에서 순수 텍스트만 추출 (차단 방지 로직 강화)"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Upgrade-Insecure-Requests": "1"
        }
        response = requests.get(url, headers=headers, timeout=15)
        print(f"-> [{url}] 응답 코드: {response.status_code}, 데이터 크기: {len(response.text)} bytes")
        
        if response.status_code != 200:
            print(f"⚠️ [{url}] 접근 실패 (HTTP {response.status_code})")
            return None
            
        # 차단 여부 확인 (너무 짧거나 특정 키워드가 있는 경우)
        if len(response.text) < 1000:
            print(f"⚠️ [{url}] 데이터가 너무 적습니다. 차단되었을 가능성이 있습니다. (텍스트 일부: {response.text[:100]}...)")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        # 불필요한 공백 제거
        text = ' '.join(text.split())
        return text
    except Exception as e:
        print(f"❌ [{url}] 오류 발생: {e}")
        return None

def analyze_with_gemini(institution, product_name, text_content):
    """Gemini를 사용해 복잡한 금리 구간 추출"""
    
    # 텍스트가 너무 길면 잘라서 전달 (Gemini Flash는 길어도 되지만 비용/속도 고려)
    text_snippet = text_content[:10000]
    
    prompt = f"""
다음은 {institution}의 '{product_name}' 관련 페이지에서 추출한 텍스트야.
이 텍스트를 읽고, 파킹통장 계산기에 필요한 '금액 구간별 최고 금리(우대금리 포함)' 정보를 추출해줘.

[지시사항]
1. 결과는 반드시 JSON 형식으로만 출력해. (코드 블록 없이)
2. 'rules' 배열은 한도가 낮은 순서대로 정렬해. (예: 50만, 500만, 무제한 순)
3. 'limit'은 구간 상한액(원), 무제한이면 null.
4. 'rate'는 해당 구간의 최고 이율(%).
5. 'rating'은 은행 신용등급(AAA, A 등), 'cycle'은 이자지급 주기(매월, 매일 등). 없으면 null.
6. 'target'은 이 상품이 어떤 사람에게 가장 추천되는지 20자 내외로 적어줘.

[텍스트 데이터]
{text_snippet}
"""
    try:
        response = model.generate_content(prompt)
        # Markdown 코드 블록(```json ... ```)을 제거
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
        print(f"-> [{target['institution']}] {target['product_name']} 텍스트 추출 중...")
        text = fetch_page_text(target['url'])
        
        if text:
            print(f"-> Gemini로 금리 구조 분석 중...")
            parsed_data = analyze_with_gemini(target['institution'], target['product_name'], text)
            if parsed_data:
                results.append(parsed_data)
                print(f"✅ 분석 완료: {json.dumps(parsed_data, ensure_ascii=False)[:100]}...")
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if results and url and key:
        print("\n💾 Supabase에 데이터 저장 중...")
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        
        # 분석 결과를 DB에 스마트하게 동기화 (Upsert 방식)
        for res in results:
            # 1. 기존에 동일한 은행/상품이 있는지 확인
            inst = res.get("institution")
            prod = res.get("product_name")
            query_url = f"{url}/rest/v1/parking_rates?institution=eq.{inst}&product_name=eq.{prod}&select=id"
            check_res = requests.get(query_url, headers=headers)
            existing_records = check_res.json()
            
            # description JSON 구성
            description_json = {
                "text": res.get("description", {}).get("text", ""),
                "target": res.get("description", {}).get("target", ""),
                "rating": res.get("description", {}).get("rating"),
                "cycle": res.get("description", {}).get("cycle"),
                "rules": res.get("description", {}).get("rules", [])
            }
            
            payload = {
                "type": "parking" if "cma" not in prod.lower() else "cma", # 상품명에 cma가 있으면 cma로 분류
                "institution": inst,
                "product_name": prod,
                "max_rate": res.get("max_rate"),
                "tag": "🤖 AI 실시간",
                "description": json.dumps(description_json, ensure_ascii=False)
            }
            
            if existing_records:
                # 기존 데이터가 있으면 업데이트 (PATCH)
                record_id = existing_records[0]['id']
                print(f"-> [{prod}] 기존 데이터 발견 (ID: {record_id}), 최신 AI 정보로 업데이트 중...")
                requests.patch(f"{url}/rest/v1/parking_rates?id=eq.{record_id}", headers=headers, json=payload)
            else:
                # 없으면 신규 삽입 (POST)
                print(f"-> [{prod}] 신규 상품 발견, DB에 추가 중...")
                requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=[payload])
                
        print(f"✅ DB 스마트 동기화 완료!")
            
    print(f"\n🎉 총 {len(results)}건의 상품 분석 및 처리를 마쳤습니다.")

if __name__ == "__main__":
    run_smart_scraper()
