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
    if (userCount >= 1000) {
      return new Response(JSON.stringify({ error: "오늘 분석 횟수(1000회)를 모두 사용하셨습니다.", user_remaining: 0 }), { status: 429 });
    }

**채점 규칙 (반드시 준수):**
1. PER (20점): <5(20), <8(15), <10(10), >10(5)
2. PBR (5점): <0.3(5), <0.6(4), <1.0(3), >1.0(0)
3. 이익지속성 (5점): 대체로 지속 가능(5), 불안정한 이익 창출력(0)
4. 중복상장 (5점): 단독 상장(5), 중복 상장(0)
5. 배당수익률 (10점): >7%(10), >5%(7), >3%(5), <3%(2)
6. 분기배당 (5점): 예(5), 아니오(0)
7. 배당연속인상 (5점): 10년 이상(5), 5년 이상(4), 3년 이상(3), 해당 없음(0)
8. 자사주 매입/소각 (7점): 예(7), 아니오(0)
9. 연간소각비율 (8점): >2%(8), >1.5%(5), >0.5%(3), <0.5%(0)
10. 자사주보유비율 (5점): 없음(5), <2%(4), <5%(2), >5%(0)
11. 미래성장성 (10점): 매우 높다(10), 높다(7), 보통(5), 낮음(3)
12. 기업경영 (10점): 우수한경영자(10), 전문 경영자(5), 오너리스크(0)
13. 세계적브랜드 (5점): 있다(5), 없다(0)

**응답 형식 (JSON):**
{
  "name": "기업명",
  "scores": {
    "per": {"val": "수치", "opt": "선택지", "score": 점수},
    ... (위 13개 키 모두 포함)
  }
}

**주의:** 선택한 옵션(opt)과 부여한 점수(score)가 위 채점 규칙과 반드시 일치해야 합니다.`;

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
