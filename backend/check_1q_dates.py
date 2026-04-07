import asyncio
from playwright.async_api import async_playwright
import re

async def get_1q_dates():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        )
        page = await context.new_page()
        url = 'https://m.blog.naver.com/PostList.naver?blogId=1qetf&categoryNo=9&listStyle=post'
        await page.goto(url, wait_until='domcontentloaded')
        await page.wait_for_timeout(3000)
        
        # Scroll to load more items (especially older 2025 ones)
        await page.evaluate("window.scrollTo(0, 1500)")
        await page.wait_for_timeout(2000)
        
        results = await page.evaluate('''() => {
            const data = [];
            document.querySelectorAll('a[class*="link__"]').forEach(a => {
                const titleEl = a.querySelector('strong.title') || a.querySelector('strong') || a;
                const title = titleEl.innerText.trim();
                // Find date elements in the same item block
                const parent = a.closest('li') || a.closest('div[class*="item"]') || a.parentElement;
                
                // Naver Blog mobile themes often use span.time, span.date, etc.
                const selectors = ['span[class*="time"]', 'span[class*="date"]', '.time', '.date'];
                let dateText = "";
                for (let sel of selectors) {
                    const el = parent.querySelector(sel);
                    if (el && el.innerText.trim()) {
                        dateText = el.innerText.trim();
                        break;
                    }
                }
                
                if (title && (a.href.includes('logNo=') || a.href.includes('PostView'))) {
                    data.push({ title, date: dateText, href: a.href });
                }
            });
            return data;
        }''')
        
        print(f"{'TITLE':<50} | {'DATE':<15}")
        print("-" * 70)
        for r in results:
            print(f"{r['title'][:50]:<50} | {r['date']:<15}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(get_1q_dates())
