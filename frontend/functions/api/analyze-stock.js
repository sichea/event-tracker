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

    // [0] 기본 입력 검증: 너무 짧거나 의미 없는 입력 차단
    if (cleanName.length < 2) {
      return new Response(JSON.stringify({ error: '기업명은 2글자 이상 입력해 주세요.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // [1] 쿼터 확인 (캐시 히트에서도 userCount 필요하므로 먼저 조회)
    const [{ data: globalUsage }, { data: userUsage }] = await Promise.all([
      supabase.from('api_usage').select('*').eq('id', 'gemini_stock_daily').maybeSingle(),
      supabase.from('user_stock_api_usage').select('count').eq('user_ip', userIP).eq('usage_date', today).maybeSingle()
    ]);
    
    let globalRemaining = globalUsage ? globalUsage.remaining_count : 500;
    if (globalUsage && globalUsage.last_reset_date !== today) {
      globalRemaining = 500;
      await supabase.from('api_usage').update({ remaining_count: 500, last_reset_date: today }).eq('id', 'gemini_stock_daily');
    } else if (!globalUsage) {
      // 레코드가 없으면 새로 생성
      await supabase.from('api_usage').upsert({ id: 'gemini_stock_daily', remaining_count: 500, last_reset_date: today });
    }

    const userCount = userUsage ? userUsage.count : 0;
    
    if (globalRemaining <= 0) {
      return new Response(JSON.stringify({ error: "시스템 에너지가 부족합니다.", user_remaining: 5 - userCount }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    if (userCount >= 5) {
      return new Response(JSON.stringify({ error: "오늘 분석 횟수(5회)를 모두 사용하셨습니다.", user_remaining: 0 }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    // [2] 캐시 확인 (30일 TTL)
    const { data: cachedResult } = await supabase
      .from('stock_analysis_cache')
      .select('result, created_at')
      .eq('company_name', cleanName)
      .maybeSingle();

    if (cachedResult) {
      const cacheAge = Date.now() - new Date(cachedResult.created_at).getTime();
      const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30일

      if (cacheAge < CACHE_TTL) {
        // 유효한 캐시 → 바로 반환
        const newUserCount = userCount + 1;
        try {
          await supabase.from('user_stock_api_usage').upsert({ user_ip: userIP, usage_date: today, count: newUserCount });
        } catch (dbError) {
          console.error('Cache Quota Update Error:', dbError);
        }

        return new Response(JSON.stringify({
          ...cachedResult.result,
          is_cached: true,
          cache_date: cachedResult.created_at,
          user_remaining: 5 - newUserCount,
          model: "Cached"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      // 30일 초과 → 캐시 만료, 아래에서 재분석 진행
    }

    const systemPrompt = `당신은 대한민국 주식 시장(KOSPI, KOSDAQ)의 모든 종목을 꿰뚫고 있는 '오일전문가'의 AI 비서입니다. 
사용자가 입력하는 기업명은 이미 검색 포털에서 검증된 실존 종목들입니다. 설령 당신의 학습 데이터에 생소하더라도, 검색 포털에서 즉시 확인 가능한 상장사라면 절대 "존재하지 않는다"고 오판하지 말고 최신 시장 데이터를 바탕으로 분석을 완수하세요.

**채점 규칙 및 JSON 키 값:**
1. per (20점): <5(20), <8(15), <10(10), >10(5)
2. pbr (5점): <0.3(5), <0.6(4), <1.0(3), >1.0(0)
3. sustainability (5점): 이익 지속 가능(5), 불안정(0)
4. double_listing (5점): 단독 상장(5), 중복 상장(0)
5. dividend_yield (10점): >7%(10), >5%(7), >3%(5), <3%(2)
6. quarterly_dividend (5점): 예(5), 아니오(0)
7. dividend_growth (5점): 10년 이상(5), 5년 이상(4), 3년 이상(3), 해당 없음(0)
8. buyback_cancellation (7점): 예(7), 아니오(0)
9. cancellation_ratio (8점): >2%(8), >1.5%(5), >0.5%(3), <0.5%(0)
10. treasury_ratio (5점): 없음(5), <2%(4), <5%(2), >5%(0)
11. growth (10점): 매우 높다(10), 높다(7), 보통(5), 낮음(3)
12. management (10점): 우수한경영자(10), 전문 경영자(5), 오너리스크(0)
13. brand (5점): 있다(5), 없다(0)

**응답 형식 (JSON):**
{
  "name": "기업명",
  "scores": {
    "per": {"val": "수치", "opt": "선택지", "score": 점수},
    "pbr": {"val": "수치", "opt": "선택지", "score": 점수},
    "sustainability": {"opt": "선택지", "score": 점수},
    "double_listing": {"opt": "선택지", "score": 점수},
    "dividend_yield": {"val": "수치", "opt": "선택지", "score": 점수},
    "quarterly_dividend": {"opt": "선택지", "score": 점수},
    "dividend_growth": {"opt": "선택지", "score": 점수},
    "buyback_cancellation": {"opt": "선택지", "score": 점수},
    "cancellation_ratio": {"opt": "선택지", "score": 점수},
    "treasury_ratio": {"opt": "선택지", "score": 점수},
    "growth": {"opt": "선택지", "score": 점수},
    "management": {"opt": "선택지", "score": 점수},
    "brand": {"opt": "선택지", "score": 점수}
  }
}

**중요 규칙:**
- 위 13개 키 이름을 토씨 하나 틀리지 않고 그대로 사용해야 합니다.
- 선택한 옵션(opt)과 점수(score)는 채점 규칙과 일치해야 합니다.
- 본 서비스는 한국 상장 종목(KOSPI/KOSDAQ)만 지원합니다. 만약 입력된 기업이 한국 거래소(KOSPI, KOSDAQ)에 상장되지 않은 해외 기업(예: Apple, Tesla, Coca-Cola, NVIDIA 등 NYSE/NASDAQ/해외 거래소 상장 종목)인 경우, 반드시 아래 형식으로 응답하세요:
{"error": true, "message": "현재 한국 상장 종목(KOSPI/KOSDAQ)만 지원합니다. 해외 종목 분석은 추후 업데이트 예정입니다."}
- 만약 입력된 기업명이 실제 상장 기업이 아니거나, 존재하지 않는 기업이거나, 의미 없는 단어(예: 욕설, 숫자, 장난 등)인 경우 반드시 아래 형식으로 응답하세요:
{"error": true, "message": "존재하지 않는 기업입니다."}
- 절대로 존재하지 않는 기업에 대해 점수를 지어내지 마세요.`;

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

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`AI 서버 응답 오류 (Status: ${apiResponse.status}). 모델 설정을 확인 중입니다.`);
    }

    const aiData = await apiResponse.json();
    
    if (!aiData.candidates || aiData.candidates.length === 0 || !aiData.candidates[0].content) {
      throw new Error('AI가 답변을 생성할 수 없습니다.');
    }

    const responseText = aiData.candidates[0].content.parts[0].text;
    const resultJson = JSON.parse(responseText);

    // [3] AI가 존재하지 않는 기업이라고 판단한 경우 에러 반환
    if (resultJson.error === true || !resultJson.scores) {
      return new Response(JSON.stringify({ 
        error: resultJson.message || '해당 기업을 찾을 수 없습니다. 정확한 기업명을 입력해 주세요.' 
      }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // [4] 데이터 저장 (upsert: 만료된 캐시 갱신 대응)
    const newUserCount = userCount + 1;
    try {
      await Promise.all([
        supabase.from('stock_analysis_cache').upsert({ company_name: cleanName, result: resultJson, created_at: new Date().toISOString() }, { onConflict: 'company_name' }),
        supabase.from('api_usage').update({ remaining_count: globalRemaining - 1 }).eq('id', 'gemini_stock_daily'),
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
      error: error.message || '분석 중 오류가 발생했습니다.'
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
