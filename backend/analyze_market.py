"""
시장 인사이트 자동 분석기
- ECOS API: 한국 기준금리
- FRED API: 미국 연방기금금리, CPI, GDP
- 네이버 뉴스 API: 경제 뉴스 수집
- 네이버 ETF API: 실시간 수익률 기반 종목 추천
- 규칙 기반 시나리오 판단 → Supabase 저장
"""
import io
import sys
import os
import json
import datetime
import httpx
import re

from dotenv import load_dotenv

# Windows 터미널 한글/이모지 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 환경 변수 로드
load_dotenv()

# 환경 변수
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
ECOS_API_KEY = os.environ.get("ECOS_API_KEY", "").strip()
FRED_API_KEY = os.environ.get("FRED_API_KEY", "").strip()
NAVER_CLIENT_ID = os.environ.get("NAVER_CLIENT_ID", "").strip()
NAVER_CLIENT_SECRET = os.environ.get("NAVER_CLIENT_SECRET", "").strip()


def supabase_upsert(data):
    """Supabase REST API로 직접 upsert"""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
    url = f"{SUPABASE_URL}/rest/v1/market_insights"
    with httpx.Client() as client:
        resp = client.post(url, headers=headers, json=data)
        if resp.status_code >= 400:
            print(f"❌ Supabase 오류: {resp.status_code} - {resp.text}")
            return False
        print("✅ Supabase 저장 완료")
        return True


def fetch_ecos_rate():
    """한국은행 기준금리 조회 (BOK 웹사이트 크롤링 - ECOS API 장애 대비)"""
    try:
        url = "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643"
        with httpx.Client() as client:
            resp = client.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        
        if resp.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, 'html.parser')
            tds = [td.text.strip() for td in soup.select('tbody tr td')]
            
            # 구조: [년도, 월일, 금리, 년도, 월일, 금리, ...] -> 인덱스 2가 최신 금리, 5가 이전 금리
            if len(tds) >= 6:
                latest = float(tds[2])
                prev = float(tds[5])
                print(f"📊 한국 기준금리 (BOK Web): {latest}% (이전: {prev}%)")
                return latest, prev
    except Exception as e:
        print(f"⚠️ BOK 웹사이트 크롤링 실패: {e}")

    # Fallback: Supabase에서 이전 저장값 가져오기
    print("⚠️ BOK 접속 불가 → 이전 저장값 사용")
    try:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }
        with httpx.Client() as client:
            resp = client.get(
                f"{SUPABASE_URL}/rest/v1/market_insights?id=eq.current",
                headers=headers, timeout=10
            )
            rows = resp.json()
            if rows and rows[0].get("kr_rate") is not None:
                kr = float(rows[0]["kr_rate"])
                kr_prev = float(rows[0].get("kr_rate_prev") or kr)
                print(f"📊 한국 기준금리 (캐시): {kr}% (이전: {kr_prev}%)")
                return kr, kr_prev
    except Exception:
        pass

    return None, None


def fetch_fred_series(series_id):
    """FRED API에서 특정 시리즈의 최신 값 조회"""
    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 6
    }
    try:
        with httpx.Client() as client:
            resp = client.get(url, params=params, timeout=15)
            data = resp.json()

        obs = data.get("observations", [])
        # '.'이 아닌 유효한 값만 필터링
        valid = [o for o in obs if o.get("value") and o["value"] != "."]
        if not valid:
            return None, None

        latest = float(valid[0]["value"])
        prev = float(valid[1]["value"]) if len(valid) >= 2 else latest
        return latest, prev
    except Exception as e:
        print(f"❌ FRED({series_id}) 오류: {e}")
        return None, None


def fetch_fred_data():
    """미국 주요 경제지표 3종 조회"""
    # 연방기금금리
    us_rate, us_rate_prev = fetch_fred_series("FEDFUNDS")
    print(f"📊 미국 기준금리: {us_rate}% (이전: {us_rate_prev}%)")

    # CPI 전년비 변화율 (FRED에서 전년비 직접 제공 시리즈)
    cpi_yoy, _ = fetch_fred_series("CPALTT01USM657N")
    if cpi_yoy is None:
        cpi_yoy = 3.0  # 기본값
    else:
        cpi_yoy = round(cpi_yoy, 1)  # 소수점 1자리로 반올림
    print(f"📊 미국 CPI 전년비: {cpi_yoy}%")

    # GDP 성장률 (분기)
    gdp, _ = fetch_fred_series("A191RL1Q225SBEA")
    if gdp is not None:
        gdp = round(gdp, 1)
    print(f"📊 미국 GDP 성장률: {gdp}%")

    return us_rate, us_rate_prev, cpi_yoy, gdp


