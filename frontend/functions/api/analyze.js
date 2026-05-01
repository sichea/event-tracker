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

중요: 반드시 아래의 JSON 형식으로만 답변하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
중요: steps 배열의 각 항목에는 반드시 상세한 분석 내용을 포함해야 합니다. 제목만 쓰지 말고, 구체적인 분석 문장을 작성하세요.

{
  "steps": [
    "호르무즈 해협 봉쇄 뉴스가 터졌다. 원유 수송의 핵심 루트가 위협받고 있어. 이건 단순한 지정학 리스크가 아니라 실물 경제에 바로 영향을 줄 사안이야.",
    "원유 공급 차질로 국제 유가가 급등할 것이다. WTI 기준 배럴당 10~15달러 상승 가능성이 높고, 이는 소비자 물가와 기업 원가에 직접 타격을 준다.",
    "위험 자산에서 안전 자산으로 머니무브가 시작되겠지. 달러와 금이 강세를 보이고, 신흥국 통화와 주식시장에서 자금이 빠져나갈 수 있어.",
    "에너지 섹터와 방산주가 직접적 수혜를 입을 거야. 반면 항공, 해운, 석유화학 등 원유를 많이 사용하는 업종은 비용 부담이 커질 수밖에 없어.",
    "그렇다면 지금 당장 담아야 할 핵심 종목은? 에너지 ETF와 방산 관련주가 단기적으로 가장 유망해 보인다. 리스크 관리를 위해 금 ETF도 일부 편입하자."
  ],
  "sector": "에너지/방산",
  "stocks": [
    {"name": "KODEX WTI원유선물(H)", "reason": "국제 유가 급등 시 직접 수혜를 받는 원유 선물 ETF"},
    {"name": "한화에어로스페이스", "reason": "지정학적 긴장 고조 시 방산 수요 증가로 수혜"},
    {"name": "TIGER 금은선물(H)", "reason": "안전자산 선호 심리 확산으로 금 가격 상승 기대"}
  ],
  "caution": ["지정학적 리스크는 급변할 수 있으므로 단기 트레이딩 관점으로 접근할 것", "원유 관련 ETF는 롤오버 비용이 발생할 수 있으므로 장기 보유에 주의"]
}

위 예시처럼 steps의 각 항목은 반드시 2~3문장의 구체적이고 전문적인 분석 내용이어야 합니다.
절대 "1단계 관찰", "2단계 영향분석" 같은 제목만 쓰지 마세요. 실제 분석 내용을 써야 합니다.

종목 추천 규칙:
- 한국 주식시장(KOSPI/KOSDAQ) 또는 한국에서 거래 가능한 ETF 위주로 추천
- 각 종목의 추천 이유를 구체적으로 작성

언어: 한국어로만 답변`;

    const prompt = `사용자가 입력한 시장 상황: "${scenario}"

위 상황에 대해 5단계 사고 체인 분석을 수행하세요.
각 step에는 반드시 상세한 분석 내용(2~3문장)을 포함하세요.
지정된 JSON 형식으로만 답변하세요.`;

    // 2. Gemini API 호출
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
          temperature: 0.7
        }
      })
    });

    const data = await response.json();
    
    // Thinking 모델 대응: parts 배열에서 실제 답변(마지막 part)을 찾음
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      const parts = data.candidates[0].content.parts;
      
      // thinking 모델은 [thinking part, answer part] 구조
      // 마지막 part가 실제 답변이므로 뒤에서부터 JSON을 찾음
      let resultText = null;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].text && !parts[i].thought) {
          resultText = parts[i].text;
          break;
        }
      }
      
      // fallback: 어떤 part에서든 JSON을 찾지 못하면 전체 텍스트에서 시도
      if (!resultText) {
        resultText = parts.map(p => p.text || '').join('');
      }
      
      // ```json ... ``` 마크다운 블록 제거 후 순수 JSON 추출
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultText = jsonMatch[0];
      }
      
      const resultJson = JSON.parse(resultText);
      
      return new Response(JSON.stringify(resultJson), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.error("Gemini API Error Data:", data);
      throw new Error(data.error?.message || "Gemini API 응답 형식이 올바르지 않습니다.");
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
