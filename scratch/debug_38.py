import asyncio
from playwright.async_api import async_playwright

async def debug_scrape():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://www.38.co.kr/html/fund/index.htm?o=k')
        await page.wait_for_timeout(2000)
        
        tables = await page.query_selector_all('table')
        for i, table in enumerate(tables):
            text = await table.inner_text()
            if '종목명' in text and '청약일' in text:
                print(f"Table {i} matches!")
                rows = await table.query_selector_all('tr')
                for j, row in enumerate(rows[:5]): # Print first 5 rows
                    cells = await row.query_selector_all('td, th')
                    cell_texts = [await c.inner_text() for c in cells]
                    print(f"  Row {j}: {cell_texts}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_scrape())
