
import os

with open('scraper.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the duplicated line if any
content = content.replace('if not p["end"]: continue\n            if not p["end"]: continue', 'if not p["end"]: continue')

# Ensure "if not p['end']: continue" is present after the d_day check
import re
pattern = r'(if p\["d_day"\] is not None and p\["d_day"\] < 0: continue)(\s+events\.append\(\{)'
replacement = r'\1\n            if not p["end"]: continue\2'
content = re.sub(pattern, replacement, content)

with open('scraper.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated scraper.py")
