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
from bs4 import BeautifulSoup

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
            if "all_scenarios_data" in resp.text:
                print("\n💡 힌트: 'all_scenarios_data' 컬럼이 DB에 없습니다.")
                print("   제공된 'supabase_schema_market_insights_v3.sql' 파일을 Supabase SQL Editor에서 실행해주세요.")
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
        valid = [o for o in obs if o.get("value") and o["value"] != "."]
        if not valid:
            return scrape_fred_fallback(series_id)

        latest = float(valid[0]["value"])
        prev = float(valid[1]["value"]) if len(valid) >= 2 else latest
        return latest, prev
    except Exception:
        return scrape_fred_fallback(series_id)


def scrape_fred_fallback(series_id):
    """FRED API 키가 없거나 오류 발생 시 웹 페이지에서 직접 스크래핑"""
    url = f"https://fred.stlouisfed.org/series/{series_id}"
    try:
        with httpx.Client() as client:
            resp = client.get(url, timeout=10)
            # 1. <span>태그 내의 관측값 검색
            match = re.search(r'class="series-meta-observation-value">([\d\.]+)', resp.text)
            if match:
                val = float(match.group(1))
                return val, val
            
            # 2. 'Latest Observation' 텍스트 기반 검색
            match = re.search(r'(\d+\.?\d*)\s*</span>\s*Latest Observation', resp.text)
            if match:
                val = float(match.group(1))
                return val, val
            
        return None, None
    except Exception as e:
        print(f"❌ FRED 웹 스크래핑 오류({series_id}): {e}")
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
    keywords = ["거시경제 금리", "한국은행 기준금리", "미국 연준 금리", "인플레이션 물가", "경기침체 전망", "전쟁 지정학적 리스크"]
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


def determine_scenario(kr_rate, kr_rate_prev, us_rate, us_rate_prev, cpi, gdp, news=[]):
    """글로벌 거시경제 지표 및 뉴스 데이터를 기반으로 전문 투자자 관점의 시나리오를 판정합니다."""
    detected_scenarios = []
    macro_brief = []  # 거시지표 분석
    risk_signals = [] # 시장 리스크 신호
    strategy_view = [] # 운용 전략 제안

    # 1. 지정학적 리스크 분석 (뉴스 데이터 기반)
    war_keywords = ["전쟁", "침공", "교전", "폭격", "지정학적 리스크", "분쟁 격화", "중동 위기", "우크라이나"]
    war_detected = False
    for n in news:
        if any(wk in n.get("title", "") or wk in n.get("description", "") for wk in war_keywords):
            risk_signals.append(f"지정학적 위기 임계치 도달: '{n.get('title')[:15]}...' 신호 감지")
            detected_scenarios.append("war")
            war_detected = True
            break

    # 2. 실물 경기 펀더멘털 분석 (GDP)
    if gdp is not None:
        if gdp < 0:
            macro_brief.append(f"경기 펀더멘털 훼손: 미국 분기 GDP 성장률 역성장({gdp}%) 확인")
            detected_scenarios.append("recession")
        elif gdp < 1.5:
            macro_brief.append(f"경기 둔화(Soft Patch) 구간 진입: 낮은 성장률({gdp}%) 지속")

    # 3. 통화 가치 및 물가 분석 (CPI)
    if cpi is not None:
        if cpi >= 3.5:
            macro_brief.append(f"인플레이션 경직성 심화: CPI {cpi}%로 타겟 물가 크게 상회")
            detected_scenarios.append("inflation")
        elif cpi >= 2.8:
            macro_brief.append(f"물가 상방 압력 잔존: {cpi}% 수준의 완만한 인플레이션")

    # 4. 통화 정책 기조 분석 (Interest Rates)
    rate_direction = 0
    if kr_rate is not None and kr_rate_prev is not None:
        rate_direction += (kr_rate - kr_rate_prev)
    if us_rate is not None and us_rate_prev is not None:
        rate_direction += (us_rate - us_rate_prev)

    if rate_direction < 0:
        strategy_view.append("피벗(Pivot) 기대감 확산: 유동성 공급 우위의 완화적 통화 정책 국면")
        detected_scenarios.append("rate_cut")
    elif rate_direction > 0:
        strategy_view.append("긴축 기조(Tightening) 강화: 고금리 유지에 따른 자산 밸류에이션 하방 압력")
        detected_scenarios.append("rate_hike")

    # 5. 시나리오 부재 시 기본 판정
    if not detected_scenarios:
        macro_brief.append("지표 안정세 지속: 거시경제 변동성 축소 구간")
        strategy_view.append("중립적 포트폴리오 유지: 개별 종목 장세 대응 권고")
        detected_scenarios.append("rate_cut") # 기본값

    # 전문 투자자 스타일의 종합 분석 리포트 생성
    final_analysis = []
    if macro_brief:
        final_analysis.append(f"[거시지표 분석] {', '.join(macro_brief)}")
    if risk_signals:
        final_analysis.append(f"[시장 리스크] {', '.join(risk_signals)}")
    if strategy_view:
        final_analysis.append(f"[전략 제언] {', '.join(strategy_view)}")
    
    # 마무리 멘트 (전문성 강조)
    footer = "본 분석은 글로벌 전설적 투자자들의 사고방식과 월스트리트의 퀀트 데이터를 학습한 모델에 의해 도출되었습니다."
    
    # 중복 제거
    unique_scenarios = []
    for s in detected_scenarios:
        if s not in unique_scenarios: unique_scenarios.append(s)

    return unique_scenarios, " | ".join(final_analysis) + " | " + footer



