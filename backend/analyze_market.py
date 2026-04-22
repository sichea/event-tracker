"""
시장 인사이트 자동 분석기
- ECOS API: 한국 기준금리
- FRED API: 미국 연방기금금리, CPI, GDP
- 네이버 뉴스 API: 경제 뉴스 수집
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


# 시나리오별 상세 종목 매핑 (종목번호 추가 및 3개씩 추천)
ASSET_MAPPING = {
    "rate_cut": {
        "recommended": [
            {
                "category": "미국 성장주", 
                "products": [
                    {"name": "TIGER 미국나스닥100 (133690)", "strategy": "저금리 환경에서 밸류에이션 매력이 높아지는 빅테크 중심 투자"},
                    {"name": "ACE 미국S&P500 (360200)", "strategy": "시장 전반의 완만한 상승세에 투자하는 가장 안정적인 선택"},
                    {"name": "KODEX 미국나스닥100선물(H) (304660)", "strategy": "환헤지형 상품으로 환율 변동 위험 없이 주수익에 집중"}
                ]
            },
            {
                "category": "장기 국채", 
                "products": [
                    {"name": "KODEX 미국채울트라30년선물(H) (304660)", "strategy": "금리 하락 시 채권 가격 상승폭이 가장 큰 장기물 타겟"},
                    {"name": "TIGER 미국채30년스트립액티브(합성H) (458730)", "strategy": "금리 하락에 따른 자본 차익을 극대화한 전략"},
                    {"name": "ACE 미국채20년이상 (451240)", "strategy": "미국 장기 국채에 직접 투자하는 대표적인 안전자산"}
                ]
            },
            {
                "category": "리츠(부동산)", 
                "products": [
                    {"name": "TIGER 리츠부동산인프라 (329200)", "strategy": "조달 비용 감소로 배당 수익률 및 자산 가치 상승 기대"},
                    {"name": "KODEX 미국부동산리츠(합성H) (225060)", "strategy": "전 세계 부동산 시장의 핵심인 미국 리츠에 투자"},
                    {"name": "TIGER 미국MSCI리츠(합성H) (182480)", "strategy": "글로벌 상업용 부동산 투자의 정석적인 선택"}
                ]
            }
        ],
        "caution": [
            {
                "category": "은행주",
                "products": [
                    {"name": "TIGER 은행 (091170)", "strategy": "예대마진 축소로 인한 수익성 악화 우려"},
                    {"name": "KODEX 보험 (091180)", "strategy": "금리 하락으로 인한 운용 수익률 저하 우려"}
                ]
            }
        ]
    },
    "rate_hike": {
        "recommended": [
            {
                "category": "은행주",
                "products": [
                    {"name": "KODEX 은행 (091170)", "strategy": "금리 상승에 따른 순이자마진(NIM) 개선 및 배당 확대"},
                    {"name": "TIGER 금융지주 (145670)", "strategy": "대형 지주사의 안정적인 배당 성향과 금리 수혜"},
                    {"name": "KODEX 보험 (091180)", "strategy": "금리 인상기에 자산 운용 수익률이 개선되는 보험 섹터"}
                ]
            },
            {
                "category": "단기 채권",
                "products": [
                    {"name": "KODEX 1년국고채액티브 (395160)", "strategy": "금리 변동 리스크를 최소화하며 고금리 이자 수익 확보"},
                    {"name": "TIGER KOFR금리액티브(합성) (430690)", "strategy": "매일 이자가 쌓이는 무위험 지표금리 투자 상품"},
                    {"name": "KODEX CD금리액티브(합성) (459580)", "strategy": "하루만 맡겨도 CD금리 수준의 수익을 제공하는 파킹형"}
                ]
            }
        ],
        "caution": [
            {
                "category": "성장주/기술주",
                "products": [
                    {"name": "TIGER 미국나스닥100 (133690)", "strategy": "유동성 축소 및 할인율 상승으로 인한 주가 하방 압력"},
                    {"name": "KODEX 미국채울트라30년선물(H) (304660)", "strategy": "시장 금리 상승 시 채권 가격이 급락할 위험"}
                ]
            }
        ]
    },
    "inflation": {
        "recommended": [
            {
                "category": "실물 자산(금)",
                "products": [
                    {"name": "ACE KRX금현물 (411060)", "strategy": "화폐 가치 하락 시 실물 자산으로의 가치 저장 수단 활용"},
                    {"name": "TIGER 금은선물(H) (139310)", "strategy": "금뿐만 아니라 산업 수요가 있는 은까지 동시에 투자"},
                    {"name": "KODEX 골드선물(H) (132030)", "strategy": "장내 선물을 통해 비용 효율적으로 금에 투자"}
                ]
            },
            {
                "category": "원자재/에너지",
                "products": [
                    {"name": "TIGER 미국S&P500에너지 (414210)", "strategy": "유가 상승 등 원자재 가격 상승분을 직접 반영하는 섹터"},
                    {"name": "KODEX 미국S&P500에너지 (414260)", "strategy": "글로벌 에너지 대기업 엑손모빌, 쉐브론 등 비중 높음"},
                    {"name": "TIGER 원유선물인버스(H) (217770)", "strategy": "인플레이션 정점 통과를 기대할 때 고려할 수 있는 상품"}
                ]
            }
        ],
        "caution": [
            {
                "category": "일반 채권",
                "products": [
                    {"name": "KODEX 국고채30년액티브 (403990)", "strategy": "물가 상승에 따른 금리 폭등 시 큰 손실 위험"},
                    {"name": "TIGER 미국채30년선물 (305080)", "strategy": "인플레 장기화 시 채권 가치 방어 불리"}
                ]
            }
        ]
    },
    "recession": {
        "recommended": [
            {
                "category": "안전 자산(달러)",
                "products": [
                    {"name": "KODEX 미국달러선물 (261220)", "strategy": "금융 시장 불안 시 글로벌 안전 자산인 달러 수요 급증"},
                    {"name": "TIGER 미국달러단기채권액티브 (329750)", "strategy": "달러 가치 상승과 짧은 만기 기간의 이자 수익 동시 확보"},
                    {"name": "KODEX 미국달러선물레버리지 (261240)", "strategy": "금융 위기 수준의 침체 시 달러 강세에 베팅"}
                ]
            },
            {
                "category": "필수 소비재",
                "products": [
                    {"name": "KODEX 필수소비재 (211210)", "strategy": "경기와 관계없이 수요가 일정한 음식물, 생필품 위주 방어"},
                    {"name": "TIGER 필수소비재 (143860)", "strategy": "국내 주요 경기 방어 성격의 소비재 기업 투자"},
                    {"name": "KODEX 배당성장 (139280)", "strategy": "경기 침체기에도 배당을 늘리는 우량 배당주 중심 전략"}
                ]
            }
        ],
        "caution": [
            {
                "category": "경기 민감주",
                "products": [
                    {"name": "TIGER 현대차그룹+ (138540)", "strategy": "경기 둔화에 따른 자동차 수요 감소 우려"},
                    {"name": "KODEX 반도체 (091160)", "strategy": "글로벌 IT 수요 위축에 따른 업황 사이클 둔화 위험"}
                ]
            }
        ]
    }
}


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

    # 4. 시나리오별 자산 매핑
    assets = ASSET_MAPPING.get(scenario, {"recommended": [], "caution": []})

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
        "recommended_assets": assets["recommended"],
        "caution_assets": assets["caution"],
        "news": news,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    supabase_upsert(insight_data)
    print(f"\n🎯 최종 판정: {scenario}")
    print(f"📝 분석 근거: {analysis}")
    print("🎉 시장 인사이트 분석이 완료되었습니다.")


if __name__ == "__main__":
    main()
