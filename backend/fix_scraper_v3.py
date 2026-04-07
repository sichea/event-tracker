
import re
from datetime import datetime

with open('scraper.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update date regex to support day of week in parentheses: e.g., 2026.04.16(목)
# Old: date_regex = r"(\d{2,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})"
# New: Supporting optional week day suffix
old_regex = r'date_regex = r"(\\d{2,4}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{1,2})"'
new_regex = r'date_regex = r"(\\d{2,4}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{1,2}(?:\\s*\\([가-힣a-zA-Z]+\\))?)"'
content = content.replace(old_regex, new_regex)

# 2. Add strict period removal for all providers (ensure 1 SOL, 1 AMUNDI, etc.)
# If not p["end"]: continue already added, but ensure it exists after d_day check
import re
pattern = r'(if p\["d_day"\] is not None and p\["d_day"\] < 0: continue)(\s+events\.append)'
# Replacement if not present
if 'if not p["end"]: continue' not in content:
    content = re.sub(pattern, r'\1\n            if not p["end"]: continue\2', content)

# 3. Tiger Selector Tuning
content = content.replace("await page.wait_for_selector('a.c-card', timeout=10000)", "await page.wait_for_selector('a.c-card', timeout=20000)")

with open('scraper.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated scraper.py with day-of-week support and strict filtering.")
