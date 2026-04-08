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
from datetime import datetime, date, timedelta
from bs4 import BeautifulSoup
from db import generate_event_id, upsert_events as db_upsert_events

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
    "AMUNDI": {
        "name": "AMUNDI",
        "full_name": "NH-Amundi ETF",
        "url": "https://m.blog.naver.com/PostList.naver?blogId=nh_amundi&categoryNo=1",
        "color": "#0088CE",
    },
    "1Q": {
        "name": "1Q",
        "full_name": "하나 1Q ETF",
        "url": "https://m.blog.naver.com/PostList.naver?blogId=1qetf&categoryNo=9",
        "color": "#ED1C24",
    },
    "PLUS": {
        "name": "PLUS",
        "full_name": "한화 PLUS ETF",
        "url": "https://m.blog.naver.com/PostList.naver?blogId=hanwhaasset&categoryNo=46",
        "color": "#FFB81C",
    },
    "KIWOOM": {
        "name": "KIWOOM",
        "full_name": "키움 KOSETF",
        "url": "https://m.blog.naver.com/PostList.naver?blogId=kiwoomammkt&categoryNo=12",
        "color": "#B0005C",
    },
    "FUN": {
        "name": "FUN",
        "full_name": "우리 FUN ETF",
        "url": "https://m.funetf.co.kr/membersLounge/event",
        "color": "#0068B7",
    },
}


def _parse_date(text: str, reference_year: int = None) -> str:
    """다양한 날짜 포맷을 YYYY-MM-DD로 통일합니다."""
    # 요일 표시(월, 화 등) 및 마침표 제거
    text = re.sub(r"\([월화수목금토일]\)", "", text)
    text = text.replace("년", "-").replace("월", "-").replace("일", "").strip()
    text = text.replace(".", "-").replace("/", "-")
    
    # 공백 제거 및 연속된 하이픈 정리
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"-+", "-", text)
    
    # 끝에 붙은 하이픈 제거 (예: 2026-03-16- -> 2026-03-16)
    text = text.rstrip("-")
    
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
        year = reference_year if reference_year else datetime.now().year
        return f"{year}-{m.zfill(2)}-{d.zfill(2)}"
    return ""


def _calc_dday(end_date_str: str) -> int | None:
    """종료일까지 남은 일수를 계산합니다. 음수면 이미 종료."""
    if not end_date_str: return None
    try:
        end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        return (end - date.today()).days
    except (ValueError, TypeError):
        return None


def is_announcement(text: str) -> bool:
    """공지사항이나 발표성 글인지 체크합니다 (True면 스킵)"""
    text = text.lower()
    
    # 1. 무조건 제외할 키워드 (세미나, 채용 등)
    # 제목에 '이벤트'가 포함되어도 세미나, 당첨자 발표 등은 제외 대상입니다.
    must_skip = ["세미나", "채용", "휴장", "점검", "공모전", "발표", "당첨자", "리셋", "기획전"]
    if any(k in text for k in must_skip):
        # 단, '이벤트 기획전' 같이 예외적인 경우가 있을 수 있으나 대부분의 경우 제외가 안전함
        return True

    # 2. '이벤트 안내' 등 제목에 '이벤트'가 포함되면 공지사항으로 보지 않음
    if "이벤트" in text or "event" in text or "기념" in text:
        return False
    
    # 3. 일반적인 공지사항 키워드
    notice_keywords = ["공지", "종료", "안내", "중단", "[안내]"]
    return any(k in text for k in notice_keywords)


def is_event_title(text: str) -> bool:
    """이벤트나 기념 키워드가 포함되어 있는지 확인합니다."""
    keywords = ["이벤트", "기념", "event", "공모전", "체험단", "팬덤", "퀴즈", "구독"]
    text = text.lower()
    return any(k in text for k in keywords)