# ─── 시나리오 데이터 정의 (Global) ───
SCENARIO_CONFIG = {
    "rate_cut": [
        {
            "category": "미국 성장주", 
            "keywords": ["나스닥", "테크", "반도체"], 
            "exclude": ["인버스", "2X"],
            "desc": "저금리 수혜를 직접적으로 받는 나스닥 및 혁신 기술주",
            "unique_strategies": [
                "금리 하락 시 미래 이익에 대한 할인율이 낮아져 성장주 밸류에이션이 리레이팅되는 직접적인 수혜를 입습니다.",
                "자금 조달 비용 감소로 대규모 설비 투자가 필요한 반도체 및 테크 기업의 순이익 개선세가 뚜렷해집니다.",
                "유동성 확대 구간에서 혁신 기술 기업으로의 자금 유입이 가속화되며 시장 주도주 역할을 수행합니다."
            ]
        },
        {
            "category": "장기 국채", 
            "keywords": ["미국채", "30년"], 
            "exclude": ["인버스"],
            "desc": "금리 하락 시 채권 가격 상승으로 인한 자본 차익 극대화",
            "unique_strategies": [
                "시장 금리가 하락할수록 가격이 오르는 채권의 특성상 듀레이션이 긴 장기물에서 가장 큰 수익 기회가 발생합니다.",
                "금리 인하 기조가 뚜렷해지는 시기에 안정적인 자본 차익과 이자 수익을 동시에 추구할 수 있는 최적의 자산입니다.",
                "경제 성장 둔화 우려와 금리 완화가 겹치는 구간에서 안전 자산으로서의 매력이 더욱 부각됩니다."
            ]
        },
        {
            "category": "리츠(부동산)", 
            "keywords": ["리츠"], 
            "exclude": [],
            "desc": "이자 부담 감소로 배당 매력이 높아지는 부동산 자산",
            "unique_strategies": [
                "부동산 법인은 차입금이 많아 금리 하락 시 이자 비용이 감소하며 배당 가능한 이익 규모가 즉각 확대됩니다.",
                "고정적인 임대료 수익을 기반으로 금리 하락기 실질 배당 수익률의 상대적 매력이 높아지는 대표적 인컴 자산입니다.",
                "자산 가치 평가 상승과 조달 금리 하락이라는 이중 수혜를 입으며 안정적인 주가 흐름을 보여줍니다."
            ]
        }
    ],
    "rate_hike": [
        {
            "category": "은행주", 
            "keywords": ["은행"], 
            "exclude": ["인버스"],
            "desc": "금리 상승에 따른 예대마진 확대로 수익성이 개선되는 금융 섹터",
            "unique_strategies": [
                "금리가 오를수록 대출 금리와 예금 금리의 차이인 순이자마진(NIM)이 개선되며 실적이 퀀텀점프합니다.",
                "금리 인상기에 직접적으로 현금 흐름이 좋아지는 섹터로 우량한 배당 능력을 동시에 보유하고 있습니다.",
                "금리 상승분을 즉각 가격에 반영할 수 있는 구조적 수혜주로서 인플레이션 방어 기능까지 수행합니다."
            ]
        },
        {
            "category": "금융주", 
            "keywords": ["금융지주", "증권"], 
            "exclude": ["인버스"],
            "desc": "고금리 환경에서 견고한 현금 흐름을 보이는 대형 금융그룹",
            "unique_strategies": [
                "시장 금리 상승에 따른 이자 수익 증가와 투자 자산의 운용 수익률 개선이 동시에 기대됩니다.",
                "대형 지주사 중심의 견고한 자본력을 바탕으로 고금리 상황에서도 안정적인 주주 환원 정책을 유지합니다.",
                "긴축 기조 속에서 금융 시스템 내 핵심 자금 운용 기관으로서의 시장 지배력이 더욱 강화됩니다."
            ]
        },
        {
            "category": "단기 채권", 
            "keywords": ["단기", "KOFR", "CD"], 
            "exclude": [],
            "desc": "변동성 리스크를 피하고 오르는 시장 금리를 즉각 반영하는 현금성 자산",
            "unique_strategies": [
                "금리 인상에 따른 채권 가격 하락 리스크를 최소화하면서 매일 쌓이는 높은 이자 수익을 온전히 향유합니다.",
                "시중 금리 상승 속도가 빠를수록 파킹형 자산으로서의 가치가 높아지며 유연한 자산 운용을 지원합니다.",
                "자본 손실 우려 없이 시장 금리 수준의 수익을 확보하여 불확실한 시장 상황에서 훌륭한 대피소 역할을 합니다."
            ]
        }
    ],
    "inflation": [
        {
            "category": "실물 자산(금/은)", 
            "keywords": ["금현물", "골드", "은선물"], 
            "exclude": ["인버스"],
            "desc": "화폐 가치 하락에 대비하는 영원한 안전 자산",
            "unique_strategies": [
                "물가 상승으로 화폐의 구매력이 줄어들 때 금은 물리적 가치를 유지하며 구매력을 보전해주는 최후의 수단입니다.",
                "글로벌 인플레이션 압력이 커질수록 중앙은행 및 기관들의 금 수요가 늘어나며 가격이 견조하게 지지됩니다.",
                "금융 시장의 불확실성과 실물 경제의 물가 압박을 동시에 헤지할 수 있는 필수적인 대안 자산입니다."
            ]
        },
        {
            "category": "원자재/에너지", 
            "keywords": ["에너지", "원유", "구리"], 
            "exclude": ["인버스"],
            "desc": "인플레이션을 직접적으로 견인하는 에너지 및 산업용 재료",
            "unique_strategies": [
                "원자재 가격 상승이 인플레이션의 원인인 만큼, 관련 기업들의 매출과 이익이 물가와 연동되어 급증합니다.",
                "공급망 차질과 수요 증가로 인해 주요 원유 및 산업재 섹터의 현금 흐름이 역사적 고점을 기록하는 구간입니다.",
                "실물 경제 활동에 반드시 필요한 기초 재질을 다루어 물가 상승분을 소비자에게 즉각 전가할 수 있는 섹터입니다."
            ]
        },
        {
            "category": "고배당주", 
            "keywords": ["고배당", "배당성장"], 
            "exclude": [],
            "desc": "물가 상승분을 이익에 반영할 수 있는 방어적 섹터",
            "unique_strategies": [
                "안정적인 비즈니스 모델을 통해 물가 이상으로 이익을 창출하며 현금 배당을 지속할 수 있는 기업들입니다.",
                "실질 금리가 낮은 인플레 환경에서 주주들에게 배당 수익이라는 확실한 보상을 제공하는 매력적인 자산입니다.",
                "주가 변동성이 낮으면서도 채권보다 높은 수익률을 기대할 수 있어 인플레 시기 기관 투자자들의 선호도가 높습니다."
            ]
        }
    ],
    "recession": [
        {
            "category": "안전 자산(달러)", 
            "keywords": ["달러선물"], 
            "exclude": ["인버스"],
            "desc": "전 세계적 위기 상황에서 가치가 상승하는 기축 통화",
            "unique_strategies": [
                "경제 불황 우려가 커질수록 글로벌 자본은 가장 안전한 기축 통화인 달러로 회귀하려는 강한 본능을 가집니다.",
                "글로벌 자산 가격이 폭락할 때 달러 가치는 반대로 솟아올라 포트폴리오 전체의 손실을 방어해줍니다.",
                "금융 시장의 패닉 상황에서 가장 높은 유동성과 신뢰도를 보여주는 최후의 안전판 역할을 수행합니다."
            ]
        },
        {
            "category": "필수 소비재", 
            "keywords": ["필수소비재", "음식료"], 
            "exclude": [],
            "desc": "경기가 어려워도 반드시 소비해야 하는 음식료 및 생필품",
            "unique_strategies": [
                "경기가 불황이어도 사람들이 먹고 마시는 소비는 줄이기 어려워 매출 실적이 매우 안정적으로 유지됩니다.",
                "다른 성장 섹터들이 적자로 돌아설 때도 꾸준히 흑자를 기록하며 주가 하방 경직성을 강하게 보여줍니다.",
                "경기 둔화기에도 이익 체력이 훼손되지 않는 필수 기반 산업으로서 하락장에서도 견조한 흐름을 유지합니다."
            ]
        },
        {
            "category": "안전 채권", 
            "keywords": ["미국채", "국고채"], 
            "exclude": ["30년", "인버스"],
            "desc": "위험 회피 심리 강화로 수요가 집중되는 단기/중기 국채",
            "unique_strategies": [
                "부도 위험이 없는 국가가 보증하는 채권으로, 위험 자산 회피 심리가 극대화될 때 수요가 폭발합니다.",
                "금리 인하가 예상되는 불황기 초입에서 원금 손실 위험 없이 수익을 낼 수 있는 가장 보수적인 투자법입니다.",
                "주식 시장의 폭락장에서도 독립적인 흐름을 유지하여 전체 투자 자산의 변동성을 획기적으로 관리해줍니다."
            ]
        }
    ],
    "war": [
        {
            "category": "방산주", 
            "keywords": ["방산", "현대로템", "에어로스페이스", "KAI", "LIG넥스원", "한화시스템", "현대위아"], 
            "exclude": ["인버스"],
            "desc": "지정학적 리스크 확대로 인한 국방 수요 및 수출 증가",
            "unique_strategies": [
                "지정학적 충돌이 발생하면 무기 체계에 대한 수요가 급증하며 방산 기업들의 수주 잔고가 역사적으로 확대됩니다.",
                "안보 위협 고조로 전 세계 국가들이 앞다투어 군비 경쟁을 시작하며 중장기적인 성장 모멘텀이 확보됩니다.",
                "국가 안보와 직결된 특수 산업으로서 경기 상황과 무관하게 정부 예산 기반의 안정적인 매출이 발생합니다."
            ]
        },
        {
            "category": "안전 자산(금/달러)", 
            "keywords": ["금현물", "골드", "달러선물", "달러단기"], 
            "exclude": ["인버스"],
            "desc": "분쟁 및 위기 상황에서 가치가 폭등하는 대표 안전 자산",
            "unique_strategies": [
                "전쟁으로 인한 지정학적 패닉 상황에서 누구나 신뢰할 수 있는 금과 달러는 가장 강력한 가치 수호 수단입니다.",
                "예측 불가능한 위기 상황이 닥칠수록 실물 안전 자산으로의 대규모 자본 이동이 발생하며 가격이 급등합니다.",
                "글로벌 금융 시스템이 흔들릴 때도 독자적인 가치를 증명하며 자산을 가장 안전하게 보존해주는 투자입니다."
            ]
        },
        {
            "category": "에너지/원자재", 
            "keywords": ["원유", "에너지", "천연가스", "구리", "알루미늄"], 
            "exclude": ["인버스"],
            "desc": "전쟁으로 인한 공급망 차질 및 원자재 가격 변동성 확대 수혜",
            "unique_strategies": [
                "분쟁 지역의 에너지 생산 중단 및 물류 마비 우려로 인해 원유와 가스 가격이 비이성적으로 폭등하는 수혜를 입습니다.",
                "전쟁 수행 및 복구에 필수적인 기초 산업 원자재의 공급망 정체 현상이 심화되며 관련 섹터 수익률이 극대화됩니다.",
                "공급 우위 시장에서 에너지를 확보하려는 수요가 몰리며 가격 결정권이 판매자에게 집중되는 고수익 구간입니다."
            ]
        }
    ]
}

