// Cloudflare Pages Function: AI Market Scenario Analysis (Quota Tracking Enabled)
export async function onRequestPost(context) {
  const { request, env } = context;

  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  const SB_URL = env.SUPABASE_URL;
  const SB_KEY = env.SUPABASE_SERVICE_KEY;

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

    // --- 1. 쿼터 체크 및 업데이트 (Supabase 사용 시) ---
    let remaining = 1500;
    if (SB_URL && SB_KEY) {
      try {
        // PST (UTC-8) 날짜 계산
        const pstDate = new Date(new Date().getTime() - (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
        
        // 현재 쿼터 정보 가져오기
        const fetchRes = await fetch(`${SB_URL}/rest/v1/api_usage?id=eq.gemini_daily`, {
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`
          }
        });
        const quotaData = await fetchRes.json();
        
        if (quotaData && quotaData[0]) {
          let currentQuota = quotaData[0];
          
          // 날짜가 바뀌었으면 리셋
          if (currentQuota.last_reset_date !== pstDate) {
            currentQuota.remaining_count = 1500;
            currentQuota.last_reset_date = pstDate;
          }

          // 한도 초과 체크
          if (currentQuota.remaining_count <= 0) {
            return new Response(JSON.stringify({ 
              error: "오늘의 통찰력 에너지가 모두 소진되었습니다. 내일 다시 충전됩니다! (태평양 표준시 0시 기준)",
              details: "Daily API Quota Exceeded",
              steps: ["에너지 소진", "내일 다시 시도"],
              remaining: 0
            }), { status: 429, headers: { "Content-Type": "application/json" } });
          }
          
          remaining = currentQuota.remaining_count;
          
          // 사용량 차감 업데이트 (비동기로 진행하여 응답 속도 최적화)
          // 여기서는 즉시 반영을 위해 await 사용
          await fetch(`${SB_URL}/rest/v1/api_usage?id=eq.gemini_daily`, {
            method: 'PATCH',
            headers: {
              'apikey': SB_KEY,
              'Authorization': `Bearer ${SB_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              remaining_count: remaining - 1,
              last_reset_date: pstDate
            })
          });
          remaining -= 1;
        }
      } catch (dbError) {
        console.error("DB Quota Error:", dbError);
        // DB 오류 시에도 분석은 계속 진행 (사용자 경험 우선)
      }
    }

    const SYSTEM_PROMPT = `당신은 전문 금융 시장 분석가입니다. 사용자가 입력한 시장 상황을 바탕으로 투자의 '사고 체인'을 생성하고 투자 전략을 추천합니다.

중요: 반드시 아래의 JSON 형식으로만 답변하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
중요: steps 배열의 각 항목에는 반드시 상세한 분석 내용을 포함해야 합니다. 제목만 쓰지 말고, 구체적인 분석 문장을 작성하세요.

{
  "steps": [
    "상세 분석 내용 1...",
    "상세 분석 내용 2...",
    "상세 분석 내용 3...",
    "상세 분석 내용 4...",
    "상세 분석 내용 5..."
  ],
  "sector": "추천 섹터명",
  "stocks": [
    {"name": "종목명1", "reason": "추천 이유1"},
    {"name": "종목명2", "reason": "추천 이유2"},
    {"name": "종목명3", "reason": "추천 이유3"}
  ],
  "caution": ["주의사항1", "주의사항2"]
}

위 형식으로 답변하되, 각 step은 2~3문장의 구체적 분석이어야 합니다. 언어: 한국어`;

    const prompt = `사용자가 입력한 시장 상황: "${scenario}"\n\n위 상황에 대해 5단계 사고 체인 분석을 수행하고 지정된 JSON으로 답변하세요.`;

    // 2. Gemini API 호출
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      const parts = data.candidates[0].content.parts;
      let resultText = null;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].text && !parts[i].thought) {
          resultText = parts[i].text;
          break;
        }
      }
      if (!resultText) resultText = parts.map(p => p.text || '').join('');
      
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) resultText = jsonMatch[0];
      
      const resultJson = JSON.parse(resultText);
      
      return new Response(JSON.stringify({ ...resultJson, remaining }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      throw new Error(data.error?.message || "Gemini API 응답 형식이 올바르지 않습니다.");
    }

  } catch (error) {
    return new Response(JSON.stringify({
      error: "분석 중 오류가 발생했습니다.",
      details: error.message,
      steps: ["분석 실패", "에러 발생"],
      sector: "N/A",
      stocks: [],
      caution: [error.message]
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
