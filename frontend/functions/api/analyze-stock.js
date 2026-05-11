import { createClient } from '@supabase/supabase-js';

/**
 * [Stock Analysis AI] Cloudflare Pages Function: /api/analyze-stock
 * 오일전문가 기준 저평가 우량주 판독 백엔드
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const GEMINI_API_KEY = env.GEMINI_API_KEY;

  try {
    const { name } = await request.json();
    const cleanName = name ? name.trim() : "";
    if (!cleanName) return new Response(JSON.stringify({ error: "기업명을 입력해주세요." }), { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    const userIP = request.headers.get('CF-Connecting-IP') || 'anonymous';

    // [1] 캐시 확인 (최근 7일 이내 데이터)
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

    // [2] 쿼터 확인 (사용자당 일 5회)
    const { data: userUsage } = await supabase
      .from('user_stock_api_usage')
      .select('count')
      .eq('user_ip', userIP)
      .eq('usage_date', today)
      .maybeSingle();

    const userCount = userUsage ? userUsage.count : 0;
    if (userCount >= 5) {
      return new Response(JSON.stringify({ error: "오늘 분석 횟수(5회)를 모두 사용하셨습니다." }), { status: 429 });
    }

    // [3] AI 호출 (Gemini 2.5 Flash)
    const systemPrompt = `당신은 '오일전문가'의 투자 철학을 완벽하게 학습한 가치투자 분석가입니다.
사용자가 입력한 '기업명'에 대해 다음 13가지 평가 기준을 바탕으로 [저평가 우량주] 여부를 판독하세요.

**평가 기준 및 가중치:**
1. PER (20점): <5(20), <8(15), <10(10), >10(5)
2. PBR (5점): <0.3(5), <0.6(4), <1.0(3), >1.0(0)
3. 이익지속가능성 (5점): 지속가능(5), 불안정(0)
4. 중복상장여부 (5점): 단독상장(5), 중복상장(0)
5. 배당수익률 (10점): >7%(10), >5%(7), >3%(5), <3%(2)
6. 분기배당여부 (5점): 실시(5), 미실시(0)
7. 배당연속인상 (5점): 10년+(5), 5년+(4), 3년+(3), 해당없음(0)
8. 자사주 매입/소각 (7점): 실시(7), 미실시(0)
9. 연간 소각비율 (8점): >2%(8), >1.5%(5), >0.5%(3), <0.5%(0)
10. 자사주 보유비율 (5점): 없음(5), <2%(4), <5%(2), >5%(0)
11. 미래 성장 잠재력 (10점): 매우높음(10), 높음(7), 보통(5), 낮음(3)
12. 기업 경영 (10점): 우수(10), 전문경영(5), 오너리스크(0)
13. 세계적 브랜드 (5점): 보유(5), 미보유(0)

**응답 형식 (JSON):**
{
  "name": "기업명",
  "scores": {
    "per": {"val": "실제값", "opt": "선택지텍스트", "score": 점수},
    ... (13개 항목 모두 포함)
  },
  "links": [
    {"label": "재무제표 (네이버증권)", "url": "https://finance.naver.com/item/main.naver?code=종목코드"},
    {"label": "공시정보 (DART)", "url": "https://dart.fss.or.kr/"},
    {"label": "최신 뉴스 분석", "url": "https://search.naver.com/search.naver?query=기업명+분석"}
  ]
}

**주의:** 
- 반드시 실시간 재무 지표와 최근 공시(자사주 소각 등)를 바탕으로 분석하세요.
- 종목 코드를 모를 경우 검색 결과에 기반하여 정확한 네이버 증권 링크를 생성하세요.
- JSON 형식으로만 응답하세요.`;

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `${systemPrompt}\n\n분석할 기업명: ${cleanName}` 
          }] 
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 }
      })
    });

    const aiData = await apiResponse.json();
    if (!aiData.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("AI 응답 오류");

    const resultJson = JSON.parse(aiData.candidates[0].content.parts[0].text);

    // [4] 결과 저장 (캐시 및 사용량)
    await Promise.all([
      supabase.from('stock_analysis_cache').upsert([{ company_name: cleanName, result: resultJson }]),
      supabase.from('user_stock_api_usage').upsert({ user_ip: userIP, usage_date: today, count: userCount + 1 })
    ]);

    return new Response(JSON.stringify({
      ...resultJson,
      is_cached: false,
      model: "Gemini 2.5 Flash"
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Stock analysis error:', error);
    return new Response(JSON.stringify({ error: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }), { status: 500 });
  }
}
