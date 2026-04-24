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
# 최신 모델 사용 (비용 저렴, 성능 우수)
model = genai.GenerativeModel('gemini-1.5-flash')

# 분석할 금융 상품 URL 리스트 (각 금융사 예금 공시/상품 안내 페이지)
TARGET_URLS = [
    # 저축은행 (고금리 파킹통장 주력)
    { "institution": "OK저축은행", "product_name": "OK짠테크/파킹플렉스", "url": "https://m.oksavingsbank.com/m/goods/DpstGoodList.do" },
    { "institution": "다올저축은행", "product_name": "Fi 쌈짓돈", "url": "https://www.daolsb.com/fi/deposit/depositInfo.do" },
    { "institution": "애큐온저축은행", "product_name": "머니모으기", "url": "https://www.acuonsb.co.kr/HP11010000.do" },
    { "institution": "DB저축은행", "product_name": "DB행복파킹", "url": "https://www.idbsb.com/deposit/dep_02_01.do" },
    
    # 인터넷전문은행 (앱 기반이지만 공시 페이지 존재)
    { "institution": "토스뱅크", "product_name": "나눠모으기/토스뱅크통장", "url": "https://www.tossbank.com/product-service/savings/account" },
    { "institution": "케이뱅크", "product_name": "플러스박스", "url": "https://www.kbanknow.com/ib20/mnu/FDP0000000" },
    { "institution": "카카오뱅크", "product_name": "세이프박스", "url": "https://www.kakaobank.com/products/safebox" },
    
    # 증권사 CMA
    { "institution": "한국투자증권", "product_name": "CMA 발행어음형", "url": "https://www.truefriend.com/main/finance/cma/CMA.jsp" },
    { "institution": "미래에셋증권", "product_name": "CMA-RP형", "url": "https://securities.miraeasset.com/hki/hki3028/n01.do" },
    { "institution": "KB증권", "product_name": "my CMA", "url": "https://www.kbsec.com/go.able?realId=01010100" }
]

def fetch_page_text(url):
    """URL에서 순수 텍스트만 추출"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # 불필요한 태그 제거 (스크립트, 스타일)
        for script in soup(["script", "style", "nav", "footer"]):
            script.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        return text
    except Exception as e:
        print(f"[{url}] 페이지 가져오기 실패: {e}")
        return None

def analyze_with_gemini(institution, product_name, text_content):
    """Gemini를 사용해 복잡한 금리 구간 추출"""
    
    prompt = f"""
다음은 {institution}의 '{product_name}' 상품 설명 페이지 텍스트야.
이 텍스트를 읽고, 파킹통장 계산기에 필요한 '금액 구간별 이율표'를 추출해줘.

[지시사항]
1. 최고 금리(우대금리 포함) 기준으로 계산해.
2. 결과는 반드시 아래 JSON 형식으로만 출력해. (다른 설명은 절대 쓰지 마)
3. 'rules' 배열의 객체는 한도 금액이 낮은 순서부터 정렬해.
4. 'limit'은 해당 구간의 최대 금액(원)이야. 무제한이면 null로 해.
5. 'rate'는 해당 구간의 금리(%)야.

[출력 JSON 예시]
{{
  "institution": "{institution}",
  "product_name": "{product_name}",
  "max_rate": 7.0,
  "description": {{
    "text": "50만원 이하 연 7.0%, 500만원 이하 0.8%, 초과분 0.1%",
    "target": "어떤 사람에게 추천하는지 한 줄 코멘트",
    "rating": "BBB+", // 페이지에 없으면 null
    "cycle": "매월", // 이자 지급 주기 (예: 매월, 매일)
    "rules": [
      {{"limit": 500000, "rate": 7.0}},
      {{"limit": 5000000, "rate": 0.8}},
      {{"limit": null, "rate": 0.1}}
    ]
  }}
}}

[분석할 텍스트]
{text_content[:8000]} # 토큰 절약을 위해 앞부분만 사용 (보통 요약 정보는 상단에 있음)
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
