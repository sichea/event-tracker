
import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://investments.miraeasset.com/tigeretf/ko/customer/event/list.do", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        cards = await page.evaluate("""
        () => {
            const results = [];
            document.querySelectorAll('a.c-card').forEach(card => {
                results.push({
                    title: card.querySelector('.c-card__title')?.innerText.trim() || card.innerText.trim(),
                    onclick: card.getAttribute('onclick'),
                    href: card.getAttribute('href')
                });
            });
            return results;
        }
        """)
        for c in cards:
            print(f"Title: {c['title']}, Onclick: {c['onclick']}, Href: {c['href']}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check())
