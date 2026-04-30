import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
else:
    model = None

SYSTEM_PROMPT = """당신은 전문 금융 시장 분석가입니다. 사용자가 입력한 시장 상황을 바탕으로 투자의 '사고 체인'을 생성하고 투자 전략을 추천합니다.
반드시 아래의 JSON 형식으로만 답변하세요. JSON 외의 텍스트는 절대 포함하지 마세요.

{
  "steps": ["1단계 관찰", "2단계 영향분석", "3단계 자금흐름", "4단계 섹터분석", "5단계 결론"],
  "sector": "추천 섹터명",
  "stocks": [
    {"name": "종목명1", "reason": "추천 이유1"},
    {"name": "종목명2", "reason": "추천 이유2"},
    {"name": "종목명3", "reason": "추천 이유3"}
  ],
  "caution": ["주의사항1", "주의사항2"]
}

사고 과정 작성 규칙:
- 1단계: 입력된 상황에 대한 객관적 관찰 (예: "호르무즈 해협 봉쇄 뉴스가 터졌다. 원유 수송의 핵심 루트가 위협받고 있어.")
- 2단계: 경제 지표에 미칠 직접적 영향 (예: "원유 공급 차질로 국제 유가가 급등할 것이다.")
- 3단계: 자금 이동 경로 및 투자 심리 변화 (예: "위험 자산에서 안전 자산으로 머니무브가 시작되겠지.")
- 4단계: 수혜/타격 섹터 구체적 분석 (예: "에너지 섹터와 방산주가 직접적 수혜를 입을 거야.")
- 5단계: 핵심 결론 질문 (예: "그렇다면 지금 당장 담아야 할 핵심 종목은?")

종목 추천 규칙:
- 한국 주식시장(KOSPI/KOSDAQ) 또는 한국에서 거래 가능한 ETF 위주로 추천
- 각 종목의 추천 이유를 구체적으로 작성

언어: 한국어로만 답변"""


async def analyze_with_ai(user_input: str):
    """Gemini AI를 사용하여 시장 분석 수행"""
    if not GEMINI_API_KEY or not model:
        return {"error": "GEMINI_API_KEY가 설정되지 않았습니다."}

    prompt = f"사용자가 입력한 시장 상황: \"{user_input}\"\n\n위 상황에 대해 5단계 사고 체인 분석을 수행하고, 지정된 JSON 형식으로만 답변하세요."

    try:
        response = model.generate_content(
            [SYSTEM_PROMPT, prompt],
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.7,
            }
        )
        result = json.loads(response.text)
        print(f"✅ AI 분석 성공: sector={result.get('sector')}, steps={len(result.get('steps', []))}")
        return result
    except Exception as e:
        error_msg = str(e)
        print(f"❌ AI 분석 오류: {error_msg}")
        return {
            "steps": [
                f"'{user_input}' 분석 중 오류가 발생했습니다.",
                f"에러 내용: {error_msg[:100]}"
            ],
            "sector": "분석 오류",
            "stocks": [],
            "caution": ["서버 오류로 분석이 완료되지 않았습니다. 잠시 후 다시 시도해주세요."]
        }
