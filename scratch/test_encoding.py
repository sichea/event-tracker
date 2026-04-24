import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://www.38.co.kr/html/fund/index.htm?o=k', wait_until='networkidle')
        
        # Get the first subscription name
        name = await page.evaluate('''() => {
            const tr = document.querySelector('table[summary="공모주 청약일정"] tr:nth-child(2)');
            if (!tr) return "Not found";
            return tr.innerText;
        }''')
        print(f"Row text: {repr(name)}")
        
        await browser.close()

asyncio.run(test())