def parse_period_from_text(text: str, reference_year: int = None) -> dict:
    """텍스트에서 기간을 정교하게 추출합니다 (YYYY.MM.DD ~ YYYY.MM.DD 등)."""
    # 1. 전처리: 심사필/준법감시인 정보 제거 (하단 노이즈 제거)
    # NH-Amundi 등에서 심사필 유효기간을 이벤트 기간으로 오인하는 문제 해결
    noise_keywords = ["심사필", "준법감시인", "광고심의", "필번호"]
    lines = text.split('\n')
    filtered_lines = []
    for line in lines:
        if any(k in line for k in noise_keywords):
            # 심사필 라인부터는 노이즈로 간주하고 중단하거나 해당 라인 스킵
            # 여기서는 해당 라인만 스킵하고 계속 진행 (다른 정보가 더 있을 수 있으므로)
            continue
        filtered_lines.append(line)
    
    clean_text_with_newlines = '\n'.join(filtered_lines)
    clean_text = re.sub(r'[\r\n\t]', ' ', clean_text_with_newlines)
    
    # 2. 키워드 기반 우선 추출 (이벤트 기간, 응모 기간 등 뒤에 오는 날짜)
    prio_keywords = ["이벤트 기간", "응모 기간", "참여 기간", "기간:", "기간 :", "기간 ["]
    date_regex = r"(\d{2,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}(?:\.?\s*\([월화수목금토일]\))?)"
    date_short_regex = r"(\d{1,2}\s*[./]\s*\d{1,2}(?:\.?\s*\([월화수목금토일]\))?)"
    sep_regex = r"\s*(?:~|—|～|-|까지)\s*"
    
    for kw in prio_keywords:
        # 키워드 바로 뒤(최대 20자 이내)에 날짜 패턴이 있는지 확인
        kw_pattern = rf"{re.escape(kw)}.*?{date_regex}{sep_regex}{date_regex}"
        match = re.search(kw_pattern, clean_text, re.IGNORECASE)
        if match:
            return {"start": _parse_date(match.group(1), reference_year), "end": _parse_date(match.group(2), reference_year)}
        
        # 키워드 뒤에 짧은 날짜 패턴 확인 (4/1 ~ 4/30)
        kw_short_pattern = rf"{re.escape(kw)}.*?{date_short_regex}{sep_regex}{date_short_regex}"
        match = re.search(kw_short_pattern, clean_text, re.IGNORECASE)
        if match:
            return {"start": _parse_date(match.group(1), reference_year), "end": _parse_date(match.group(2), reference_year)}

    # 3. 일반 패턴 검색 (기존 로직 유지하되 우선순위 밀림)
    # 3-1. 표준 패턴: 2024.04.01 ~ 2024.04.30
    p1 = re.search(f"{date_regex}{sep_regex}{date_regex}", clean_text)
    if p1:
        return {"start": _parse_date(p1.group(1), reference_year), "end": _parse_date(p1.group(2), reference_year)}

    # 3-2. 한글 패턴: 2024년 4월 1일 ~ 2024년 4월 30일
    date_ko_regex = r"(\d{2,4}년\s*\d{1,2}월\s*\d{1,2}일(?:\s*\([월화수목금토일]\))?)"
    p2 = re.search(f"{date_ko_regex}{sep_regex}{date_ko_regex}", clean_text)
    if p2:
        return {"start": _parse_date(p2.group(1), reference_year), "end": _parse_date(p2.group(2), reference_year)}

    # 3-3. 연도 생략된 패턴: 4.1(월) ~ 4.30(화)
    p3 = re.search(f"{date_short_regex}{sep_regex}{date_short_regex}", clean_text)
    if p3:
        return {"start": _parse_date(p3.group(1), reference_year), "end": _parse_date(p3.group(2), reference_year)}

    # 3-4. 종료일만 있는 경우: ~ 2024.04.30
    p4 = re.search(rf"(?:~|—|～|-|까지)\s*{date_regex}", clean_text)
    if p4:
        return {"start": "", "end": _parse_date(p4.group(1), reference_year)}

    # 3-5. 종료일만 연도 생략: ~ 4.30
    p5 = re.search(rf"(?:~|—|～|-|까지)\s*{date_short_regex}", clean_text)
    if p5:
        return {"start": "", "end": _parse_date(p5.group(1), reference_year)}
        
    return {"start": "", "end": ""}


