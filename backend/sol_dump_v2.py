
import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://m.blog.naver.com/soletf", wait_until="networkidle")
        await page.wait_for_timeout(5000)
        
        # 모든 카드 제목과 링크를 하나도 빠짐없이 긁어옴
        posts = await page.evaluate("""
        () => {
            const results = [];
            document.querySelectorAll('div.list_post_article').forEach(post => {
                const title = post.querySelector('strong.title')?.innerText.trim() || '';
                const link = post.querySelector('a')?.getAttribute('href') || '';
                results.push({ title, link });
            });
            return results;
        }
        """)
        for p in posts:
            print(f"Post: {p['title']}, Link: {p['link']}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check())