def fetch_naver_news():
    """네이버 뉴스 API로 경제 뉴스 수집"""
    keywords = ["거시경제 금리", "한국은행 기준금리", "미국 연준 금리", "인플레이션 물가", "경기침체 전망"]
    all_news = []

    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET
    }

    with httpx.Client() as client:
        for keyword in keywords:
            try:
                resp = client.get(
                    "https://openapi.naver.com/v1/search/news.json",
                    headers=headers,
                    params={"query": keyword, "display": 3, "sort": "date"},
                    timeout=10
                )
                items = resp.json().get("items", [])
                for item in items:
                    # HTML 태그 제거
                    title = re.sub(r'<[^>]+>', '', item.get("title", ""))
                    desc = re.sub(r'<[^>]+>', '', item.get("description", ""))
                    link = item.get("originallink") or item.get("link", "")
                    pub_date = item.get("pubDate", "")

                    all_news.append({
                        "title": title,
                        "description": desc[:120],
                        "link": link,
                        "pubDate": pub_date
                    })
            except Exception as e:
                print(f"⚠️ 뉴스({keyword}) 오류: {e}")

    # 중복 제거 (제목 기준) 후 최신 5건
    seen = set()
    unique_news = []
    for n in all_news:
        if n["title"] not in seen:
            seen.add(n["title"])
            unique_news.append(n)

    result = unique_news[:5]
    print(f"📰 뉴스 {len(result)}건 수집 완료")
    return result


def determine_scenario(kr_rate, kr_rate_prev, us_rate, us_rate_prev, cpi, gdp):
    """지표를 분석하여 현재 시장 상황과 그 이유를 판단합니다."""
    
    # 1. 경기 침체 판단 (GDP 마이너스)
    if gdp is not None and gdp < 0:
        reason = f"미국 GDP 성장률이 {gdp}%로 마이너스를 기록하며 경기 침체 신호가 포착되었습니다. 안전 자산 선호가 강해질 수 있습니다."
        return "recession", reason

    # 2. 인플레이션 심화 판단 (CPI 3.5% 이상)
    if cpi is not None and cpi >= 3.5:
        reason = f"미국 CPI가 {cpi}%로 고물가 상태가 지속되면서 연준의 긴축 기조가 강화될 우려가 있습니다."
        return "inflation", reason

    # 3. 금리 방향 판단
    rate_direction = 0
    kr_desc = ""
    us_desc = ""
    
    if kr_rate is not None and kr_rate_prev is not None:
        diff = kr_rate - kr_rate_prev
        rate_direction += diff
        if diff < 0: kr_desc = f"한국 금리 인하({kr_rate_prev}%→{kr_rate}%)"
        elif diff > 0: kr_desc = f"한국 금리 인상({kr_rate_prev}%→{kr_rate}%)"
        
    if us_rate is not None and us_rate_prev is not None:
        diff = us_rate - us_rate_prev
        rate_direction += diff
        if diff < 0: us_desc = f"미국 금리 인하({us_rate_prev}%→{us_rate}%)"
        elif diff > 0: us_desc = f"미국 금리 인상({us_rate_prev}%→{us_rate}%)"

    if rate_direction < 0:
        reason = f"{kr_desc} {us_desc} 추세에 따라 시장 유동성 확대가 기대되는 '금리 인하' 상황으로 판정했습니다."
        return "rate_cut", reason
    elif rate_direction > 0:
        reason = f"{kr_desc} {us_desc} 기조가 뚜렷하여 투자 심리 위축이 우려되는 '금리 인상' 상황으로 판정했습니다."
        return "rate_hike", reason

    # 4. 금리 변동 없음 → CPI로 2차 판단
    if cpi is not None:
        if cpi >= 2.5:
            reason = f"금리는 동결되었으나 CPI가 {cpi}%로 다소 높아 '인플레이션 경계' 상황으로 판정했습니다."
            return "inflation", reason
        else:
            reason = f"금리가 안정적이고 물가({cpi}%)도 낮아 투자에 우호적인 환경이 지속되고 있습니다."
            return "rate_cut", reason

    return "rate_cut", "현재 주요 지표들이 안정적인 흐름을 보이고 있어 금리 인하(완화) 기조를 유지합니다."


def fetch_naver_etf_data():
    """네이버 금융에서 전 종목 ETF 데이터를 가져옵니다."""
    url = "https://finance.naver.com/api/sise/etfItemList.nhn"
    try:
        with httpx.Client() as client:
            resp = client.get(url, timeout=15)
            # 네이버 API는 EUC-KR 인코딩을 사용함
            content = resp.content.decode('euc-kr', errors='ignore')
            data = json.loads(content)
        return data.get("result", {}).get("etfItemList", [])
    except Exception as e:
        print(f"❌ 네이버 ETF API 오류: {e}")
        return []


