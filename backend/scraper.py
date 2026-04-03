"""
4개 ETF 운용사 이벤트 스크래퍼
- TIGER (미래에셋): https://investments.miraeasset.com/tigeretf/ko/customer/event/list.do
- KODEX (삼성): https://m.samsungfund.com/etf/lounge/event.do
- ACE (한국투자): https://www.aceetf.co.kr/cs/notice
- SOL (신한): https://m.blog.naver.com/soletf

Playwright를 사용하여 JS 렌더링이 필요한 사이트도 처리합니다.
"""

import asyncio
import re
from datetime import datetime, date
from bs4 import BeautifulSoup
from db import generate_event_id

# 하드코딩 방지: 상수 정의
PROVIDERS = {
    "TIGER": {
        "name": "TIGER",
        "full_name": "미래에셋 TIGER ETF",
        "url": "https://investments.miraeasset.com/tigeretf/ko/customer/event/list.do",
        "color": "#FF6B00",
    },
    "KODEX": {
        "name": "KODEX",
        "full_name": "삼성 KODEX ETF",
        "url": "https://m.samsungfund.com/etf/lounge/event.do",
        "color": "#0052FF",
    },
    "ACE": {
        "name": "ACE",
        "full_name": "한국투자 ACE ETF",
        "url": "https://www.aceetf.co.kr/cs/notice",
        "color": "#00B386",
    },
    "SOL": {
        "name": "SOL",
        "full_name": "신한 SOL ETF",
        "url": "https://m.blog.naver.com/soletf",
        "color": "#7B2FFF",
    },
    "RISE": {
        "name": "RISE",
        "full_name": "KB RISE ETF",
        "url": "https://www.riseetf.co.kr/cust/event",
        "color": "#EAB308",
    },
}


def _parse_date(text: str) -> str:
    """다양한 날짜 포맷을 YYYY-MM-DD로 통일합니다."""
    # 한글 년, 월, 일 처리
    text = text.replace("년", "-").replace("월", "-").replace("일", "").strip()
    text = text.replace(".", "-").replace("/", "-")
    
    # 공백 제거 및 연속된 하이픈 정리
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"-+", "-", text)
    
    # "2026-04-01" 형태
    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if match:
        y, m, d = match.groups()
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    # "26-04-01" 형태 (2자리 연도)
    match = re.search(r"(\d{2})-(\d{1,2})-(\d{1,2})", text)
    if match:
        y, m, d = match.groups()
        return f"20{y}-{m.zfill(2)}-{d.zfill(2)}"
    # "04-01" 형태 (연도 생략)
    match = re.search(r"(\d{1,2})-(\d{1,2})", text)
    if match:
        m, d = match.groups()
        year = datetime.now().year
        return f"{year}-{m.zfill(2)}-{d.zfill(2)}"
    return ""


def _calc_dday(end_date_str: str) -> int | None:
    """종료일까지 남은 일수를 계산합니다. 음수면 이미 종료."""
    try:
        end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        return (end - date.today()).days
    except (ValueError, TypeError):
        return None


