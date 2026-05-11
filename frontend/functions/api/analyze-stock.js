import { createClient } from '@supabase/supabase-js';

/**
 * [Stock Analysis AI] Cloudflare Pages Function: /api/analyze-stock
 * 기존 /api/analyze 로직을 100% 벤치마킹하여 구현
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const GEMINI_API_KEY = env.GEMINI_API_KEY;

  try {
    const { name } = await request.json();
    const cleanName = name ? name.trim() : "";
    const today = new Date().toISOString().split('T')[0];
    const userIP = request.headers.get('CF-Connecting-IP') || 'anonymous';

    // [1] 캐시 확인
    const { data: cachedResult } = await supabase
      .from('stock_analysis_cache')
      .select('result')
      .eq('company_name', cleanName)
      .maybeSingle();

    if (cachedResult) {
      return new Response(JSON.stringify({
        ...cachedResult.result,
        is_cached: true,
        model: "Cached"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // [2] 쿼터 확인 (사용자당 일 5회)
    const { data: userUsage } = await supabase
      .from('user_stock_api_usage')
      .select('count')
      .eq('user_ip', userIP)
      .eq('usage_date', today)
      .maybeSingle();

    const userCount = userUsage ? userUsage.count : 0;
    if (userCount >= 5) {
      return new Response(JSON.stringify({ error: "오늘 분석 횟수(5회)를 모두 사용하셨습니다.", user_remaining: 0 }), { status: 429 });
    }

    // [3] AI 호출 (Gemini 2.5 Flash - JSON 모드)
    const systemPrompt = `당신은 '오일전문가'의 투자 철학을 가진 전문 주식 분석가입니다.
분석 대상 기업에 대해 다음 13개 항목을 평가하여 JSON 형식으로 응답하세요.

{
  "name": "기업명",
  "scores": {
    "per": {"val": "8.2", "opt": "<10", "score": 10},
    "pbr": {"val": "0.45", "opt": "<0.6", "score": 4},
    "sustainability": {"val": "지속가능성 설명", "opt": "대체로 지속 가능", "score": 5},
    "double_listing": {"val": "상장여부 설명", "opt": "단독 상장", "score": 5},
    "dividend_yield": {"val": "4.5%", "opt": ">3%", "score": 5},
    "quarterly_dividend": {"val": "실시여부", "opt": "예", "score": 5},
    "dividend_growth": {"val": "연속인상수", "opt": "5년 이상", "score": 4},
    "buyback_cancellation": {"val": "실시여부", "opt": "예", "score": 7},
    "cancellation_ratio": {"val": "소각비율", "opt": ">1.5%", "score": 5},
    "treasury_ratio": {"val": "보유비율", "opt": "<2%", "score": 4},
    "growth": {"val": "성장성 설명", "opt": "높다", "score": 7},
    "management": {"val": "경영평가", "opt": "우수한경영자", "score": 10},
    "brand": {"val": "브랜드평가", "opt": "있다", "score": 5}
  }
}

**주의사항:**
1. 반드시 위 JSON 구조를 100% 준수하며 다른 텍스트는 포함하지 마세요.
2. 모든 항목에 대해 오일전문가 기준의 가장 적절한 점수와 선택지를 부여하세요.`;

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `${systemPrompt}\n\n분석 대상 기업: ${cleanName}\n\nJSON 형식으로만 응답하세요.` 
          }] 
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 }
      })
    });

    const aiData = await apiResponse.json();
    
    if (!aiData.candidates || aiData.candidates.length === 0 || !aiData.candidates[0].content) {
      throw new Error('AI가 답변을 생성할 수 없습니다.');
    }

    const responseText = aiData.candidates[0].content.parts[0].text;
    const resultJson = JSON.parse(responseText);

    // [4] 데이터 저장
    const newUserCount = userCount + 1;
    try {
      await Promise.all([
        supabase.from('stock_analysis_cache').insert([{ company_name: cleanName, result: resultJson }]),
        supabase.from('user_stock_api_usage').upsert({ user_ip: userIP, usage_date: today, count: newUserCount })
      ]);
    } catch (dbError) {
      console.error('DB Update Error:', dbError);
    }

    return new Response(JSON.stringify({
      ...resultJson,
      is_cached: false,
      user_remaining: 5 - newUserCount,
      model: "Gemini 2.5 Flash"
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Stock analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '분석 중 오류가 발생했습니다.',
      user_remaining: 5 - (userCount || 0)
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
