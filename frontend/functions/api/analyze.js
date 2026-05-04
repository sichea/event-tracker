import { createClient } from '@supabase/supabase-js';

/**
 * [Final Hybrid AI] Cloudflare Pages Function: /api/analyze
 * 1. 캐싱: 비용 0원
 * 2. 시스템 쿼터: 500회
 * 3. 개인 쿼터: IP당 5회 (잔여 횟수 반환 추가)
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const GEMINI_API_KEY = env.GEMINI_API_KEY;

  try {
    const { scenario } = await request.json();
    const cleanScenario = scenario ? scenario.trim() : "";
    const today = new Date().toISOString().split('T')[0];
    const userIP = request.headers.get('CF-Connecting-IP') || 'anonymous';

    // [1] 캐시 확인
    const { data: cachedResult } = await supabase
      .from('ai_analysis_cache')
      .select('result')
      .eq('scenario_text', cleanScenario)
      .maybeSingle();

    if (cachedResult) {
      // 캐시 히트 시에는 사용자의 횟수를 차감하지 않고 반환
      // (단, UI 동기화를 위해 현재 사용량 정보는 가져옴)
      const { data: uUsage } = await supabase
        .from('user_api_usage')
        .select('count')
        .eq('user_ip', userIP)
        .eq('usage_date', today)
        .maybeSingle();
      
      const uCount = uUsage ? uUsage.count : 0;

      return new Response(JSON.stringify({
        ...cachedResult.result,
        is_cached: true,
        user_remaining: 50 - uCount,
        model: "Cached"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // [2] 쿼터 확인
    const [{ data: globalUsage }, { data: userUsage }] = await Promise.all([
      supabase.from('api_usage').select('*').eq('id', 'gemini_daily').single(),
      supabase.from('user_api_usage').select('count').eq('user_ip', userIP).eq('usage_date', today).maybeSingle()
    ]);

    let globalRemaining = globalUsage ? globalUsage.remaining_count : 500;
    if (globalUsage && globalUsage.last_reset_date !== today) {
      globalRemaining = 500;
      await supabase.from('api_usage').update({ remaining_count: 500, last_reset_date: today }).eq('id', 'gemini_daily');
    }

    const userCount = userUsage ? userUsage.count : 0;
    
    // 에러 응답 시에도 현재 남은 횟수를 알려줌
    if (globalRemaining <= 0) {
      return new Response(JSON.stringify({ error: "시스템 에너지가 부족합니다.", user_remaining: 50 - userCount }), { status: 429 });
    }
    if (userCount >= 50) {
      return new Response(JSON.stringify({ error: "내 에너지가 부족합니다. (일 50회)", user_remaining: 0 }), { status: 429 });
    }

    // [3] AI 호출
    const systemPrompt = `당신은 글로벌 자산운용사의 시니어 거시경제 전략가(Senior Macro Strategist)입니다.
글로벌 기관 투자자들의 13F 공시 데이터, 역사적 자산 순환 사이클, 월스트리트의 리서치 데이터를 학습한 모델로서 분석을 수행하세요.

사용자가 입력한 특정 '사건' 또는 '시나리오'에 대해 다음과 같은 전문 투자자의 사고 체계로 분석하세요:
1. steps: 자금의 흐름이 변화하는 과정을 4~5단계의 전문적인 인과관계로 설명하세요. 단순히 표면적인 현상이 아니라, 시장 참여자들의 심리 변화와 자본의 2차, 3차 파생 효과(Second-order Effects)를 심도 있게 추적하세요.
2. sector: 대중이 간과하고 있지만 거대한 자본의 이동이 시작될 '숨겨진 수혜 섹터'를 선정하세요.
3. stocks: 해당 섹터 내에서 스마트 머니(기관/세력)가 매집 중이거나 구조적 성장이 확실시되는 종목 3개를 한국/글로벌 균형 있게 추천하세요. 뻔한 대형주보다는 펀더멘털의 변곡점에 서 있는 종목을 발굴하세요.
4. caution: 대중이 열광할 때 나타나는 '심리적 함정'이나 시장이 간과하고 있는 결정적 리스크 변수 2개를 지적하세요.
5. advice: **[회심의 통찰]** 대중의 시각과 완전히 차별화되는 역발상적 제언을 한 문장으로 시작하여, 시장의 이면을 꿰뚫는 전략적 리포트를 작성하세요. 아무도 생각지 못한 날카로운 'Edge'를 반드시 포함하세요.

모든 답변은 한국어로 작성하며, 날카롭고 직관적이며 전문가다운 격조 있는 문체를 유지하세요. **강조를 위한 볼드체(**)나 기타 마크다운 기호는 절대 사용하지 마세요.** 오직 텍스트로만 답변하여 사용자에게 '머리를 탁 치는' 깨달음을 주는 것이 목표입니다.`;

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `${systemPrompt}\n\n사용자 시나리오: ${cleanScenario}\n\nJSON 형식으로만 응답하세요: {steps:[], sector:"", stocks:[{name:"", reason:""}], caution:[], advice:""}` 
          }] 
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.6 }
      })
    });

    const aiData = await apiResponse.json();
    const resultJson = JSON.parse(aiData.candidates[0].content.parts[0].text);

    // [4] 데이터 저장 및 업데이트
    const newUserCount = userCount + 1;
    await Promise.all([
      supabase.from('ai_analysis_cache').insert([{ scenario_text: cleanScenario, result: resultJson }]),
      supabase.from('api_usage').update({ remaining_count: globalRemaining - 1 }).eq('id', 'gemini_daily'),
      supabase.from('user_api_usage').upsert({ user_ip: userIP, usage_date: today, count: newUserCount })
    ]);

    return new Response(JSON.stringify({
      ...resultJson,
      is_cached: false,
      remaining: globalRemaining - 1,
      user_remaining: 50 - newUserCount,
      model: "Gemini 2.5 Flash"
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "분석 실패", details: error.message }), { status: 500 });
  }
}
