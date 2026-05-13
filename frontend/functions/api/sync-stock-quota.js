import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(context) {
  const { env } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. 오늘 모든 사용자의 판독기 사용 횟수 합산
    const { data: usageData, error: usageError } = await supabase
      .from('user_stock_api_usage')
      .select('count')
      .eq('usage_date', today);

    if (usageError) throw usageError;

    const totalUsedToday = usageData.reduce((acc, curr) => acc + (curr.count || 0), 0);
    const newRemaining = 500 - totalUsedToday;

    // 2. 글로벌 쿼터 수치 보정
    const { error: updateError } = await supabase
      .from('api_usage')
      .upsert({ 
        id: 'gemini_stock_daily', 
        remaining_count: newRemaining, 
        last_reset_date: today 
      }, { onConflict: 'id' });

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
      success: true, 
      total_used: totalUsedToday, 
      new_remaining: newRemaining 
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
