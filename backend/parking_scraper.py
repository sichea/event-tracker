import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
import re

load_dotenv()

# Supabase 설정
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

def clean_rate(text):
    match = re.search(r'\d+\.?\d*', text)
    return float(match.group()) if match else 0.0

import json

def scrape_parking_rates():
    print("[Parking] 파킹통장 상세 데이터(멘토리 26.4월 기준) 구성 중...")
    
    # calc_rule: [{limit: 상한액(원), rate: 이율(%)}, ...]
    # 한도를 초과하는 금액은 다음 구간의 이율을 적용받음. limit: null은 무제한.
    data = [
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "OK짠테크통장 II", "base_rate": 0.5, "max_rate": 7.00,
            "tag": "50만원 이하 최적",
            "description": json.dumps({
                "text": "50만원 이하 연 7.0%, 500만원 이하 0.8% (페이 등록 등 우대 포함)",
                "target": "OK저축은행 파킹통장 첫/단독 고객",
                "rules": [{"limit": 500000, "rate": 7.0}, {"limit": 5000000, "rate": 0.8}, {"limit": 50000000, "rate": 0.1}, {"limit": None, "rate": 1.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "다올저축은행", "product_name": "Fi 쌈짓돈 III 통장", "base_rate": 5.0, "max_rate": 5.00,
            "tag": "무조건 고금리",
            "description": json.dumps({
                "text": "우대조건 없음! 1백만원 이하 5%, 5백만원 이하 3%",
                "target": "1백~5백만원 파킹통장 찾으시는 분",
                "rules": [{"limit": 1000000, "rate": 5.0}, {"limit": 5000000, "rate": 3.0}, {"limit": 50000000, "rate": 2.0}, {"limit": None, "rate": 1.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "신한은행", "product_name": "올리브영 SOL통장", "base_rate": 0.1, "max_rate": 4.50,
            "tag": "올영 단골 전용",
            "description": json.dumps({
                "text": "2백만원 이하 4.5% (올리브영 결제 및 마케팅 동의 시)",
                "target": "올리브영 단골고객 선착순 20만명",
                "rules": [{"limit": 2000000, "rate": 4.5}, {"limit": None, "rate": 0.1}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "DB저축은행", "product_name": "DB행복파킹통장", "base_rate": 2.3, "max_rate": 3.50,
            "tag": "첫거래 추천",
            "description": json.dumps({
                "text": "5백만원 이하 3.5% (첫거래 및 마케팅 동의)",
                "target": "첫거래 고객 (500만원 예치)",
                "rules": [{"limit": 5000000, "rate": 3.5}, {"limit": 30000000, "rate": 1.5}, {"limit": None, "rate": 0.8}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "애큐온저축은행", "product_name": "머니모으기", "base_rate": 2.0, "max_rate": 5.00,
            "tag": "목표달성형",
            "description": json.dumps({
                "text": "2백만원 이하 최대 5.0% (도전성공, 출석체크 등)",
                "target": "1인당 5개까지 가입 가능",
                "rules": [{"limit": 2000000, "rate": 5.0}, {"limit": None, "rate": 2.0}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "전북은행", "product_name": "씨드모아 통장", "base_rate": 2.0, "max_rate": 3.11,
            "tag": "고액 단기예치",
            "description": json.dumps({
                "text": "금액구간 제한없음! 3개월간 우대금리 제공",
                "target": "첫거래고객, 3개월만 잠깐 넣어두실 분",
                "rules": [{"limit": None, "rate": 3.11}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "OK저축은행", "product_name": "파킹플렉스 통장", "base_rate": 1.5, "max_rate": 3.01,
            "tag": "조건없는 3억",
            "description": json.dumps({
                "text": "우대조건 없음. 5백만원 이하 3.01%, 3억 이하 2.4%",
                "target": "우대조건 없는 파킹통장 찾는 분 (5백만~3억)",
                "rules": [{"limit": 5000000, "rate": 3.01}, {"limit": 300000000, "rate": 2.4}, {"limit": None, "rate": 1.5}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "케이뱅크", "product_name": "플러스박스", "base_rate": 1.7, "max_rate": 2.20,
            "tag": "인터넷뱅크",
            "description": json.dumps({
                "text": "5천만원 초과분 2.2% (5천 이하 1.7%)",
                "target": "금액 제한 없이 편리하게",
                "rules": [{"limit": 50000000, "rate": 1.7}, {"limit": None, "rate": 2.2}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "카카오뱅크", "product_name": "세이프박스", "base_rate": 1.6, "max_rate": 1.60,
            "tag": "국민파킹통장",
            "description": json.dumps({
                "text": "조건 없이 전구간 1.6%",
                "target": "카카오뱅크 주거래 고객",
                "rules": [{"limit": None, "rate": 1.6}]
            }, ensure_ascii=False)
        },
        {
            "type": "parking", "institution": "토스뱅크", "product_name": "나눠모으기", "base_rate": 1.4, "max_rate": 1.40,
            "tag": "매일이자",
            "description": json.dumps({
                "text": "조건 없이 전구간 1.4%",
                "target": "토스뱅크 주거래 고객",
                "rules": [{"limit": None, "rate": 1.4}]
            }, ensure_ascii=False)
        }
    ]
    return data

def scrape_cma_rates():
    print("[CMA] CMA 상세 데이터 구성 중...")
    data = [
        {
            "type": "cma", "institution": "한국투자증권", "product_name": "CMA 발행어음형", "base_rate": 3.60, "max_rate": 3.60, "tag": "발행어음",
            "description": json.dumps({"text": "하루만 맡겨도 연 3.6% 수익 발생", "target": "안정적인 대형 증권사 선호", "rules": [{"limit": None, "rate": 3.6}]}, ensure_ascii=False)
        },
        {
            "type": "cma", "institution": "미래에셋증권", "product_name": "CMA-RP형", "base_rate": 3.55, "max_rate": 3.55, "tag": "인기",
            "description": json.dumps({"text": "네이버페이 통장 연계 시 추가 혜택", "target": "네이버페이 자주 쓰는 분", "rules": [{"limit": None, "rate": 3.55}]}, ensure_ascii=False)
        }
    ]
    return data

def main():
    try:
        parking = scrape_parking_rates()
        cma = scrape_cma_rates()
        all_rates = parking + cma
        
        if not all_rates:
            print("수집된 데이터가 없습니다.")
            return

        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

        # 기존 데이터 삭제 (전체 삭제)
        delete_res = requests.delete(f"{url}/rest/v1/parking_rates?id=not.is.null", headers=headers)
        if delete_res.status_code not in [200, 204]:
             print(f"삭제 실패: {delete_res.text}")
        
        # 새 데이터 삽입
        insert_res = requests.post(f"{url}/rest/v1/parking_rates", headers=headers, json=all_rates)
        if insert_res.status_code in [201, 200, 204]:
             print(f"총 {len(all_rates)}건의 금리 정보가 업데이트되었습니다.")
        else:
             print(f"삽입 실패: {insert_res.text}")

    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    main()

