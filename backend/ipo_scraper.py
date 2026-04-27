"""
공모주(IPO) 일정 스크래퍼
데이터 소스: 38커뮤니케이션 (https://www.38.co.kr/html/fund/index.htm?o=k)
"""

import asyncio
import re
import hashlib
import sys
import io
from datetime import datetime, date
from playwright.async_api import async_playwright

# Windows 터미널 한글/이모지 출력 문제 해결
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def generate_ipo_id(company_name: str, sub_start: str) -> str:
    """종목명과 청약시작일로 고유 ID를 생성합니다."""
    raw = f"IPO:{company_name}:{sub_start}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def parse_subscription_dates(date_text: str) -> dict:
    """
    '2026.05.20~05.21' 형태의 청약일 문자열을 파싱합니다.
    Returns: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
    """
    if not date_text or date_text == '-':
        return {"start": "", "end": ""}
    
    date_text = date_text.strip()
    
    # 패턴: 2026.05.20 ~ 05.21 (공백 허용)
    match = re.match(r'(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})', date_text)
    if match:
        year, sm, sd, em, ed = match.groups()
        return {
            "start": f"{year}-{sm}-{sd}",
            "end": f"{year}-{em}-{ed}"
        }
    
    # 패턴: 2026.05.20 ~ 2026.05.21 (공백 허용)
    match = re.match(r'(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})', date_text)
    if match:
        sy, sm, sd, ey, em, ed = match.groups()
        return {
            "start": f"{sy}-{sm}-{sd}",
            "end": f"{ey}-{em}-{ed}"
        }
    
    return {"start": "", "end": ""}


def determine_ipo_status(sub_start: str, sub_end: str) -> str:
    """청약 시작/종료일 기준으로 상태를 판단합니다."""
    today = date.today()
    
    if not sub_start:
        return "일정미정"
    
    try:
        start = datetime.strptime(sub_start, "%Y-%m-%d").date()
        end = datetime.strptime(sub_end, "%Y-%m-%d").date() if sub_end else start
        
        if today < start:
            return "청약예정"
        elif start <= today <= end:
            return "청약중"
        else:
            return "청약마감"
    except (ValueError, TypeError):
        return "일정미정"


def calculate_min_amount(name: str, confirmed: str, desired: str) -> int:
    """최소 청약 증거금을 계산합니다 (스팩 20주, 일반 10주, 증거금 50% 기준)."""
    price = 0
    # 확정 공모가가 있으면 우선 사용
    if confirmed and confirmed != '-':
        nums = re.findall(r'\d+', confirmed.replace(',', ''))
        if nums:
            price = int(nums[0])
    # 없으면 희망 공모가 상단 사용
    elif desired and desired != '-':
        nums = re.findall(r'\d+', desired.replace(',', ''))
        if nums:
            # 2,000~3,000 형태이므로 마지막 숫자(상단)를 가져옴
            price = int(nums[-1])
            
    if price > 0:
        # 스팩(SPAC)은 보통 최소 청약 단위가 20주, 일반 기업은 10주인 경우가 많음
        min_shares = 20 if "스팩" in name else 10
        # 증거금 50% 기준
        return int(price * min_shares * 0.5)
    return None


def clean_company_name(n):
    """(주), (유가), (구.xxx) 등 괄호 내용 제거 및 공백 정리"""
    n = re.sub(r'\(.*?\)', '', n)
    return n.strip().replace(' ', '')


def normalize_for_matching(n):
    """매칭을 위해 불필요한 수식어 제거 (스팩, 제, 호 등)"""
    n = clean_company_name(n)
    n = n.replace('제', '').replace('호', '').replace('스팩', '').replace('SPAC', '').replace('히어로', '')
    return n