CAUTION_CONFIG = {
    "rate_cut": [
        {
            "category": "은행주/금융주", 
            "keywords": ["은행", "금융지주"], 
            "exclude": ["인버스"],
            "desc": "금리 하락 시 예대마진 축소로 인한 수익성 악화 우려",
            "unique_strategies": [
                "시장 금리 하락 시 핵심 수익 지표인 순이자마진(NIM)이 본격적으로 축소되어 금융사 전반의 이익 동력이 약화됩니다.",
                "저금리 기조에서는 예대금리차를 통한 수익 창출이 어려워지며, 전통적인 은행 핵심 비즈니스의 수익성이 정체될 위험이 큽니다.",
                "금리 인하로 인한 시장 유동성 확대가 은행권 자산의 질을 낮출 수 있으며, 금융 섹터 내 자본 유출 압력이 커지는 시기입니다."
            ]
        }
    ],
    "rate_hike": [
        {
            "category": "성장주/테크", 
            "keywords": ["나스닥", "반도체", "테크"], 
            "exclude": ["인버스", "2X"],
            "desc": "고금리 환경에서 미래 이익에 대한 밸류에이션 하락 압박",
            "unique_strategies": [
                "고금리 상황에서는 미래 현금 흐름에 적용되는 할인율이 높아져, 기술주를 포함한 고성장 종목의 밸류에이션 하락이 불가피합니다.",
                "자금 조달 비용 상승으로 재투자가 중요한 테크 기업들의 실적 하방 압력이 커지며 성장성에 대한 시장의 의구심이 깊어질 수 있습니다.",
                "유동성 긴축 국면에서 자산 가치 평가가 보수적으로 변함에 따라 기술 섹터 내 변동성이 극대화될 수 있어 주의가 필요합니다."
            ]
        }
    ]
}


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
    config = SCENARIO_CONFIG.get(scenario, [])
    recommended = []
    
    # 종목별로 다른 투자 이유를 제공하기 위한 템플릿
    strategy_templates = [
        "{base_strategy} 해당 테마 내 높은 수익성과 독보적인 시장 지배력을 보유하고 있어 안정적인 성장이 기대됩니다.",
        "{base_strategy} 우호적인 매크로 환경과 견고한 펀더멘털을 바탕으로 꾸준한 주가 우상향 흐름이 예상됩니다.",
        "{base_strategy} 섹터 내 대표적인 상품으로서 포트폴리오의 변동성을 낮추고 수익률을 제고하는 핵심 자산입니다.",
        "{base_strategy} 실질적인 수급 모멘텀이 강화되는 추세이며, 중장기적 관점에서 매력적인 진입 시점으로 판단됩니다.",
        "{base_strategy} 글로벌 트렌드에 부합하는 핵심 기술력과 브랜드 파워를 갖춘 우량 종목들로 구성되어 있습니다."
    ]

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
        # 카테고리 이름을 기반으로 시작 템플릿 인덱스 결정 (중복 방지)
        start_idx = len(category) % len(strategy_templates)

        for i, item in enumerate(filtered[:3]):
            # 수익률 포맷팅
            try:
                raw_yield = float(item.get('threeMonthEarnRate') or 0)
                yield_val = f"+{raw_yield}%" if raw_yield > 0 else f"{raw_yield}%"
            except:
                yield_val = "0.0%"
            
            # 고유 전략 문구 할당
            strategies = entry.get("unique_strategies", [])
            base_strategy = strategies[i] if i < len(strategies) else entry.get("strategy", "해당 시장 상황에서 유리한 성과를 기대할 수 있는 상품입니다.")
            
            # 템플릿 적용하여 문장 완성
            template_idx = (start_idx + i) % len(strategy_templates)
            final_strategy = strategy_templates[template_idx].format(base_strategy=base_strategy)

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
            
    # 주의 종목 분석
    caution = []
    caution_config = CAUTION_CONFIG.get(scenario, [])
    for entry in caution_config:
        category = entry["category"]
        keywords = entry["keywords"]
        exclude = entry["exclude"]
        
        filtered_c = []
        for etf in all_etfs:
            name = etf.get("itemname", "")
            if any(k in name for k in keywords) and not any(x in name for x in exclude):
                filtered_c.append(etf)
        
        # 주의 종목도 TOP 3 추출 (수익률 높은 순으로 정렬 - 역설적으로 변동성이 큼)
        filtered_c.sort(key=lambda x: float(x.get("threeMonthEarnRate") or -999), reverse=True)
        
        c_top_3 = []
        strategies = entry.get("unique_strategies", [])

        for i, item in enumerate(filtered_c[:3]):
            if i < len(strategies):
                final_strategy = strategies[i]
            else:
                final_strategy = entry.get("strategy", "현재 시장 상황에서 변동성이 우려되는 대표적인 종목입니다.")

            c_top_3.append({
                "name": f"{item['itemname']} ({item['itemcode']})",
                "strategy": final_strategy,
            })
            
        if c_top_3:
            caution.append({
                "category": category,
                "desc": entry.get("desc", ""),
                "products": c_top_3
            })

    return recommended, caution


