import { createClient } from '@supabase/supabase-js';

/**
 * [Zero-Cost Quota Check] Cloudflare Pages Function: /api/quota
 * 사용자의 현재 IP를 기반으로 통찰력 + 판독기 각각의 남은 분석 횟수를 반환합니다.
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const userIP = request.headers.get('CF-Connecting-IP') || 'anonymous';

    const [{ data: globalData }, { data: stockGlobalData }, { data: userData }, { data: stockUserData }] = await Promise.all([
      // 통찰력 글로벌 쿼터
      supabase.from('api_usage').select('remaining_count').eq('id', 'gemini_daily').maybeSingle(),
      // 판독기 글로벌 쿼터
      supabase.from('api_usage').select('remaining_count').eq('id', 'gemini_stock_daily').maybeSingle(),
      // 통찰력 사용자 쿼터
      supabase.from('user_api_usage').select('count').eq('user_ip', userIP).eq('usage_date', today).maybeSingle(),
      // 판독기 사용자 쿼터
      supabase.from('user_stock_api_usage').select('count').eq('user_ip', userIP).eq('usage_date', today).maybeSingle()
    ]);

    return new Response(JSON.stringify({
      // 통찰력
      global_remaining: globalData ? globalData.remaining_count : 500,
      user_remaining: 5 - (userData ? userData.count : 0),
      // 판독기
      stock_global_remaining: stockGlobalData ? stockGlobalData.remaining_count : 500,
      stock_user_remaining: 5 - (stockUserData ? stockUserData.count : 0)
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      global_remaining: 500, user_remaining: 5,
      stock_global_remaining: 500, stock_user_remaining: 5
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
