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
    
    # 패턴: 2026.05.20~05.21
    match = re.match(r'(\d{4})\.(\d{2})\.(\d{2})~(\d{2})\.(\d{2})', date_text)
    if match:
        year, sm, sd, em, ed = match.groups()
        return {
            "start": f"{year}-{sm}-{sd}",
            "end": f"{year}-{em}-{ed}"
        }
    
    # 패턴: 2026.05.20~2026.05.21
    match = re.match(r'(\d{4})\.(\d{2})\.(\d{2})~(\d{4})\.(\d{2})\.(\d{2})', date_text)
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


async def scrape_ipo() -> list[dict]:
    """38커뮤니케이션에서 공모주 청약 일정을 수집합니다."""
    events = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            print("[IPO] 38커뮤니케이션 스크래핑 시작...")
            await page.goto(
                'https://www.38.co.kr/html/fund/index.htm?o=k',
                wait_until='networkidle',
                timeout=30000
            )
            await page.wait_for_timeout(2000)
            
            # 테이블에서 데이터 추출 (메인 청약 일정 + 상장 일정)
            data = await page.evaluate('''
            () => {
                const results = { subscriptions: [], listings: [] };
                const tables = document.querySelectorAll('table');
                
                // 1. 메인 청약 일정 테이블 찾기
                for (let i = 0; i < tables.length; i++) {
                    const t = tables[i];
                    if (t.innerText.includes('종목명') && t.innerText.includes('청약일') && t.querySelectorAll('tr').length > 3) {
                        t.querySelectorAll('tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim());
                            if (cells.length === 7 && cells[0] !== '종목명' && cells[0] !== '') {
                                results.subscriptions.push({
                                    name: cells[0],
                                    dates: cells[1],
                                    confirmed_price: cells[2],
                                    desired_price: cells[3],
                                    competition: cells[4],
                                    lead_manager: cells[5]
                                });
                            }
                        });
                        break;
                    }
                }
                
                // 2. 신규상장 일정 테이블 찾기
                for (let i = 0; i < tables.length; i++) {
                    const t = tables[i];
                    if (t.innerText.includes('신규상장 일정') && t.querySelectorAll('tr').length > 1) {
                        t.querySelectorAll('tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim());
                            // 보통 [MM/DD 종목명] 형태이거나 별도 컬럼
                            cells.forEach(c => {
                                const match = c.match(/(\d{2})\/(\d{2})\s+(.+)/);
                                if (match) {
                                    results.listings.push({
                                        date: `${match[1]}-${match[2]}`,
                                        name: match[3].trim()
                                    });
                                }
                            });
                        });
                    }
                }
                return results;
            }
            ''')
            
            subscription_rows = data["subscriptions"]
            listing_rows = data["listings"]
            
            print(f"[IPO] {len(subscription_rows)}개 종목 발견, {len(listing_rows)}개 상장 일정 확인")
            
            today = date.today()
            current_year = today.year
            
            # 상장 일정을 맵으로 변환 (이름 -> 날짜)
            listing_map = {}
            for l in listing_rows:
                listing_map[l["name"]] = f"{current_year}-{l['date']}"

            def clean_company_name(n):
                # (주), (유가), (구.xxx) 등 괄호 내용 제거 및 공백 정리
                n = re.sub(r'\(.*?\)', '', n)
                return n.strip().replace(' ', '')

            for row in subscription_rows:
                name = row["name"]
                dates = parse_subscription_dates(row["dates"])
                status = determine_ipo_status(dates["start"], dates["end"])
                
                # 상장일 찾기 (엄격한 매칭 및 날짜 유효성 검사)
                listing_date = None
                target_name_clean = clean_company_name(name)
                
                for l_name, l_date in listing_map.items():
                    if clean_company_name(l_name) == target_name_clean:
                        if dates["end"]:
                            try:
                                e_dt = datetime.strptime(dates["end"], "%Y-%m-%d").date()
                                l_dt = datetime.strptime(l_date, "%Y-%m-%d").date()
                                # 상장일은 반드시 청약 종료일보다 늦어야 함 (보통 최소 5~10일 뒤)
                                if l_dt > e_dt:
                                    listing_date = l_date
                                    break
                            except:
                                pass
                        else:
                            listing_date = l_date
                            break

                # 청약마감된 것 중 3개월 이상 지난 건 제외
                if status == "청약마감" and dates["end"]:
                    try:
                        end_dt = datetime.strptime(dates["end"], "%Y-%m-%d").date()
                        diff = (today - end_dt).days
                        if diff > 90:
                            continue
                    except: pass
                
                min_amt = calculate_min_amount(name, row["confirmed_price"], row["desired_price"])

                event = {
                    "id": generate_ipo_id(name, dates["start"]),
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
                events.append(event)
                print(f"  [IPO] {name} | 청약: {dates['start']}~{dates['end']} | 최소증거금: {min_amt:,}원 | {status}")
            
        except Exception as e:
            print(f"[IPO] 스크래핑 오류: {e}")
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
