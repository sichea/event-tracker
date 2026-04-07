
import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://m.blog.naver.com/soletf", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        links = await page.evaluate("""
        () => {
            const results = [];
            document.querySelectorAll('a').forEach(a => {
                const text = a.innerText.trim();
                if (text.includes('4월') && text.includes('이벤트')) {
                    results.push({ text, href: a.getAttribute('href') });
                }
            });
            return results;
        }
        """)
        for l in links:
            print(f"Title: {l['text']}, Href: {l['href']}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check())
