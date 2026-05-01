export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. API 키 확인 (클라우드플레어 환경 변수에서 가져옴)
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { scenario } = await request.json();
    if (!scenario) {
      return new Response(JSON.stringify({ error: "시나리오가 없습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const SYSTEM_PROMPT = `당신은 전문 금융 시장 분석가입니다. 사용자가 입력한 시장 상황을 바탕으로 투자의 '사고 체인'을 생성하고 투자 전략을 추천합니다.
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
- 1단계: 입력된 상황에 대한 객관적 관찰 (예: "뉴스/지표 데이터 분석")
- 2단계: 경제 지표에 미칠 직접적 영향
- 3단계: 자금 이동 경로 및 투자 심리 변화
- 4단계: 수혜/타격 섹터 구체적 분석
- 5단계: 핵심 결론 요약

종목 추천 규칙:
- 한국 주식시장(KOSPI/KOSDAQ) 또는 한국에서 거래 가능한 ETF 위주로 추천
- 각 종목의 추천 이유를 구체적으로 작성

언어: 한국어로만 답변`;

    const prompt = `사용자가 입력한 시장 상황: "${scenario}"\n\n위 상황에 대해 5단계 사고 체인 분석을 수행하고, 지정된 JSON 형식으로만 답변하세요.`;

    // 2. Gemini API 호출
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }]
          }
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7
        }
      })
    });

    const data = await response.json();
    
    // API 응답 파싱
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      const resultText = data.candidates[0].content.parts[0].text;
      const resultJson = JSON.parse(resultText);
      
      return new Response(JSON.stringify(resultJson), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      throw new Error("Gemini API 응답 형식이 올바르지 않습니다.");
    }

  } catch (error) {
    return new Response(JSON.stringify({
      error: "분석 중 오류가 발생했습니다.",
      details: error.message,
      steps: ["분석 실패", "에러 발생"],
      sector: "N/A",
      stocks: [],
      caution: ["API 호출 중 문제가 발생했습니다. 관리자 설정을 확인하세요."]
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
