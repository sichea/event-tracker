"""
아파트 청약 일정 스크래퍼
- 청약홈(applyhome.co.kr)에서 APT 분양정보를 수집합니다.
- 로또 청약(시세 차익 대형 단지) 판별을 포함합니다.
"""

import asyncio
import re
import hashlib
import sys
import io
import os
from datetime import datetime, date, timedelta
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

# Windows 터미널 한글/이모지 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Supabase 설정
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

# 로또 청약 키워드 (서울 주요 지역 등)
LOTTO_KEYWORDS = [
    "강남", "서초", "송파", "용산", "마포", "성동", "광진", "영등포",
    "강동", "동작", "여의도", "목동", "잠실", "반포", "압구정", "청담",
    "도곡", "대치", "개포", "삼성동", "논현", "신반포",
]

# 무순위/잔여세대 키워드
JUPJUP_KEYWORDS = ["무순위", "잔여세대", "취소분", "사후접수", "줍줍"]


def generate_apt_id(name: str, announcement_date: str) -> str:
    """주택명과 공고일로 고유 ID를 생성합니다."""
    raw = f"APT:{name}:{announcement_date}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def determine_apt_status(sub_start: str, sub_end: str) -> str:
    """청약 상태를 판단합니다."""
    today = date.today()
    try:
        s = datetime.strptime(sub_start, "%Y-%m-%d").date() if sub_start else None
        e = datetime.strptime(sub_end, "%Y-%m-%d").date() if sub_end else None
    except:
        return "청약예정"

    if s and e:
        if today < s:
            return "청약예정"
        elif s <= today <= e:
            return "청약중"
        else:
            return "청약마감"
    elif s:
        if today < s:
            return "청약예정"
        else:
            return "청약중"
    return "청약예정"


def check_lotto(name: str, region: str) -> tuple:
    """로또 청약 여부를 판별합니다."""
    reasons = []

    # 1. 서울 주요 지역 분양
    if region == "서울":
        for keyword in LOTTO_KEYWORDS:
            if keyword in name:
                reasons.append(f"서울 {keyword} 지역 분양")
                break
        if not reasons and region == "서울":
            reasons.append("서울 지역 분양")

    # 2. 무순위/줍줍 체크
    for keyword in JUPJUP_KEYWORDS:
        if keyword in name:
            reasons.append(f"{keyword} 물량")
            break

    is_lotto = len(reasons) > 0
    return is_lotto, " / ".join(reasons) if reasons else None


