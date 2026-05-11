import { createClient } from '@supabase/supabase-js';

/**
 * [Stock Analysis AI] Cloudflare Pages Function: /api/analyze-stock
 * 오일전문가 기준 저평가 우량주 판독 백엔드
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 환경변수 검증
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "서버 설정 오류: DB 연결 정보가 없습니다." }), { status: 500 });
  }
  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "서버 설정 오류: AI API 키가 설정되지 않았습니다." }), { status: 500 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const GEMINI_API_KEY = env.GEMINI_API_KEY;

  try {
    const { name } = await request.json();
    const cleanName = name ? name.trim() : "";
    if (!cleanName) return new Response(JSON.stringify({ error: "기업명을 입력해주세요." }), { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    const userIP = request.headers.get('CF-Connecting-IP') || 'anonymous';

    // [1] 캐시 확인 (최근 7일 이내 데이터)
    try {
      const { data: cachedResult } = await supabase
        .from('stock_analysis_cache')
        .select('result, created_at')
        .eq('company_name', cleanName)
        .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
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
    } catch (cacheErr) {
      console.error('Cache check failed (continuing):', cacheErr);
    }

    // [2] 쿼터 확인 (사용자당 일 5회)
    let userCount = 0;
    try {
      const { data: userUsage } = await supabase
        .from('user_stock_api_usage')
        .select('count')
        .eq('user_ip', userIP)
        .eq('usage_date', today)
        .maybeSingle();
      userCount = userUsage ? userUsage.count : 0;
    } catch (quotaErr) {
      console.error('Quota check failed (continuing):', quotaErr);
    }

    if (userCount >= 5) {
      return new Response(JSON.stringify({ error: "오늘 분석 횟수(5회)를 모두 사용하셨습니다." }), { status: 429 });
    }

    // [3] AI 호출 (Gemini 2.5 Flash + Google Search Grounding)
    const systemPrompt = `당신은 '오일전문가'의 투자 철학을 가진 전문 퀀트 분석가입니다.
반드시 Google Search를 활용하여 해당 기업의 최신 재무 지표와 최근 1년 내 공시를 확인한 후 분석하세요.

**분석 필수 항목 및 채점 기준:**
1. PER (20점): <5(20), <8(15), <10(10), >10(5)
2. PBR (5점): <0.3(5), <0.6(4), <1.0(3), >1.0(0)
3. 이익지속가능성 (5점): 대체로 지속 가능(5), 불안정한 이익 창출력(0)
4. 중복상장여부 (5점): 단독 상장(5), 중복 상장(0)
5. 배당수익률 (10점): >7%(10), >5%(7), >3%(5), <3%(2)
6. 분기배당실시여부 (5점): 예(5), 아니오(0)
7. 배당연속인상연수 (5점): 10년 이상(5), 5년 이상(4), 3년 이상(3), 해당 없음(0)
8. 정기적자사주 매입/소각 (7점): 예(7), 아니오(0)
9. 연간소각비율 (8점): >2%(8), >1.5%(5), >0.5%(3), <0.5%(0)
10. 자사주보유비율 (5점): 없음(5), <2%(4), <5%(2), >5%(0)
11. 미래 성장 잠재력 (10점): 매우 높다(10), 높다(7), 보통(5), 낮다(3)
12. 기업경영 (10점): 우수한경영자(10), 전문 경영자(5), 저조한 실적 오너 경영(0)
13. 세계적브랜드 보유 (5점): 있다(5), 없다(0)

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
{
  "name": "기업명",
  "scores": {
    "per": {"val": "실제PER수치", "opt": "해당선택지", "score": 점수},
    "pbr": {"val": "실제PBR수치", "opt": "해당선택지", "score": 점수},
    "sustainability": {"val": "근거설명", "opt": "해당선택지", "score": 점수},
    "double_listing": {"val": "근거설명", "opt": "해당선택지", "score": 점수},
    "dividend_yield": {"val": "실제배당률%", "opt": "해당선택지", "score": 점수},
    "quarterly_dividend": {"val": "실시여부설명", "opt": "해당선택지", "score": 점수},
    "dividend_growth": {"val": "연속인상연수", "opt": "해당선택지", "score": 점수},
    "buyback_cancellation": {"val": "실시여부설명", "opt": "해당선택지", "score": 점수},
    "cancellation_ratio": {"val": "소각비율%", "opt": "해당선택지", "score": 점수},
    "treasury_ratio": {"val": "보유비율%", "opt": "해당선택지", "score": 점수},
    "growth": {"val": "근거설명", "opt": "해당선택지", "score": 점수},
    "management": {"val": "근거설명", "opt": "해당선택지", "score": 점수},
    "brand": {"val": "근거설명", "opt": "해당선택지", "score": 점수}
  }
}`;

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `${systemPrompt}\n\n분석 대상 기업: ${cleanName}` 
          }] 
        }],
        tools: [{ google_search_retrieval: {} }],
        generationConfig: { temperature: 0.1 }
      })
    });

    const aiData = await apiResponse.json();

    // 디버깅: AI 응답 구조 확인
    if (!apiResponse.ok) {
      console.error('Gemini API error:', JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: `AI API 오류: ${aiData.error?.message || '알 수 없는 오류'}` }), { status: 502 });
    }

    if (!aiData.candidates?.[0]?.content?.parts) {
      console.error('Unexpected AI response:', JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI 응답 형식 오류. 다시 시도해주세요." }), { status: 502 });
    }

    // google_search_retrieval 사용 시 여러 parts가 올 수 있음 - 텍스트 부분만 추출
    const textParts = aiData.candidates[0].content.parts.filter(p => p.text);
    const fullText = textParts.map(p => p.text).join('');
    
    // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
    let jsonStr = fullText;
    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // 순수 JSON인 경우 첫 번째 { 부터 마지막 } 까지 추출
      const startIdx = fullText.indexOf('{');
      const endIdx = fullText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = fullText.substring(startIdx, endIdx + 1);
      }
    }

    let resultJson;
    try {
      resultJson = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw text:', fullText);
      return new Response(JSON.stringify({ error: "AI 응답 파싱 실패. 다시 시도해주세요." }), { status: 502 });
    }

    // [4] 결과 저장 (캐시 및 사용량) - 실패해도 결과는 반환
    try {
      await Promise.all([
        supabase.from('stock_analysis_cache').upsert([{ company_name: cleanName, result: resultJson }]),
        supabase.from('user_stock_api_usage').upsert({ user_ip: userIP, usage_date: today, count: userCount + 1 })
      ]);
    } catch (saveErr) {
      console.error('Cache/usage save failed (continuing):', saveErr);
    }

    return new Response(JSON.stringify({
      ...resultJson,
      is_cached: false,
      model: "Gemini 2.5 Flash"
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Stock analysis error:', error);
    return new Response(JSON.stringify({ error: `분석 중 오류: ${error.message}` }), { status: 500 });
  }
}
