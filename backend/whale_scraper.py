import os
import requests
import datetime
import json
import httpx
import sys
import io
import google.generativeai as genai
from dotenv import load_dotenv

# Windows 터미널 한글/이모지 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

print("[Whale Scraper] Starting with AI power...")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
DART_API_KEY = os.environ.get("DART_API_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

# Gemini 설정
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')

def supabase_upsert(data):
    """Supabase REST API로 직접 upsert (whale_insights 테이블)"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("[!] Supabase 환경 변수가 없습니다. 로컬 파일만 저장합니다.")
        return False
        
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
    url = f"{SUPABASE_URL}/rest/v1/whale_insights"
    
    # payload: {id: 'current', ...data, updated_at: now}
    payload = {
        "id": "current",
        "dart": data.get("dart", []),
        "nps": data.get("nps", []),
        "legends": data.get("legends", []),
        "updated_at": datetime.datetime.now().isoformat()
    }
    
    try:
        with httpx.Client() as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code >= 400:
                print(f"[X] Supabase 오류: {resp.status_code} - {resp.text}")
                return False
            print("[V] Supabase 저장 완료")
            return True
    except Exception as e:
        print(f"[X] Supabase 접속 실패: {e}")
        return False

def extract_shares_from_ai(rcept_no, corp_name, filer):
    """상세 API가 데이터를 주지 않을 때, 보고서 원문을 AI가 분석하여 수량을 추출합니다."""
    if not GEMINI_API_KEY: return None
    
    # 1. 문서 XML 가져오기
    doc_url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_API_KEY}&rcept_no={rcept_no}"
    try:
        import zipfile
        import io
        import xml.etree.ElementTree as ET
        
        r = requests.get(doc_url)
        if r.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                # 첫 번째 XML 파일 읽기
                xml_name = z.namelist()[0]
                with z.open(xml_name) as f:
                    xml_content = f.read().decode('utf-8', errors='ignore')
                    
                    # AI에게 분석 요청 (너무 길면 자름)
                    snippet = xml_content[:20000] # 앞부분에 보통 핵심 수량이 나옴
                    prompt = f"""
                    다음은 {corp_name}의 공시 보고서(XML) 일부입니다. 
                    보고자 {filer}의 '이번 변동 수량(증감)'과 '변동 후 보유 수량'을 찾아서 JSON으로만 대답하세요.
                    양수면 매수, 음수면 매도입니다.
                    {{ "change_shares": 숫자, "total_shares": 숫자 }}
                    보고서 본문:
                    {snippet}
                    """
                    
                    # REST API 호출
                    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
                    payload = { "contents": [{ "parts": [{"text": prompt}] }] }
                    
                    with httpx.Client(timeout=30.0) as client:
                        resp = client.post(api_url, json=payload)
                        if resp.status_code == 200:
                            result = resp.json()
                            text = result['candidates'][0]['content']['parts'][0]['text']
                            text = text.replace('```json', '').replace('```', '').strip()
                            data = json.loads(text)
                            v = int(data.get('change_shares', 0))
                            t = int(data.get('total_shares', 0))
                            if v != 0:
                                return {
                                    "change_shares": v,
                                    "total_shares": t,
                                    "change_label": f"{v:+,}주"
                                }
    except Exception as e:
        print(f"Deep Scrape Error: {e}")
    return None

def get_dart_details(corp_code, rcept_no, report_nm, filer_name, corp_name):
    """회사 고유번호와 보고자 이름을 이용해 상세 변동 수량을 가져옵니다."""
    if not DART_API_KEY:
        return None
        
    is_major = "대량보유" in report_nm
    api_type = "majorstock.json" if is_major else "elestock.json"
    
    # 상세 API 시도
    if corp_code:
        url = f"https://opendart.fss.or.kr/api/{api_type}?crtfc_key={DART_API_KEY}&corp_code={corp_code}"
        try:
            r = requests.get(url)
            data = r.json()
            if data.get('status') == '000':
                details = data.get('list', [])
                if details:
                    match = next((d for d in details if d.get('rcept_no') == rcept_no), None)
                    if not match:
                        name_field = 'nm' if not is_major else 'repror'
                        match = next((d for d in details if d.get(name_field) == filer_name), None)
                    
                    if match:
                        vary_field = 'stkqy_vary' if not is_major else 'stkqy_irds'
                        vary_count = match.get(vary_field, '0')
                        total_count = match.get('stkqy_totl', '0')
                        
                        try:
                            v_str = str(vary_count).replace(',', '')
                            t_str = str(total_count).replace(',', '')
                            v_int = int(float(v_str))
                            t_int = int(float(t_str))
                            if v_int != 0:
                                return { "change_shares": v_int, "total_shares": t_int, "change_label": f"{v_int:+,}주" }
                        except: pass
        except: pass

    # 상세 API 실패 시 AI 딥 스캔 시도 (임원/주요주주 거래에 특히 유효)
    print(f"    [!] 상세 API 응답 없음. AI 딥 스캔 가동... ({corp_name})")
    return extract_shares_from_ai(rcept_no, corp_name, filer_name)

def get_dart_data():
    if not DART_API_KEY:
        print("[!] No DART_API_KEY found. Skipping DART scrape.")
        return []
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    start = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    url = f'https://opendart.fss.or.kr/api/list.json?crtfc_key={DART_API_KEY}&bgn_de={start}&end_de={today}&pblntf_ty=D'
    try:
        r = requests.get(url)
        data = r.json()
        items = data.get('list', [])
        
        if not items:
            return []
            
        formatted_items = []
        print(f"[*] Analyzing {len(items[:20])} recent reports...")
        
        for i in items[:20]:
            report_nm = i.get('report_nm', '')
            if any(kw in report_nm for kw in ["임원", "주요주주", "대량보유"]):
                rcept_no = i.get('rcept_no')
                corp_code = i.get('corp_code')
                corp_name = i.get('corp_name')
                filer = i.get('flr_nm')
                
                print(f"  > Fetching details for {corp_name} / {filer}...")
                details = get_dart_details(corp_code, rcept_no, report_nm, filer, corp_name)
                
                item_data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm.strip(),
                    "filer": filer,
                    "date": i.get('rcept_dt'),
                    "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"
                }
                if details:
                    print(f"    [V] Found change: {details['change_label']}")
                    item_data.update(details)
                
                formatted_items.append(item_data)
                
        return formatted_items[:10]
    except Exception as e:
        print(f"DART API Error: {e}")
        return []

def get_ai_legends_data():
    """Gemini REST API를 사용하여 글로벌 투자 전설들의 최신 13F 데이터를 리서치"""
    if not GEMINI_API_KEY:
        print("[!] Gemini API Key missing. Using basic fallback.")
        return [
            {"investor": "워런 버핏 (Berkshire)", "corp_name": "Apple", "ticker": "AAPL", "action": "비중축소", "portfolio_pct": 42.9, "reason": "포트폴리오 리스크 관리 및 차익 실현"},
            {"investor": "레이 달리오 (Bridgewater)", "corp_name": "Meta", "ticker": "META", "action": "비중확대", "portfolio_pct": 2.1, "reason": "AI 및 광고 매출 성장성 주목"}
        ]
    
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    prompt = f"""
    당신은 세계적인 투자 분석가입니다. 오늘 날짜({today}) 기준, 최신 13F 공시와 뉴스를 바탕으로 세계적인 투자 전설 5명 이상의 최근 주요 포트폴리오 변화를 분석해 주세요.
    
    대상 투자자: 워런 버핏(Berkshire), 레이 달리오(Bridgewater), 빌 애크먼(Pershing), 마이클 버리(Scion), 켄 그리핀(Citadel) 등.
    
    결과는 반드시 아래의 JSON 형식 배열로만 반환해 주세요 (설명 없이 JSON만):
    [
      {{
        "investor": "투자자 이름 (한글/영문 병기)",
        "corp_name": "최근 가장 눈에 띄는 매매 회사명 (한글)",
        "ticker": "티커 (예: AAPL)",
        "action": "신규매수, 비중확대, 비중축소, 전량매도 중 하나",
        "portfolio_pct": 13F 기준 포트폴리오 내 비중 (숫자),
        "reason": "해당 매매에 대한 직관적인 이유 한 줄 (한글, 친절한 말투)",
        "top_holdings": [
          {{ "name": "보유종목1", "ticker": "티커", "pct": 15.2 }},
          {{ "name": "보유종목2", "ticker": "티커", "pct": 12.1 }},
          {{ "name": "보유종목3", "ticker": "티커", "pct": 8.5 }},
          {{ "name": "보유종목4", "ticker": "티커", "pct": 5.4 }},
          {{ "name": "보유종목5", "ticker": "티커", "pct": 4.2 }}
        ]
      }}
    ]
    
    각 투자자별로 가장 의미 있는 움직임 1개와 함께, 그들이 현재 가장 많이 보유하고 있는 TOP 5 종목 리스트를 정확하게 포함해 주세요.
    """
    
    # REST API 호출 (SDK 문제 회피)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code != 200:
                print(f"[X] Gemini API 오류: {resp.status_code} - {resp.text}")
                return []
            
            result = resp.json()
            text = result['candidates'][0]['content']['parts'][0]['text']
            text = text.replace('```json', '').replace('```', '').strip()
            data = json.loads(text)
            print(f"[V] AI 리서치 완료: {len(data)}개의 전설적 데이터 포착")
            return data
    except Exception as e:
        print(f"[X] AI 리서치 실패: {e}")
        return []

def run_scraper():
    print("1. Fetching DART 5% Rule data...")
    dart_data = get_dart_data()
    
    print("2. Generating NPS Data (Curated)...")
    nps_data = [
        {"corp_name": "삼성전자", "ownership_pct": 7.42, "trend": "유지", "reason": "반도체 사이클 회복 및 HBM 경쟁력", "type": "국내"},
        {"corp_name": "SK하이닉스", "ownership_pct": 7.90, "trend": "비중확대", "reason": "HBM 시장 주도권 및 실적 턴어라운드", "type": "국내"},
        {"corp_name": "현대차", "ownership_pct": 7.35, "trend": "비중확대", "reason": "호실적 지속 및 주주환원 정책 강화", "type": "국내"},
        {"corp_name": "Apple", "ticker": "AAPL", "ownership_pct": 0.85, "trend": "유지", "reason": "아이폰 생태계 기반 안정적 현금 흐름", "type": "해외"},
        {"corp_name": "NVIDIA", "ticker": "NVDA", "ownership_pct": 0.68, "trend": "비중확대", "reason": "AI 가속기 시장 독점적 지위", "type": "해외"}
    ]
    
    print("3. Performing AI Research for Global Legends (13F)...")
    legends_data = get_ai_legends_data()
    
    whale_payload = {
        "dart": dart_data,
        "nps": nps_data,
        "legends": legends_data
    }
    
    print("4. Uploading to Supabase...")
    supabase_upsert(whale_payload)
    
    output_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'data')
    os.makedirs(output_path, exist_ok=True)
    with open(os.path.join(output_path, 'whale.json'), 'w', encoding='utf-8') as f:
        json.dump({**whale_payload, "updated_at": datetime.datetime.now().isoformat()}, f, ensure_ascii=False, indent=2)
        
    print(f"5. Successfully saved to local {output_path}/whale.json")

if __name__ == "__main__":
    run_scraper()
