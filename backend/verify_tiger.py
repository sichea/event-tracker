import asyncio
from playwright.async_api import async_playwright
from scraper import scrape_tiger, PROVIDERS

async def main():
    async with async_playwright() as p:
        # 헤드리스 모드에서도 차단되지 않도록 설정을 강화합니다.
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
        )
        page = await context.new_page()
        
        # 추가 헤더 설정
        await page.set_extra_http_headers({
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        })

        print(f"Scraping Tiger from: {PROVIDERS['TIGER']['url']}")
        events = await scrape_tiger(page)
        
        # 스크린샷 캡처 (디버깅용)
        await page.screenshot(path="tiger_debug.png")
        print("Debug screenshot saved as tiger_debug.png")

        print(f"\nCollected {len(events)} events:")
        for e in events:
            print(f"- {e['title']} ({e['start_date']} ~ {e['end_date']})")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