async def scrape_tiger(page) -> list[dict]:
    """TIGER ETF 이벤트 페이지 스크래핑"""
    events = []
    try:
        tiger_url = PROVIDERS["TIGER"]["url"]
        await page.goto(tiger_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        # '더보기' 버튼을 클릭하여 전체 이벤트 로드
        try:
            more_btn = page.locator("#btnMore")
            for _ in range(5):
                if await more_btn.is_visible():
                    await more_btn.click()
                    await page.wait_for_timeout(1500)
                else:
                    break
        except Exception:
            pass

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # TIGER: a.c-card 내부 구조
        # div:nth-child(1) > div = 상태(진행중/종료)
        # div:nth-child(2) > div = 제목
        # div:nth-child(3) > div > div:nth-child(1) > div:nth-child(2) = 이벤트 기간
        cards = soup.select("a.c-card")
        for card in cards:
            # 제목: 두 번째 div의 첫 번째 자식 div
            divs = card.find_all("div", recursive=False)
            if len(divs) < 2:
                continue
            
            title_container = divs[1] if len(divs) > 1 else None
            if not title_container:
                continue
            title_div = title_container.find("div")
            title = title_div.get_text(strip=True) if title_div else ""
            if not title or len(title) < 3:
                continue

            # 상태: 첫 번째 div 안의 div
            status = ""
            if divs[0]:
                status_div = divs[0].find("div")
                status = status_div.get_text(strip=True) if status_div else ""
            
            # DEBUG: TIGER card attributes
            print(f"[DEBUG TIGER] title: {title[:20]}, onclick: {card.get('onclick')}, href: {card.get('href')}")

            # 날짜: 전체 텍스트에서 날짜 패턴 추출
            card_text = card.get_text()
            start_date, end_date = "", ""
            date_match = re.search(r"(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})", card_text)
            if date_match:
                start_date = _parse_date(date_match.group(1))
                end_date = _parse_date(date_match.group(2))

            # 링크 추출: onclick="cmmCtrl.details('detailsKey', '169', './view.do');"
            onclick = card.get("onclick", "") or ""
            href = card.get("href", "") or ""
            full_attr = onclick + href
            
            # 정교한 정규표현식으로 ID 추출 시도
            # 파라미터에서 추출: ('detailsKey', 'ID')
            id_match = re.search(r"['\"]detailsKey['\"]\s*,\s*['\"](\d+)['\"]", full_attr)
            if not id_match:
                # 쿼리 스트링에서 추출: detailsKey=ID
                id_match = re.search(r"detailsKey=(\d+)", full_attr)
            
            if id_match:
                event_id_num = id_match.group(1)
                link = f"https://investments.miraeasset.com/tigeretf/ko/customer/event/view.do?detailsKey={event_id_num}"
            else:
                link = tiger_url

            # DEBUG LOG
            with open("scraper_debug.log", "a", encoding="utf-8") as f:
                f.write(f"[TIGER] title: {title[:20]} | link: {link} | attr: {full_attr[:100]}\n")

            # 상태 판단: 'at closed' 클래스가 있으면 종료, 없으면 진행중
            # 추가로 D-Day를 확인하여 오늘보다 이전이면 종료로 보정
            is_closed = "at" in card.get("class", []) and "closed" in card.get("class", [])
            
            dday = _calc_dday(end_date)
            
            # 기본적으로 클래스로 판단하되, D-Day가 음수면 확실히 종료
            if is_closed or (dday is not None and dday < 0):
                final_status = "종료"
            else:
                final_status = "진행중"
            event = {
                "id": generate_event_id("TIGER", title),
                "provider": "TIGER",
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "d_day": dday,
                "status": final_status,
                "link": link,
                "scraped_at": datetime.now().isoformat(),
            }
            events.append(event)
    except Exception as e:
        print(f"[TIGER] 스크래핑 실패: {e}")

    return events


async def scrape_kodex(page) -> list[dict]:
    """KODEX ETF 이벤트 페이지 스크래핑 (모바일 버전)"""
    events = []
    try:
        kodex_url = PROVIDERS["KODEX"]["url"]
        await page.goto(kodex_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # KODEX 모바일: a[href*="event-view"] = 진행중, a.event-off-link = 종료
        # 각 카드 내부: h3 = 제목, p > span = 날짜
        active_cards = soup.select("a[href*='event-view']")
        ended_cards = soup.select("a.event-off-link, a[href*='event'][class*='off']")

        for card in active_cards:
            title_el = card.select_one("h3")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            href = card.get("href", "")
            link = f"https://m.samsungfund.com/etf/lounge/{href}" if href and not href.startswith("http") else href

            # 날짜: 전체 텍스트에서 추출
            card_text = card.get_text()
            start_date, end_date = "", ""
            date_match = re.search(r"(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})", card_text)
            if date_match:
                start_date = _parse_date(date_match.group(1))
                end_date = _parse_date(date_match.group(2))

            events.append({
                "id": generate_event_id("KODEX", title),
                "provider": "KODEX",
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "d_day": _calc_dday(end_date),
                "status": "진행중",
                "link": link or kodex_url,
                "scraped_at": datetime.now().isoformat(),
            })

        for card in ended_cards:
            title_el = card.select_one("h3")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            card_text = card.get_text()
            start_date, end_date = "", ""
            date_match = re.search(r"(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})", card_text)
            if date_match:
                start_date = _parse_date(date_match.group(1))
                end_date = _parse_date(date_match.group(2))

            events.append({
                "id": generate_event_id("KODEX", title),
                "provider": "KODEX",
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "d_day": _calc_dday(end_date),
                "status": "종료",
                "link": kodex_url,
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e:
        print(f"[KODEX] 스크래핑 실패: {e}")

    return events


async def scrape_ace(page) -> list[dict]:
    """ACE ETF 공지사항(이벤트) 페이지 스크래핑"""
    events = []
    try:
        url = "https://www.aceetf.co.kr/cs/notice"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # '이벤트' 탭 클릭
        try:
            event_btn = page.locator("button:has-text('이벤트')")
            if await event_btn.is_visible():
                await event_btn.click()
                await page.wait_for_timeout(2000)
        except Exception:
            pass

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # 공지사항 목록에서 이벤트 필터링
        rows = soup.select("a[href*='/cs/notice/']")
        for row in rows:
            h3 = row.select_one("h3")
            if not h3:
                continue
            title = h3.get_text(strip=True)
            if not title:
                continue

            # [EVENT] 태그가 있는 것만 이벤트로 처리
            if "EVENT" not in title.upper() and "이벤트" not in title:
                continue

            href = row.get("href", "")
            link = f"https://www.aceetf.co.kr{href}" if href and not href.startswith("http") else href

            # 날짜 추출 - 제목에서 (~4/30) 같은 패턴 또는 날짜 span에서
            date_el = row.select_one("span")
            posted_date = date_el.get_text(strip=True) if date_el else ""

            # 제목에서 종료일 추출 (~4/30)
            end_match = re.search(r"~\s*(\d{1,2})/(\d{1,2})", title)
            start_date = _parse_date(posted_date)
            end_date = ""
            if end_match:
                month, day = end_match.groups()
                year = datetime.now().year
                end_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

            events.append({
                "id": generate_event_id("ACE", title),
                "provider": "ACE",
                "title": title.replace("[EVENT]", "").replace("[event]", "").strip(),
                "start_date": start_date,
                "end_date": end_date,
                "d_day": _calc_dday(end_date),
                "status": "진행중" if _calc_dday(end_date) is None or _calc_dday(end_date) >= 0 else "종료",
                "link": link,
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e:
        print(f"[ACE] 스크래핑 실패: {e}")

    return events


async def scrape_sol(page) -> list[dict]:
    """SOL ETF 네이버 블로그 스크래핑"""
    events = []
    try:
        url = "https://m.blog.naver.com/soletf"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # 블로그 글 목록에서 '이벤트' 키워드가 포함된 글 추출
        links = soup.select("a.link__A4O1D, a[class*='link']")
        for link_el in links:
            # 제목 추출
            title_el = link_el.select_one("strong span span, strong span")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title:
                continue

            # 이벤트 관련 글만 필터링
            if "이벤트" not in title and "팬덤" not in title:
                continue
            # 당첨자 발표는 제외
            if "당첨자" in title:
                continue

            href = link_el.get("href", "")
            link = href if href.startswith("http") else f"https://m.blog.naver.com{href}"

            # 본문 요약글 추출 (DOM 구조 변경에 대응하여 텍스트 전체 추출)
            body_text = link_el.get_text(strip=True, separator=" ")

            # 기간 명시 패턴: "2026년 04월 01일", "26년 3월 3일", "04월 16일"
            # (\d{2,4}년)?\s*\d{1,2}월\s*\d{1,2}일 형태 찾기
            date_patterns = re.findall(r"(\d{2,4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일)", body_text)
            
            # DEBUG LOG: SOL
            with open("scraper_debug.log", "a", encoding="utf-8") as f:
                f.write(f"[SOL] title: {title[:20]} | body: {body_text[:100]} | patterns: {date_patterns}\n")

            start_date, end_date = "", ""
            if len(date_patterns) >= 2:
                # 첫 번째는 시작일, 두 번째는 종료일로 가정
                start_date = _parse_date(date_patterns[0])
                end_date = _parse_date(date_patterns[1])
            elif len(date_patterns) == 1:
                # 하나만 있으면 일단 시작일
                start_date = _parse_date(date_patterns[0])

            # 작성일 추출 (작성일을 시작일 백업으로 사용)
            date_div = link_el.select_one("div span")
            posted = ""
            if date_div:
                date_text = date_div.get_text(strip=True)
                date_m = re.search(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})", date_text)
                if date_m:
                    y, m, d = date_m.groups()
                    posted = f"{y}-{m.zfill(2)}-{d.zfill(2)}"

            if not start_date and posted:
                start_date = posted

            events.append({
                "id": generate_event_id("SOL", title),
                "provider": "SOL",
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "d_day": _calc_dday(end_date),
                "status": "진행중" if _calc_dday(end_date) is None or _calc_dday(end_date) >= 0 else "종료",
                "link": link,
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e:
        print(f"[SOL] 스크래핑 실패: {e}")

    return events


async def scrape_rise(page) -> list[dict]:
    """RISE ETF 이벤트 페이지 스크래핑"""
    events = []
    try:
        rise_url = PROVIDERS["RISE"]["url"]
        import requests
        from bs4 import BeautifulSoup
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        resp = requests.get(rise_url, verify=False, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        items = soup.find_all('a', href=lambda h: h and '/cust/event/' in h)
        for item in items:
            href = item.get('href', '')
            if 'page=' in href:
                href = href.split('?')[0]
                
            full_link = f"https://www.riseetf.co.kr{href}"
            
            txt_area = item.find('div', class_='txt-area')
            if not txt_area:
                continue
                
            title_tag = txt_area.find('p', class_='tit')
            title = title_tag.get_text(separator=' ', strip=True) if title_tag else "제목 없음"
            
            date_span = txt_area.find('span', class_='num')
            date_text = date_span.get_text(strip=True) if date_span else ""
            
            start_date = None
            end_date = None
            if '~' in date_text:
                parts = date_text.split('~')
                start_date = parts[0].strip().replace('.', '-')
                end_date = parts[1].strip().replace('.', '-')
            elif date_text:
                end_date = date_text.strip().replace('.', '-')
                
            d_day = _calc_dday(end_date)
            status = "진행중"
            if d_day is not None and d_day < 0:
                status = "종료"
                
            events.append({
                "id": generate_event_id("RISE", title),
                "provider": "RISE",
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "d_day": d_day,
                "status": status,
                "link": full_link,
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e:
        print(f"[RISE] 스크래핑 실패: {e}")

    return events


async def scrape_all() -> list[dict]:
    """모든 운용사의 이벤트를 수집합니다."""
    from playwright.async_api import async_playwright

    all_events = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1024, "height": 768},
        )
        page = await context.new_page()

        scrapers = [
            ("TIGER", scrape_tiger),
            ("KODEX", scrape_kodex),
            ("ACE", scrape_ace),
            ("SOL", scrape_sol),
            ("RISE", scrape_rise),
        ]

        for name, scraper in scrapers:
            print(f"[{name}] 스크래핑 시작...")
            try:
                events = await scraper(page)
                print(f"[{name}] {len(events)}건 수집 완료")
                all_events.extend(events)
            except Exception as e:
                print(f"[{name}] 스크래핑 중 오류: {e}")

        await browser.close()

    print(f"\n총 {len(all_events)}건 수집 완료")
    return all_events


async def run_scrape_and_save():
    """스크래핑 후 결과를 Supabase 저장소로 푸시합니다."""
    import os
    from supabase import create_client, Client
    
    events = await scrape_all()
    if not events:
        print("[Warn] 수집된 이벤트가 없습니다.")
        return []

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        from dotenv import load_dotenv
        load_dotenv()
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError("Supabase 환경 변수가 설정되지 않았습니다.")

    supabase: Client = create_client(url, key)
    
    records = []
    seen_ids = set()
    for e in events:
        if e["id"] in seen_ids:
            continue
        seen_ids.add(e["id"])
        records.append({
            "id": e["id"],
            "provider": e["provider"],
            "title": e["title"],
            "start_date": e.get("start_date") or None,
            "end_date": e.get("end_date") or None,
            "d_day": e.get("d_day"),
            "status": e["status"],
            "link": e.get("link"),
            "scraped_at": e.get("scraped_at")
        })

    response = supabase.table("events").upsert(records).execute()
    print(f"[Supabase] {len(response.data)}건 저장/업데이트 완료")
    
    return events


if __name__ == "__main__":
    asyncio.run(run_scrape_and_save())