async def scrape_detail_page_and_period(page, link: str, title: str, reference_year: int = None) -> dict:
    """공통 상세 페이지 방문 로직: 본문에서 기간을 추출하고 D-Day를 계산합니다."""
    if not link or "http" not in link:
        return {"start": "", "end": "", "d_day": None}
        
    try:
        # 이미 상세 페이지 일 수 있으므로 비교
        if page.url != link:
            await page.goto(link, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(1000)
            
        body_text = await page.evaluate("() => document.body.innerText")
        
        # 본문에서 주로 기간 추출
        period = parse_period_from_text(body_text, reference_year)
        
        # 본문에 날짜가 없다면 제목도 fallback으로 검사
        if not period["start"] and not period["end"]:
            period = parse_period_from_text(title, reference_year)
        
        d_day = _calc_dday(period["end"])
        
        return {
            "start": period["start"],
            "end": period["end"],
            "d_day": d_day
        }
    except Exception as e:
        print(f"[상세페이지 오류] {link} - {e}")
        return {"start": "", "end": "", "d_day": None}


async def scrape_tiger(page) -> list[dict]:
    """TIGER ETF 공식 홈페이지 이벤트 섹션 스크래핑"""
    events = []
    try:
        tiger_url = "https://investments.miraeasset.com/tigeretf/ko/customer/event/list.do"
        await page.goto(tiger_url, wait_until="networkidle", timeout=30000)
        
        # 필터 적용 (진행중)
        try:
            await page.select_option('select[name="searchStts"]', value="진행중")
            await page.evaluate("() => { if (typeof cmmCtrl !== 'undefined') cmmCtrl.list(1); }")
            await page.wait_for_timeout(3000)
        except: pass

        # 더보기 모든 데이터를 가져올 때까지 반복 클릭
        clicked_count = 0
        while clicked_count < 10:  # 최대 10번 (약 80개 데이터) 시도
            try:
                more = page.locator("#btnMore, button.btn-list-more").first
                if await more.is_visible():
                    print(f"[TIGER] 더보기 클릭... ({clicked_count+1})")
                    await more.click()
                    await page.wait_for_timeout(1500)  # 로딩 대기
                    clicked_count += 1
                else:
                    break
            except:
                break

        # 데이터 추출
        cards = await page.query_selector_all("a.c-card")
        print(f"[TIGER] {len(cards)}개 카드 데이터 분석 시작...")
        
        for card in cards:
            try:
                title = await card.query_selector_eval(".txt", "el => el.innerText.trim()")
                
                # TIGER는 href/onclick에 javascript:cmmCtrl.details('detailsKey', 'ID', './view.do') 형태임
                onclick = await card.get_attribute("onclick") or ""
                href = await card.get_attribute("href") or ""
                link_text = onclick + href
                
                # ID 추출 (숫자)
                id_match = re.search(r"'(\d+)'", link_text)
                if id_match:
                    event_id = id_match.group(1)
                    link = f"https://investments.miraeasset.com/tigeretf/ko/customer/event/view.do?detailsKey={event_id}"
                else:
                    # 일반 링크인 경우
                    link = href if href.startswith("http") else f"https://investments.miraeasset.com{href}"

                if not title or is_announcement(title): continue
                
                p = await scrape_detail_page_and_period(page, link, title)
                if not p["end"]: continue
                
                events.append({
                    "id": generate_event_id("TIGER", title),
                    "provider": "TIGER",
                    "title": title,
                    "start_date": p["start"],
                    "end_date": p["end"],
                    "d_day": p["d_day"],
                    "status": "진행중",
                    "link": link,
                    "scraped_at": datetime.now().isoformat(),
                })
                print(f"[TIGER Success] {title[:20]}... ({p['end']})")
            except Exception as e:
                print(f"[TIGER Card Error] {e}")

    except Exception as e:
        print(f"[TIGER] 에러 발생: {e}")
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

        # 모든 이벤트 카드 (진행중 + 종료)
        all_cards = soup.select("a[href*='event-view']")

        for card in all_cards:
            title_el = card.select_one("h3")
            if not title_el: continue
            title = title_el.get_text(strip=True)
            
            # 키워드 필터링
            if not is_event_title(title) or is_announcement(title): continue

            href = card.get("href", "")
            link = f"https://m.samsungfund.com/etf/lounge/{href}" if href and not href.startswith("http") else href
            
            # 상세 페이지 방문하여 실제 기간 추출
            p = await scrape_detail_page_and_period(page, link, title)
            
            # 필터링: 종료일이 과거면 제외, 기한 정보 없으면 제외
            if p["d_day"] is not None and p["d_day"] < 0: continue
            if not p["end"]: continue

            events.append({
                "id": generate_event_id("KODEX", title),
                "provider": "KODEX",
                "title": title,
                "start_date": p["start"],
                "end_date": p["end"],
                "d_day": p["d_day"],
                "status": "진행중",
                "link": link,
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e:
        print(f"[KODEX] 스크래핑 실패: {e}")

    return events


async def scrape_ace(page) -> list[dict]:
    """ACE ETF 공지사항(이벤트) 페이지 스크래핑 - 상세 페이지 확인"""
    events = []
    try:
        url = "https://www.aceetf.co.kr/cs/notice"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        # '이벤트' 탭 클릭
        try:
            event_btn = page.locator("button:has-text('이벤트')")
            if await event_btn.is_visible():
                await event_btn.click()
                await page.wait_for_timeout(2000)
        except Exception: pass

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")
        rows = soup.select("a[href*='/cs/notice/']")
        for row in rows:
            h3 = row.select_one("h3")
            if not h3: continue
            title = h3.get_text(strip=True)
            if not is_event_title(title) or is_announcement(title): continue

            href = row.get("href", "")
            link = f"https://www.aceetf.co.kr{href}" if "http" not in href else href
            
            p = await scrape_detail_page_and_period(page, link, title)
            if p["d_day"] is not None and p["d_day"] < 0: continue
            if not p["end"]: continue

            events.append({
                "id": generate_event_id("ACE", title),
                "provider": "ACE",
                "title": title,
                "start_date": p["start"],
                "end_date": p["end"],
                "d_day": p["d_day"],
                "status": "진행중",
                "link": link,
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e: print(f"[ACE] {e}")
    return events


async def scrape_naver_blog_generic(page, provider_id: str) -> list[dict]:
    """네이버 블로그 모바일 테마 공통 스크래핑 엔진 (대표님 전용 고성능 모드)"""
    events = []
    try:
        config = PROVIDERS[provider_id]
        # 리스트형 보기 옵션(&listStyle=post)을 추가하여 안정성 확보
        url = config["url"] + "&listStyle=post" if "&" in config["url"] else config["url"] + "?listStyle=post"
        
        print(f"[{provider_id}] 블로그 스크래핑 시작: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)
        
        # 대표님, 일부 블로그는 스크롤을 해야 목록이 나타납니다. 스크롤을 수행합니다.
        await page.evaluate("window.scrollTo(0, 1500)")
        await page.wait_for_timeout(2000)
        
        # 목록 요소가 나타날 때까지 대기
        try:
            await page.wait_for_selector('a[class*="link__"]', timeout=10000)
        except: pass

        # 목록에서 블로그 포스트 제목과 링크 추출 (Naver Blog 모바일 테마 공통 셀렉터)
        items_data = await page.evaluate("""
        () => {
            const results = [];
            // a[class*="link__"]는 작성 날짜와 관계없이 게시글 링크를 잡는 공통 클래스
            document.querySelectorAll('a[class*="link__"]').forEach(item => {
                const titleEl = item.querySelector('strong.title') || item.querySelector('strong') || item;
                // 블로그 게시물 링크 패턴: logNo 쿼리 포함 또는 /blogId/12자리숫자 형태
                const isPostLink = item.href.includes('logNo=') || item.href.includes('PostView') || /\/\d{10,14}($|\?)/.test(item.href);
                
                // 대표님, 부모 요소를 안전하게 찾아 작성 날짜를 추출합니다.
                const parent = item.closest('li') || item.closest('div[class*="item"]') || item.parentElement;
                // Naver Blog mobile은 time__SNGFu, date__... 등 다양한 클래스를 사용합니다.
                const dateEl = parent ? (
                    parent.querySelector('span[class*="time"]') || 
                    parent.querySelector('span[class*="date"]') || 
                    parent.querySelector('.time') || 
                    parent.querySelector('.date')
                ) : null;
                const dateText = dateEl ? dateEl.innerText.trim() : "";

                if (titleEl && isPostLink) {
                    results.push({
                        title: titleEl.innerText.trim(),
                        href: item.href,
                        dateText: dateText
                    });
                }
            });
            return results;
        }
        """)
        
        print(f"[{provider_id}] 블로그 목록에서 {len(items_data)}개 항목 발견 (대표님, 상세 분석을 시작합니다)")
        
        # 중복 방지를 위한 집합
        seen_titles = set()
        
        for item in items_data:
            title = item["title"]
            link = item["href"]
            date_text = item["dateText"]
            
            if not title or title in seen_titles: continue
            seen_titles.add(title)

            # 이벤트 여부 및 당첨자 발표 제외
            if not is_event_title(title) and not "event" in title.lower(): continue
            if any(k in title for k in ["당첨자", "발표", "경품 안내", "결과 공지"]): continue

            # 작성 날짜에서 연도 추출 (예: '2025. 12. 30.' 또는 '9시간 전' 등)
            ref_year = datetime.now().year
            if "." in date_text:
                try:
                    y_match = re.search(r"(\d{4})", date_text)
                    if y_match: ref_year = int(y_match.group(1))
                except: pass

            # 대표님, 게시글 번호(logNo)를 분석하여 연도 인식을 2중으로 방어합니다.
            log_no_match = re.search(r"(?:logNo=|/)(\d{10,14})", link)
            if log_no_match:
                log_no = int(log_no_match.group(1))
                # 224210000000 미만은 2025년 이전 글입니다. (네이버 블로그 생성 순서 원칙)
                if log_no < 224210000000:
                    ref_year = 2025
                    # 대표님, 2025년 글인데 날짜가 미래로 잡 히는 경우를 여기서 한 번 더 거릅니다.
                    if datetime.now().year == 2026:
                        print(f"[{provider_id}] 과거 게시물 필터링 (logNo: {log_no})")
                        continue
            
            try:
                print(f"[{provider_id}] 상세 페이지 방문: {title[:30]}... (작성연도: {ref_year})")
            except UnicodeEncodeError:
                print(f"[{provider_id}] 상세 페이지 방문: Unicode Skip (작성연도: {ref_year})")
            
            p = await scrape_detail_page_and_period(page, link, title, reference_year=ref_year)
            
            # 날짜 정보 확인 및 D-Day 필터링
            d_day = _calc_dday(p["end"])
            if d_day is not None and d_day < 0: continue
            if not p["end"]: continue

            events.append({
                "id": generate_event_id(provider_id, title),
                "provider": provider_id,
                "title": title,
                "start_date": p["start"],
                "end_date": p["end"],
                "d_day": d_day if d_day is not None else 0,
                "status": "진행중",
                "link": link,
                "scraped_at": datetime.now().isoformat()
            })
    except Exception as e: print(f"[{provider_id}] 에러 발생: {e}")
    return events


async def scrape_sol(page) -> list[dict]:
    """SOL ETF 네이버 블로그 스크래핑 (통합 엔진 사용)"""
    return await scrape_naver_blog_generic(page, "SOL")


async def scrape_rise(page) -> list[dict]:
    """RISE ETF 이벤트 페이지 스크래핑 - 목록에서 직접 기간 추출 병행"""
    events = []
    try:
        url = PROVIDERS["RISE"]["url"]
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)
        
        # 목록에서 '진행중'인 카드와 기간을 동시에 수집
        cards = await page.evaluate("""
        () => {
            const results = [];
            document.querySelectorAll('a').forEach(a => {
                const text = a.innerText;
                // '진행중' 표시가 있는 카드만 수집
                if (text.includes('진행중')) {
                    const titleEl = a.querySelector('.title, strong, p.body01') || a;
                    const dateEl = a.querySelector('.date, p.body02') || a;
                    
                    const title = titleEl.innerText.replace('진행중', '').trim();
                    const dateRange = dateEl ? dateEl.innerText : "";
                    const href = a.getAttribute('href');
                    
                    if (title && href) {
                        let link = href;
                        if (!href.startsWith('http')) {
                            link = 'https://www.riseetf.co.kr' + href;
                        }
                        results.push({ title, link, dateRange });
                    }
                }
            });
            return results;
        }
        """)

        for card in cards:
            if not is_event_title(card["title"]) or is_announcement(card["title"]): continue
            
            # 목록의 날짜 우선 파싱
            period = parse_period_from_text(card["dateRange"])
            
            # 목록에 날짜가 없으면 상세 페이지 방문
            if not period["end"]:
                p = await scrape_detail_page_and_period(page, card["link"], card["title"])
                period = p if p["end"] else period

            d_day = _calc_dday(period["end"])
            if d_day is not None and d_day < 0: continue
            if not period["end"]: continue

            events.append({
                "id": generate_event_id("RISE", card["title"]),
                "provider": "RISE",
                "title": card["title"],
                "start_date": period["start"],
                "end_date": period["end"],
                "d_day": d_day,
                "status": "진행중",
                "link": card["link"],
                "scraped_at": datetime.now().isoformat(),
            })
    except Exception as e: print(f"[RISE] {e}")
    return events


async def scrape_amundi(page) -> list[dict]:
    """AMUNDI ETF 네이버 블로그 스크래핑 (통합 엔진 사용)"""
    return await scrape_naver_blog_generic(page, "AMUNDI")


async def scrape_1q(page) -> list[dict]:
    """1Q ETF 네이버 블로그 스크래핑 (통합 엔진 사용)"""
    return await scrape_naver_blog_generic(page, "1Q")


async def scrape_plus(page) -> list[dict]:
    """PLUS ETF 네이버 블로그 스크래핑 (통합 엔진 사용)"""
    return await scrape_naver_blog_generic(page, "PLUS")


async def scrape_kiwoom(page) -> list[dict]:
    """KIWOOM ETF 네이버 블로그 스크래핑 (통합 엔진 사용)"""
    return await scrape_naver_blog_generic(page, "KIWOOM")


async def scrape_fun(page) -> list[dict]:
    """FUN ETF 이벤트 페이지 스크래핑 - 카드형 이벤트 페이지 기반"""
    import re
    events = []
    try:
        url = PROVIDERS["FUN"]["url"]
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_timeout(4000)
        
        # FUN ETF: /membersLounge/event/ 링크 기반 카드 수집
        items = await page.evaluate("""
        () => {
            const results = [];
            document.querySelectorAll("a[href*='/membersLounge/event/']").forEach(a => {
                // 종료된 이벤트 오버레이 확인
                const ended = a.querySelector('[class*="end"], [class*="close"], [class*="종료"]');
                const titleEl = a.querySelector('h5, h4, h3, .title, p.name');
                const periodEl = a.querySelector('p');
                if (titleEl) {
                    const periodArr = Array.from(a.querySelectorAll('p')).map(p => p.innerText);
                    const period = periodArr.find(t => t.includes('기간') || t.includes('~')) || '';
                    results.push({
                        title: titleEl.innerText.trim(),
                        link: a.href,
                        period: period,
                        ended: !!ended
                    });
                }
            });
            return results;
        }
        """)

        today = datetime.now().date()
        for item in items:
            if item.get("ended"): continue
            title = item["title"]
            if not title or is_announcement(title): continue
            
            # 기간 텍스트에서 날짜 파싱 (예: 26.03.26 ~ 26.04.12)
            end_date = None
            period_text = item.get("period", "")
            period_match = re.search(r'(\d{2})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})\.(\d{2})', period_text)
            if period_match:
                ey, em, ed = period_match.group(4), period_match.group(5), period_match.group(6)
                end_date = f"20{ey}-{em}-{ed}"
            # 제목에서 (~4/12) 형식도 확인
            if not end_date:
                dm = re.search(r'[~(](\d{1,2})[./](\d{1,2})[)]?', title)
                if dm:
                    m, d = int(dm.group(1)), int(dm.group(2))
                    end_date = f"{today.year}-{m:02d}-{d:02d}"
            
            link = item["link"]
            p = await scrape_detail_page_and_period(page, link, title)
            final_end = end_date or p["end"]
            d_day = _calc_dday(final_end)
            if d_day is not None and d_day < 0: continue
            if not final_end: continue

            events.append({
                "id": generate_event_id("FUN", title),
                "provider": "FUN",
                "title": title,
                "start_date": p["start"],
                "end_date": final_end,
                "d_day": d_day if d_day is not None else 0,
                "status": "진행중",
                "link": link,
                "scraped_at": datetime.now().isoformat()
            })
    except Exception as e: print(f"[FUN] {e}")
    return events


async def log_status(supabase, status: str, error_msg: str = None):
    """스크래핑 상태를 DB에 기록합니다."""
    try:
        data = {
            "id": 1, # 단일 레코드 점유
            "last_run": datetime.now().isoformat(),
            "status": status,
            "error_message": error_msg
        }
        supabase.table("scraping_status").upsert(data).execute()
        print(f"[Status Log] {status}: {error_msg if error_msg else '완료'}")
    except Exception as e:
        print(f"[Status Log Error] {e}")


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
            ("AMUNDI", scrape_amundi),
            ("1Q", scrape_1q),
            ("PLUS", scrape_plus),
            ("KIWOOM", scrape_kiwoom),
            ("FUN", scrape_fun),
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

    try:
        # 1. 상태 기록: 진행 중
        await log_status(supabase, "진행중")

        # 2. 모든 이벤트 수집 (중복 호출 제거)
        events = await scrape_all()
        if not events:
            print("[Warn] 수집된 이벤트가 없습니다.")
            await log_status(supabase, "실패", "수집된 데이터가 0건입니다.")
            return []
        
        # 3. 현재 DB에 있는 모든 '진행중' 이벤트 가져오기 (기존 이벤트 정리용)
        active_in_db = supabase.table("events").select("*").eq("status", "진행중").execute().data
        active_map = {e["id"]: e for e in active_in_db}
    
        records = []
        seen_ids = set()
        today = datetime.now().date()
        
        # 2. 이번에 새로 수집된 이벤트 처리
        for e in events:
            if e["id"] in seen_ids:
                continue
            seen_ids.add(e["id"])
            
            # 새로 수집된 것들은 이미 scrape_detail... 에서 d_day와 status가 계산되어 있음
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
            # DB에 이미 있던 거라면 active_map에서 제거 (나중에 남은 것들은 이번 수집에 없는 것들)
            if e["id"] in active_map:
                del active_map[e["id"]]

        # 3. 이번 수집에 없었으나 DB에는 '진행중'인 것들 처리 (종료 처리)
        for old_id, old_evt in active_map.items():
            # 수동으로 종료 상태로 변경
            old_evt["status"] = "종료"
            old_evt["d_day"] = -1
            # upsert 명단에 추가
            records.append({
                "id": old_evt["id"],
                "provider": old_evt["provider"],
                "title": old_evt["title"],
                "start_date": old_evt.get("start_date"),
                "end_date": old_evt.get("end_date"),
                "d_day": -1,
                "status": "종료",
                "link": old_evt.get("link"),
                "scraped_at": old_evt.get("scraped_at")
            })

        # 4. 전체 DB 점검: 날짜가 지난 것이 있다면 최종적으로 종료 처리 (강제 보정)
        for r in records:
            if r.get("status") == "진행중" and r.get("end_date"):
                try:
                    # yyyy-mm-dd 형식 가정
                    end_date = datetime.strptime(r["end_date"], "%Y-%m-%d").date()
                    if end_date < today:
                        r["status"] = "종료"
                        r["d_day"] = -1
                    else:
                        # D-Day 최신화 (수집 시점과 실제 동기화 시점 차이 보정)
                        r["d_day"] = (end_date - today).days
                except: pass

        if records:
            try:
                response = supabase.table("events").upsert(records).execute()
                print(f"[Supabase] {len(response.data)}건 저장/업데이트 완료")
            except Exception as e:
                print(f"[Supabase 오류] {e}")
                
        # 6. 최종 상태 기록: 성공
        await log_status(supabase, "성공")
        return events

    except Exception as e:
        print(f"[Critical Error] {e}")
        await log_status(supabase, "실패", str(e))
        return []


if __name__ == "__main__":
    asyncio.run(run_scrape_and_save())
