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

    // [3] AI 호출 (Gemini 2.5 Flash + Real-time Search)
    const systemPrompt = `당신은 '오일전문가'의 투자 철학을 가진 전문 퀀트 분석가입니다.
반드시 **실시간 웹 검색(Google Search)**을 수행하여 해당 기업의 최신 재무 지표와 최근 1년 내 공시(배당, 자사주 소각 등)를 확인한 후 분석하세요.

**분석 필수 항목:**
1. PER/PBR: 최신 분기 실적 및 현재 주가 기준
2. 배당: 최근 결산 배당금 및 분기 배당 실시 여부, 연속 인상 연수
3. 자사주: 최근 1년 내 매입/소각 공시 금액 및 발행주식수 대비 비율
4. 기업 경영: 오너 리스크 여부 및 경영진 평가
5. 브랜드: 글로벌 시장 점유율 및 브랜드 인지도

**응답 형식 (반드시 다음 키 명칭을 엄격히 준수할 것):**
{
  "name": "기업명",
  "scores": {
    "per": {"val": "수치", "opt": "선택지", "score": 점수},
    "pbr": {"val": "수치", "opt": "선택지", "score": 점수},
    "sustainability": {"val": "설명", "opt": "선택지", "score": 점수},
    "double_listing": {"val": "설명", "opt": "선택지", "score": 점수},
    "dividend_yield": {"val": "수치%", "opt": "선택지", "score": 점수},
    "quarterly_dividend": {"val": "실시여부", "opt": "선택지", "score": 점수},
    "dividend_growth": {"val": "연수", "opt": "선택지", "score": 점수},
    "buyback_cancellation": {"val": "실시여부", "opt": "선택지", "score": 점수},
    "cancellation_ratio": {"val": "비율%", "opt": "선택지", "score": 점수},
    "treasury_ratio": {"val": "비율%", "opt": "선택지", "score": 점수},
    "growth": {"val": "설명", "opt": "선택지", "score": 점수},
    "management": {"val": "설명", "opt": "선택지", "score": 점수},
    "brand": {"val": "설명", "opt": "선택지", "score": 점수}
  },
  "links": [
    {"label": "네이버증권 상세", "url": "정확한 상세페이지 URL"},
    {"label": "DART 공시지표", "url": "DART 검색결과 URL"},
    {"label": "기업 분석 리포트", "url": "최신 뉴스 또는 리서치 URL"}
  ]
}

**주의:** '데이터 없음'이라는 답변은 절대 금지입니다. 검색을 통해 최대한 근접한 수치를 찾아내어 점수를 부여하세요.`;

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
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
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
