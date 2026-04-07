import asyncio
from playwright.async_api import async_playwright

async def find_dates():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        )
        page = await context.new_page()
        url = 'https://m.blog.naver.com/PostList.naver?blogId=1qetf&categoryNo=9&listStyle=post'
        await page.goto(url, wait_until='networkidle')
        await page.wait_for_timeout(5000)
        
        # Find elements containing 2025. or 2026.
        data = await page.evaluate('''() => {
            const results = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                // Find year pattern in text (e.g., 2025., 2026., or 25., 26.)
                if (text.match(/202\\d\\./) || text.match(/\\d{1,2}\\. \\d{1,2}\\./)) {
                    results.push({
                        text: text,
                        className: node.parentElement ? node.parentElement.className : 'null',
                        tagName: node.parentElement ? node.parentElement.tagName : 'null'
                    });
                }
            }
            return results;
        }''')
        
        print("Found possible date elements:")
        for r in data[:20]:
            print(f"Text: {r['text']} | Tag: {r['tagName']} | Class: {r['className']}")
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(find_dates())
