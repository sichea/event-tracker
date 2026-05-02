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
        user_remaining: 5 - uCount,
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
      return new Response(JSON.stringify({ error: "시스템 에너지가 부족합니다.", user_remaining: 5 - userCount }), { status: 429 });
    }
    if (userCount >= 5) {
      return new Response(JSON.stringify({ error: "내 에너지가 부족합니다. (일 5회)", user_remaining: 0 }), { status: 429 });
    }

    // [3] AI 호출
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `투자 전문가로서 JSON으로 분석해줘: ${cleanScenario}\n형식: {steps:[], sector:"", stocks:[{name:"", reason:""}], caution:[], advice:""}` }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.7 }
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
      user_remaining: 5 - newUserCount,
      model: "Gemini 2.5 Flash"
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "분석 실패", details: error.message }), { status: 500 });
  }
}