def parse_date_with_year(date_str: str, ref_year: int = None) -> str:
    """MM-DD 형식의 날짜를 YYYY-MM-DD 형식으로 변환합니다."""
    if not date_str or date_str.strip() == '-':
        return None

    date_str = date_str.strip()

    # 이미 YYYY-MM-DD 형식인 경우
    if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
        return date_str

    # YYYY.MM.DD 형식
    m = re.match(r'(\d{4})\.(\d{2})\.(\d{2})', date_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    # MM-DD 또는 MM.DD 형식
    m = re.match(r'(\d{2})-(\d{2})', date_str) or re.match(r'(\d{2})\.(\d{2})', date_str)
    if m:
        year = ref_year or date.today().year
        return f"{year}-{m.group(1)}-{m.group(2)}"

    return None


async def scrape_apt() -> list:
    """청약홈에서 아파트 분양정보를 수집합니다."""
    events = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            print("[APT] 청약홈 스크래핑 시작...")
            await page.goto(
                'https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do',
                wait_until='networkidle',
                timeout=30000
            )
            await page.wait_for_timeout(3000)

            # 테이블 데이터 추출
            rows = await page.query_selector_all('table.tbl_center tbody tr')
            print(f"[APT] {len(rows)}개 행 발견")

            current_year = date.today().year

            for row in rows:
                try:
                    cells = await row.query_selector_all('td')
                    if len(cells) < 9:
                        continue

                    region = (await cells[0].inner_text()).strip()
                    housing_type = (await cells[1].inner_text()).strip()
                    sale_type = (await cells[2].inner_text()).strip()

                    # 주택명 (링크 텍스트)
                    name_el = await cells[3].query_selector('a')
                    if name_el:
                        name = (await name_el.inner_text()).strip()
                    else:
                        name = (await cells[3].inner_text()).strip()

                    constructor = (await cells[4].inner_text()).strip()
                    contact = (await cells[5].inner_text()).strip()

                    # 날짜 파싱
                    announcement_text = (await cells[6].inner_text()).strip()
                    announcement_date = parse_date_with_year(announcement_text, current_year)

                    # 청약기간 (YYYY-MM-DD ~ YYYY-MM-DD 형식)
                    period_text = (await cells[7].inner_text()).strip()
                    sub_start = None
                    sub_end = None
                    # 전체 날짜 형식 우선 매칭 (2026-04-30 ~ 2026-05-04)
                    full_dates = re.findall(r'(\d{4}-\d{2}-\d{2})', period_text)
                    if len(full_dates) >= 2:
                        sub_start = full_dates[0]
                        sub_end = full_dates[1]
                    elif len(full_dates) == 1:
                        sub_start = full_dates[0]
                    else:
                        # MM-DD 형식 fallback
                        short_dates = re.findall(r'(\d{2}-\d{2})', period_text)
                        if len(short_dates) >= 2:
                            sub_start = parse_date_with_year(short_dates[0], current_year)
                            sub_end = parse_date_with_year(short_dates[1], current_year)
                        elif len(short_dates) == 1:
                            sub_start = parse_date_with_year(short_dates[0], current_year)

                    # 당첨자 발표일
                    winner_text = (await cells[8].inner_text()).strip()
                    winner_date = parse_date_with_year(winner_text, current_year)

                    if not name:
                        continue

                    # 상태 결정
                    status = determine_apt_status(sub_start, sub_end)

                    # 로또 청약 판별
                    is_lotto, lotto_reason = check_lotto(name, region)

                    event = {
                        "id": generate_apt_id(name, announcement_date or ""),
                        "region": region,
                        "housing_type": housing_type,
                        "sale_type": sale_type,
                        "name": name,
                        "constructor": constructor,
                        "contact": contact,
                        "announcement_date": announcement_date,
                        "subscription_start": sub_start,
                        "subscription_end": sub_end,
                        "winner_date": winner_date,
                        "is_lotto": is_lotto,
                        "lotto_reason": lotto_reason,
                        "status": status,
                    }
                    events.append(event)

                    lotto_tag = " 🎰로또" if is_lotto else ""
                    print(f"  [APT] {name} | {region} | 청약: {sub_start}~{sub_end} | {status}{lotto_tag}")

                except Exception as e:
                    print(f"  [APT] 행 파싱 오류: {e}")
                    continue

        except Exception as e:
            print(f"[APT] 스크래핑 오류: {e}")
        finally:
            await browser.close()

    print(f"[APT] 총 {len(events)}건 수집 완료")
    return events


async def save_to_supabase(events: list):
    """Supabase에 아파트 청약 데이터를 저장합니다."""
    import httpx

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("[APT] Supabase 환경변수가 설정되지 않았습니다.")
        return

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }

    records = []
    for e in events:
        records.append({
            "id": e["id"],
            "region": e["region"],
            "housing_type": e["housing_type"],
            "sale_type": e["sale_type"],
            "name": e["name"],
            "constructor": e["constructor"],
            "contact": e["contact"],
            "announcement_date": e["announcement_date"],
            "subscription_start": e["subscription_start"],
            "subscription_end": e["subscription_end"],
            "winner_date": e["winner_date"],
            "is_lotto": e["is_lotto"],
            "lotto_reason": e["lotto_reason"],
            "status": e["status"],
        })

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/apt_subscriptions",
                headers=headers,
                json=records,
                timeout=30
            )
            if resp.status_code >= 400:
                print(f"[APT Supabase 오류] {resp.json()}")
            else:
                print(f"[APT Supabase] {len(resp.json())}건 저장/업데이트 완료")
    except Exception as e:
        print(f"[APT Supabase 오류] {e}")


async def run_apt_scrape_and_save():
    """스크래핑 후 DB 저장 및 기존 데이터 상태 동기화"""
    import httpx
    
    # 1. 새로운 데이터 스크래핑
    new_events = await scrape_apt()
    
    # 2. 기존 DB에서 '청약중' 또는 '청약예정'인 데이터 가져오기 (상태 동기화용)
    existing_events = []
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }
        try:
            async with httpx.AsyncClient() as client:
                # 청약중이거나 청약예정인 것들만 가져와서 오늘 날짜와 대조
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/apt_subscriptions?or=(status.eq.청약중,status.eq.청약예정)",
                    headers=headers
                )
                if resp.status_code == 200:
                    existing_events = resp.json()
        except Exception as e:
            print(f"[APT DB 조회 오류] {e}")

    # 3. 데이터 통합 및 상태 재계산
    all_records_map = {e["id"]: e for e in existing_events}
    
    # 새로운 데이터로 업데이트 또는 추가
    for ne in new_events:
        all_records_map[ne["id"]] = ne
        
    # 모든 기록에 대해 날짜 기반 상태 재계산 (오늘 날짜 기준)
    today = date.today()
    updated_records = []
    
    for rid, record in all_records_map.items():
        # 날짜 파싱 및 상태 결정
        sub_start = record.get("subscription_start")
        sub_end = record.get("subscription_end")
        
        # determine_apt_status 로직 재적용
        new_status = determine_apt_status(sub_start, sub_end)
        
        # 상태가 변했거나 새 데이터면 리스트에 추가
        if record.get("status") != new_status or any(ne["id"] == rid for ne in new_events):
            record["status"] = new_status
            updated_records.append(record)
            if record.get("status") != new_status:
                print(f"  [APT 상태 업데이트] {record.get('name')} : {record.get('status')} -> {new_status}")

    # 4. 최종 저장
    if updated_records:
        await save_to_supabase(updated_records)
    else:
        print("[APT] 업데이트할 데이터가 없습니다.")



if __name__ == "__main__":
    asyncio.run(run_apt_scrape_and_save())
