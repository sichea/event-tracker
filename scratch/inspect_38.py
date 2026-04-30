import asyncio
import sys
from playwright.async_api import async_playwright

async def inspect_tables():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://www.38.co.kr/html/fund/index.htm?o=k')
        await page.wait_for_timeout(2000)
        
        tables = await page.evaluate('''
        () => {
            return Array.from(document.querySelectorAll('table')).map(t => ({
                summary: t.getAttribute('summary'),
                innerText: t.innerText.substring(0, 50).replace(/\\n/g, ' '),
            }));
        }
        ''')
        for i, t in enumerate(tables):
            summary = t['summary'] or "None"
            text = t['innerText'].encode('ascii', 'ignore').decode('ascii')
            print(f"Table {i}: Summary={summary}, Text={text}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_tables())