async def scrape_ipo() -> list[dict]:
    """38커뮤니케이션에서 공모주 청약 일정 및 상장 일정을 수집합니다."""
    events = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # 1. 청약 일정 수집 (메인 및 스팩)
            print("[IPO] 청약 일정 스크래핑 시작...")
            await page.goto(
                'https://www.38.co.kr/html/fund/index.htm?o=k',
                wait_until='networkidle',
                timeout=30000
            )
            await page.wait_for_timeout(2000)
            
            subscription_rows = await page.evaluate('''
            () => {
                const results = [];
                const tables = document.querySelectorAll('table');
                
                for (let table of tables) {
                    const headers = Array.from(table.querySelectorAll('tr')).map(tr => 
                        Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim())
                    );
                    
                    // 종목명, 공모주일정 등이 포함된 헤더 행이 있는지 확인
                    const hasTargetHeader = headers.some(row => 
                        row.includes('종목명') && (row.includes('공모주일정') || row.includes('공모청약일정'))
                    );
                    
                    if (hasTargetHeader) {
                        table.querySelectorAll('tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim());
                            // 데이터 행 필터링: 종목명이 있고, 날짜 형식(~)이 포함된 경우
                            if (cells.length >= 6 && !['종목명', '기업명', ''].includes(cells[0]) && cells[0].length < 30 && cells[1].includes('~')) {
                                results.push({
                                    name: cells[0],
                                    dates: cells[1],
                                    confirmed_price: cells[2],
                                    desired_price: cells[3],
                                    competition: cells[4],
                                    lead_manager: cells[5]
                                });
                            }
                        });
                    }
                }
                return results;
            }
            ''')
            
            # 2. 상장 일정 수집 (전용 페이지)
            print("[IPO] 상장 일정 스크래핑 시작...")
            await page.goto(
                'https://www.38.co.kr/html/fund/index.htm?o=nw',
                wait_until='networkidle',
                timeout=30000
            )
            await page.wait_for_timeout(2000)
            
            listing_rows = await page.evaluate('''
            () => {
                const results = [];
                const tables = document.querySelectorAll('table');
                for (let t of tables) {
                    if (t.innerText.includes('기업명') && t.innerText.includes('신규상장일')) {
                        t.querySelectorAll('tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
                            // 기업명이 너무 길거나(20자 이상), 날짜 형식이 아니면 무시 (YYYY.MM.DD 또는 YYYY/MM/DD 지원)
                            if (cells.length >= 2 && cells[0] !== '기업명' && cells[0].length < 20 && cells[0] !== '' && /^\d{4}[\.\/]\d{2}[\.\/]\d{2}$/.test(cells[1])) {

                                results.push({
                                    name: cells[0],
                                    date: cells[1]
                                });
                            }

                        });
                        break;
                    }
                }
                return results;
            }
            ''')
            
            print(f"[IPO] 상장 일정 데이터: {listing_rows}")
            print(f"[IPO] {len(subscription_rows)}개 청약 종목, {len(listing_rows)}개 상장 일정 확인")

            
            # 상장 일정 맵핑 준비
            listing_map = {}
            for l in listing_rows:
                # 2026/04/23 -> 2026-04-23 변환
                l_date = l["date"].replace('/', '-')
                listing_map[normalize_for_matching(l["name"])] = l_date

            today = date.today()
            
            for row in subscription_rows:
                name = row["name"]
                # 헤더나 쓰레기 데이터 필터링
                if "청약일정" in name or "상장일정" in name or name == "종목명":
                    continue
                
                dates = parse_subscription_dates(row["dates"])
                status = determine_ipo_status(dates["start"], dates["end"])
                
                # 상장일 찾기 (정규화 매칭)
                listing_date = None
                norm_name = normalize_for_matching(name)
                
                if norm_name in listing_map:
                    listing_date = listing_map[norm_name]
                else:
                    # 부분 일치 검색 (히어로스팩 vs 스팩 등 대응)
                    for l_norm, l_date in listing_map.items():
                        if l_norm and norm_name and (norm_name in l_norm or l_norm in norm_name):
                            listing_date = l_date
                            break
                
                if "키움" in name:
                    pass


                # 청약마감된 것 중 3개월 이상 지난 건 제외
                if status == "청약마감" and dates["end"]:
                    try:
                        end_dt = datetime.strptime(dates["end"], "%Y-%m-%d").date()
                        if (today - end_dt).days > 90:
                            continue
                    except: pass
                
                min_amt = calculate_min_amount(name, row["confirmed_price"], row["desired_price"])

                event_id = generate_ipo_id(name, dates["start"])
                event = {
                    "id": event_id,
                    "company_name": name,
                    "subscription_start": dates["start"] or None,
                    "subscription_end": dates["end"] or None,
                    "listing_date": listing_date,
                    "confirmed_price": row["confirmed_price"] if row["confirmed_price"] != '-' else None,
                    "desired_price": row["desired_price"] if row["desired_price"] != '-' else None,
                    "competition_rate": row["competition"] if row["competition"] else None,
                    "lead_manager": row["lead_manager"],
                    "min_subscription_amount": min_amt,
                    "status": status,
                    "scraped_at": datetime.now().isoformat(),
                }
                
                # 중복 제거 (이미 추가된 ID면 건너뜀)
                if not any(e["id"] == event_id for e in events):
                    events.append(event)
                    print(f"  [IPO] {name} | 청약: {dates['start']}~{dates['end']} | 상장: {listing_date} | {status}")

            
        except Exception as e:
            print(f"[IPO] 스크래핑 오류: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()
    
    return events



async def run_ipo_scrape_and_save():
    """IPO 스크래핑 후 Supabase에 저장합니다."""
    import os
    
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    
    if not url or not key:
        from dotenv import load_dotenv
        load_dotenv()
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    
    if not url or not key:
        raise ValueError("Supabase 환경 변수가 설정되지 않았습니다.")

    from postgrest import SyncPostgrestClient
    class MinimalSupabase:
        def __init__(self, u, k):
            self.postgrest = SyncPostgrestClient(
                f"{u}/rest/v1", 
                headers={"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json", "Prefer": "return=representation"}
            )
        def table(self, n):
            return self.postgrest.from_(n)
            
    supabase = MinimalSupabase(url, key)
    
    events = await scrape_ipo()
    
    if not events:
        print("[IPO] 수집된 데이터가 없습니다.")
        return []
    
    records = []
    for e in events:
        records.append({
            "id": e["id"],
            "company_name": e["company_name"],
            "subscription_start": e["subscription_start"],
            "subscription_end": e["subscription_end"],
            "listing_date": e["listing_date"],
            "confirmed_price": e["confirmed_price"],
            "desired_price": e["desired_price"],
            "competition_rate": e["competition_rate"],
            "lead_manager": e["lead_manager"],
            "min_subscription_amount": e["min_subscription_amount"],
            "status": e["status"],
            "scraped_at": e["scraped_at"],
        })
    
    try:
        response = supabase.table("ipo_events").upsert(records).execute()
        print(f"[IPO Supabase] {len(response.data)}건 저장/업데이트 완료")
    except Exception as e:
        print(f"[IPO Supabase 오류] {e}")
    
    return events


if __name__ == "__main__":
    asyncio.run(run_ipo_scrape_and_save())
