
import requests
from bs4 import BeautifulSoup
url = "https://m.blog.naver.com/soletf/224219231868"
res = requests.get(url)
soup = BeautifulSoup(res.text, 'html.parser')
meta = soup.find('meta', {'property': 'og:description'})
if meta:
    print(meta['content'])
else:
    print("Meta not found")