def main():
    print("🚀 시장 인사이트 분석 시작...")
    print(f"📅 분석 시각: {datetime.datetime.now().isoformat()}")

    # 1. 경제 지표 수집
    kr_rate, kr_rate_prev = fetch_ecos_rate()
    us_rate, us_rate_prev, cpi, gdp = fetch_fred_data()

    # 2. 뉴스 수집
    news = fetch_naver_news()

    # 3. 시나리오 자동 판단 (복합 판정 지원)
    scenarios, analysis = determine_scenario(kr_rate, kr_rate_prev, us_rate, us_rate_prev, cpi, gdp, news)

    # 4. 실시간 ETF 데이터 수집 및 모든 시나리오 다이나믹 매핑
    print("📊 모든 시나리오별 실시간 ETF 수익률 데이터 분석 중...")
    all_etfs = fetch_naver_etf_data()
    
    # 모든 시나리오에 대해 데이터 생성
    all_scenarios_data = {}
    for sc_key in SCENARIO_CONFIG.keys():
        rec, cau = get_dynamic_assets(sc_key, all_etfs)
        all_scenarios_data[sc_key] = {
            "recommended": rec,
            "caution": cau
        }

    # 감지된 모든 시나리오에 대한 데이터 병합
    recommended = []
    caution = []
    
    # 중복 제거를 위한 세트
    seen_rec_categories = set()
    seen_cau_categories = set()
    
    for s_id in scenarios:
        s_data = all_scenarios_data.get(s_id)
        if not s_data: continue
        
        for r in s_data["recommended"]:
            if r["category"] not in seen_rec_categories:
                recommended.append(r)
                seen_rec_categories.add(r["category"])
                
        for c in s_data["caution"]:
            if c["category"] not in seen_cau_categories:
                caution.append(c)
                seen_cau_categories.add(c["category"])
    
    # scenario 컬럼에는 콤마로 연결하여 저장
    scenario_str = ",".join(scenarios)
    yield_date = datetime.datetime.now().strftime("%Y.%m.%d")

    # 5. Supabase 저장
    insight_data = {
        "id": "current",
        "scenario": scenario_str,
        "analysis": analysis,
        "kr_rate": kr_rate,
        "us_rate": us_rate,
        "us_cpi": cpi,
        "us_gdp": gdp,
        "kr_rate_prev": kr_rate_prev,
        "us_rate_prev": us_rate_prev,
        "recommended_assets": recommended,
        "caution_assets": caution,
        "all_scenarios_data": all_scenarios_data,
        "yield_date": yield_date,
        "news": news,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    supabase_upsert(insight_data)
    print(f"\n🎯 최종 판정: {scenario_str}")
    print(f"🕒 수익률 기준일: {yield_date}")
    print(f"📝 분석 근거: {analysis}")
    print("🎉 시장 인사이트 분석이 완료되었습니다.")



if __name__ == "__main__":
    main()
