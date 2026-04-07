
import os
import re

with open('scraper.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Tiger: Upgrade link extraction to string-based split instead of flaky regex
tiger_old_js = """                    const idMatch = combined.match(/detailsKey['\"]?\\s*,\\s*['\"](\\d+)['\"]/);
                    if (idMatch) {
                        const link = 'https://investments.miraeasset.com/tigeretf/ko/customer/event/view.do?detailsKey=' + idMatch[1];
                        results.push({ title, link });
                    }"""
# Note: I'll use a more generic replacement that works for any version I currently have
tiger_pattern = r'const idMatch = combined\.match\(/.*?detailsKey.*?\);.*?if \(idMatch\) \{.*?const link = .*?\+ idMatch\[1\];.*?results\.push\(\{ title, link \}\);.*?\}'
# Actually replacement by simple search/replace of the block
content = re.sub(tiger_pattern, r"""const match = combined.match(/['\"](\d+)['\"]/);
                    if (match) {
                        const link = 'https://investments.miraeasset.com/tigeretf/ko/customer/event/view.do?detailsKey=' + match[1];
                        results.push({ title, link });
                    }""", content, flags=re.DOTALL)

# 2. Amundi: Improve timeout and wait until strategy
content = content.replace('await page.goto(url, wait_until="networkidle", timeout=30000)', 'await page.goto(url, wait_until="domcontentloaded", timeout=60000)')

# 3. Final Regex Fix for Day of Week
# Handle both (금) and ( Fri )
content = content.replace(r'date_regex = r"(\d{2,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}(?:\s*\([^\)]+\))?)"', 
                          r'date_regex = r"(\d{2,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})"') # Go back to simple date

with open('scraper.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated scraper.py to V4 - Super Robust Mode")
