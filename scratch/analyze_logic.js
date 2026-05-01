export async function onRequestPost(context) {
  const { request, env } = context;

  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  const SB_URL = env.SUPABASE_URL;
  const SB_KEY = env.SUPABASE_SERVICE_KEY;

  if (!GEMINI_API_KEY || !SB_URL || !SB_KEY) {
    return new Response(JSON.stringify({ error: "서버 설정(API 키 또는 DB 설정)이 누락되었습니다." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { scenario } = await request.json();
    
    // --- 1. 쿼터 관리 로직 (PST 기준) ---
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
    let currentQuota = quotaData[0];

    // 날짜가 바뀌었으면 리셋
    if (currentQuota.last_reset_date !== pstDate) {
      currentQuota.remaining_count = 1500;
      currentQuota.last_reset_date = pstDate;
    }

    // 한도 초과 체크
    if (currentQuota.remaining_count <= 0) {
      return new Response(JSON.stringify({ 
        error: "일일 분석 한도를 모두 사용했습니다. 내일 다시 시도해주세요! (태평양 표준시 0시 리셋)",
        remaining: 0
      }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    // --- 2. Gemini 분석 수행 ---
    const SYSTEM_PROMPT = `당신은 전문 금융 시장 분석가입니다... (이하 생략 - 이전과 동일)`;
    // (실제 코드에서는 전체 프롬프트가 들어갑니다)

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "생략된 프롬프트..." }] }], // (실제로는 전체 내용 전달)
        generationConfig: { temperature: 0.7 }
      })
    });

    // --- 3. 쿼터 차감 및 DB 업데이트 ---
    const newCount = currentQuota.remaining_count - 1;
    await fetch(`${SB_URL}/rest/v1/api_usage?id=eq.gemini_daily`, {
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        remaining_count: newCount,
        last_reset_date: pstDate
      })
    });

    // 결과 반환 (남은 횟수 포함)
    // ... (이전 파싱 로직)
    return new Response(JSON.stringify({ ...resultJson, remaining: newCount }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    // ... (에러 처리)
  }
}
