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
    
    # 시나리오별 키워드 및 정성적 분석 정보 정의
    SCENARIO_CONFIG = {
        "rate_cut": [
            {
                "category": "미국 성장주", 
                "keywords": ["나스닥", "테크", "반도체"], 
                "exclude": ["인버스", "2X"],
                "desc": "저금리 수혜를 직접적으로 받는 나스닥 및 혁신 기술주",
                "strategy": "금리 하락 시 자금 조달 비용 감소 및 미래 이익 할인율 하락으로 가치 상승 기대"
            },
            {
                "category": "장기 국채", 
                "keywords": ["미국채", "30년"], 
                "exclude": ["인버스"],
                "desc": "금리 하락 시 채권 가격 상승으로 인한 자본 차익 극대화",
                "strategy": "시장 금리가 낮아질수록 장기 채권의 가격 탄력성이 높아져 안정적인 수익 확보 가능"
            },
            {
                "category": "리츠(부동산)", 
                "keywords": ["리츠"], 
                "exclude": [],
                "desc": "이자 부담 감소로 배당 매력이 높아지는 부동산 자산",
                "strategy": "차입 비용 감소로 인한 수익성 개선 및 배당 성장 가능성이 높은 섹터"
            }
        ],
        "rate_hike": [
            {
                "category": "은행주", 
                "keywords": ["은행"], 
                "exclude": ["인버스"],
                "desc": "금리 상승에 따른 예대마진 확대로 수익성이 개선되는 금융 섹터",
                "strategy": "이자 수익 증가로 실적이 직접적으로 반영되는 대표적인 금리 인상 수혜주"
            },
            {
                "category": "금융주", 
                "keywords": ["금융지주", "증권"], 
                "exclude": ["인버스"],
                "desc": "고금리 환경에서 견고한 현금 흐름을 보이는 대형 금융그룹",
                "strategy": "안정적인 자본을 바탕으로 배당 및 이자 수익 비중이 높은 우량 섹터"
            },
            {
                "category": "단기 채권", 
                "keywords": ["단기", "KOFR", "CD"], 
                "exclude": [],
                "desc": "변동성 리스크를 피하고 오르는 시장 금리를 즉각 반영하는 현금성 자산",
                "strategy": "금리 변동 리스크를 최소화하면서 매일 이자가 쌓이는 안전한 투자 전략"
            }
        ],
        "inflation": [
            {
                "category": "실물 자산(금/은)", 
                "keywords": ["금현물", "골드", "은선물"], 
                "exclude": ["인버스"],
                "desc": "화폐 가치 하락에 대비하는 영원한 안전 자산",
                "strategy": "물가 상승 시 구매력 보전을 위한 최후의 가치 저장 수단"
            },
            {
                "category": "원자재/에너지", 
                "keywords": ["에너지", "원유", "구리"], 
                "exclude": ["인버스"],
                "desc": "인플레이션을 직접적으로 견인하는 에너지 및 산업용 재료",
                "strategy": "수요 증가와 공급 부족으로 가격 상승이 예상되는 실물 경제 기반 섹터"
            },
            {
                "category": "고배당주", 
                "keywords": ["고배당", "배당성장"], 
                "exclude": [],
                "desc": "물가 상승분을 이익에 반영할 수 있는 방어적 섹터",
                "strategy": "꾸준한 현금 흐름과 높은 배당 수익률로 인플레 압력을 상쇄하는 전략"
            }
        ],
        "recession": [
            {
                "category": "안전 자산(달러)", 
                "keywords": ["달러선물"], 
                "exclude": ["인버스"],
                "desc": "전 세계적 위기 상황에서 가치가 상승하는 기축 통화",
                "strategy": "경기 둔화 리스크가 커질수록 수요가 몰리는 안전 자산의 정석"
            },
            {
                "category": "필수 소비재", 
                "keywords": ["필수소비재", "음식료"], 
                "exclude": [],
                "desc": "경기가 어려워도 반드시 소비해야 하는 음식료 및 생필품",
                "strategy": "불황에도 매출 타격이 적고 안정적인 주가 방어력을 보여주는 섹터"
            },
            {
                "category": "안전 채권", 
                "keywords": ["미국채", "국고채"], 
                "exclude": ["30년", "인버스"],
                "desc": "위험 회피 심리 강화로 수요가 집중되는 단기/중기 국채",
                "strategy": "부도 위험이 없는 국고채를 통해 자산을 안전하게 보존하는 전략"
            }
        ],
        "war": [
            {
                "category": "방산주", 
                "keywords": ["방산", "현대로템", "에어로스페이스", "KAI", "LIG넥스원", "한화시스템", "현대위아"], 
                "exclude": ["인버스"],
                "desc": "지정학적 리스크 확대로 인한 국방 수요 및 수출 증가",
                "strategy": "글로벌 군비 확장 및 안보 위협 상황에서 실적 성장이 가시화되는 섹터"
            },
            {
                "category": "안전 자산(금/달러)", 
                "keywords": ["금현물", "골드", "달러선물", "달러단기"], 
                "exclude": ["인버스"],
                "desc": "분쟁 및 위기 상황에서 가치가 폭등하는 대표 안전 자산",
                "strategy": "글로벌 리스크 회피 심리 극대화 시 가장 선호되는 가치 저장 수단"
            },
            {
                "category": "에너지/원자재", 
                "keywords": ["원유", "에너지", "천연가스", "구리", "알루미늄"], 
                "exclude": ["인버스"],
                "desc": "전쟁으로 인한 공급망 차질 및 원자재 가격 변동성 확대 수혜",
                "strategy": "생산 및 물류 마비 우려로 인한 에너지 및 산업 원자재 가격 상승 수혜"
            }
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
        # 종목별로 다른 투자 이유를 제공하기 위한 템플릿
        strategy_templates = [
            "{base_strategy} 또한 해당 테마 내 높은 수익성과 시장 지배력을 보유하고 있습니다.",
            "{base_strategy} 우호적인 거시 지표를 바탕으로 안정적인 우상향 흐름이 기대됩니다.",
            "{base_strategy} 섹터 내 대표 종목으로서 자산 배분 전략의 필수적인 도구로 활용됩니다."
        ]
        
        for i, item in enumerate(filtered[:3]):
            # 수익률 포맷팅
            try:
                raw_yield = float(item.get('threeMonthEarnRate') or 0)
                yield_val = f"+{raw_yield}%" if raw_yield > 0 else f"{raw_yield}%"
            except:
                yield_val = "0.0%"
            
            # 종목별로 전략 문구 다양화
            base = entry.get("strategy", "해당 시장 상황에서 유리한 성과를 기대할 수 있는 상품입니다.")
            if i < len(strategy_templates):
                final_strategy = strategy_templates[i].format(base_strategy=base)
            else:
                final_strategy = base

            top_3.append({
                "name": f"{item['itemname']} ({item['itemcode']})",
                "strategy": final_strategy,
                "yield": yield_val
            })
            
        if top_3:
            recommended.append({
                "category": category,
                "desc": entry.get("desc", ""),
                "products": top_3
            })
            
    # 주의 종목은 시나리오별로 고정된 로직 적용
    caution = []
    if scenario == "rate_cut":
        caution.append({
            "category": "은행주", 
            "desc": "금리 하락 시 예대마진 축소로 인한 수익성 악화 우려",
            "products": [{"name": "KODEX 은행 (091170)", "strategy": "저금리 환경에서 수익성이 정체될 수 있는 금융 섹터 주의"}]
        })
    elif scenario == "rate_hike":
        caution.append({
            "category": "성장주", 
            "desc": "고금리 환경에서 미래 이익에 대한 밸류에이션 하락 압박",
            "products": [{"name": "TIGER 미국나스닥100 (133690)", "strategy": "자금 조달 비용 상승으로 인해 변동성이 커질 수 있는 기술주"}]
        })

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
