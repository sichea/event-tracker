import os
import requests
import datetime
from dotenv import load_dotenv

load_dotenv('backend/.env')
key = os.environ.get('DART_API_KEY')

today = datetime.datetime.now().strftime('%Y%m%d')
start = (datetime.datetime.now() - datetime.timedelta(days=30)).strftime('%Y%m%d')

url = f'https://opendart.fss.or.kr/api/list.json?crtfc_key={key}&bgn_de={start}&end_de={today}&pblntf_ty=I'
r = requests.get(url)
data = r.json()

print(f"Total: {len(data.get('list', []))} items")
if data.get('list'):
    for item in data['list'][:5]:
        print(item)