def get_dynamic_assets(scenario, all_etfs):
    """현재 시나리오와 연관된 카테고리별 수익률 TOP 3 종목을 추출합니다."""
    
    # 시나리오별 키워드 정의
    SCENARIO_CONFIG = {
        "rate_cut": [
            {"category": "미국 성장주", "keywords": ["나스닥", "테크", "반도체"], "exclude": ["인버스", "2X"]},
            {"category": "장기 국채", "keywords": ["미국채", "30년"], "exclude": ["인버스"]},
            {"category": "리츠(부동산)", "keywords": ["리츠"], "exclude": []}
        ],
        "rate_hike": [
            {"category": "은행주", "keywords": ["은행"], "exclude": ["인버스"]},
            {"category": "금융주", "keywords": ["금융지주", "증권"], "exclude": ["인버스"]},
            {"category": "단기 채권", "keywords": ["단기", "KOFR", "CD"], "exclude": []}
        ],
        "inflation": [
            {"category": "실물 자산(금/은)", "keywords": ["금현물", "골드", "은선물"], "exclude": ["인버스"]},
            {"category": "원자재/에너지", "keywords": ["에너지", "원유", "구리"], "exclude": ["인버스"]},
            {"category": "고배당주", "keywords": ["고배당", "배당성장"], "exclude": []}
        ],
        "recession": [
            {"category": "안전 자산(달러)", "keywords": ["달러선물"], "exclude": ["인버스"]},
            {"category": "필수 소비재", "keywords": ["필수소비재", "음식료"], "exclude": []},
            {"category": "안전 채권", "keywords": ["미국채", "국고채"], "exclude": ["30년", "인버스"]}
        ]
    }
    
    config = SCENARIO_CONFIG.get(scenario, [])
    recommended = []
    
    for entry in config:
        category = entry["category"]
        keywords = entry["keywords"]
        exclude = entry["exclude"]
        
        # 조건에 맞는 종목 필터링
        filtered = []
        for etf in all_etfs:
            name = etf.get("itemname", "")
            # 키워드 포함 확인
            if any(k in name for k in keywords):
                # 제외 키워드 확인
                if not any(x in name for x in exclude):
                    filtered.append(etf)
        
        # 수익률(threeMonthEarnRate) 기준 정렬
        filtered.sort(key=lambda x: float(x.get("threeMonthEarnRate") or -999), reverse=True)
        
        # TOP 3 선별
        top_3 = []
        for item in filtered[:3]:
            # 수익률 포맷팅
            try:
                raw_yield = float(item.get('threeMonthEarnRate') or 0)
                yield_val = f"+{raw_yield}%" if raw_yield > 0 else f"{raw_yield}%"
            except:
                yield_val = "0.0%"
                
            top_3.append({
                "name": f"{item['itemname']} ({item['itemcode']})",
                "strategy": f"3개월 수익률 {yield_val}을 기록 중인 해당 분야 대표 상품입니다.",
                "yield": yield_val
            })
            
        if top_3:
            recommended.append({
                "category": category,
                "products": top_3
            })
            
    # 주의 종목은 시나리오별로 고정된 로직 적용
    caution = []
    if scenario == "rate_cut":
        caution.append({"category": "은행주", "products": [{"name": "KODEX 은행 (091170)", "strategy": "금리 하락 시 수익성 악화 우려"}]})
    elif scenario == "rate_hike":
        caution.append({"category": "성장주", "products": [{"name": "TIGER 미국나스닥100 (133690)", "strategy": "금리 상승에 따른 밸류에이션 하락 압력"}]})

    return recommended, caution


def main():
    print("🚀 시장 인사이트 분석 시작...")
    print(f"📅 분석 시각: {datetime.datetime.now().isoformat()}")

    # 1. 경제 지표 수집
    kr_rate, kr_rate_prev = fetch_ecos_rate()
    us_rate, us_rate_prev, cpi, gdp = fetch_fred_data()

    # 2. 시나리오 자동 판단
    scenario, analysis = determine_scenario(kr_rate, kr_rate_prev, us_rate, us_rate_prev, cpi, gdp)

    # 3. 뉴스 수집
    news = fetch_naver_news()

    # 4. 실시간 ETF 데이터 수집 및 다이나믹 매핑
    print("📊 실시간 ETF 수익률 데이터 분석 중...")
    all_etfs = fetch_naver_etf_data()
    recommended, caution = get_dynamic_assets(scenario, all_etfs)
    
    yield_date = datetime.datetime.now().strftime("%Y.%m.%d")

    # 5. Supabase 저장
    insight_data = {
        "id": "current",
        "scenario": scenario,
        "analysis": analysis,
        "kr_rate": kr_rate,
        "us_rate": us_rate,
        "us_cpi": cpi,
        "us_gdp": gdp,
        "kr_rate_prev": kr_rate_prev,
        "us_rate_prev": us_rate_prev,
        "recommended_assets": recommended,
        "caution_assets": caution,
        "yield_date": yield_date,
        "news": news,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    supabase_upsert(insight_data)
    print(f"\n🎯 최종 판정: {scenario}")
    print(f"🕒 수익률 기준일: {yield_date}")
    print(f"📝 분석 근거: {analysis}")
    print("🎉 시장 인사이트 분석이 완료되었습니다.")


if __name__ == "__main__":
    main()
