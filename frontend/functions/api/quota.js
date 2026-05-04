import { createClient } from '@supabase/supabase-js';

/**
 * [Zero-Cost Quota Check] Cloudflare Pages Function: /api/quota
 * 사용자의 현재 IP를 기반으로 남은 분석 횟수 정보를 반환합니다.
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const userIP = request.headers.get('CF-Connecting-IP') || 'anonymous';

    const [{ data: globalData }, { data: userData }] = await Promise.all([
      supabase.from('api_usage').select('remaining_count').eq('id', 'gemini_daily').maybeSingle(),
      supabase.from('user_api_usage').select('count').eq('user_ip', userIP).eq('usage_date', today).maybeSingle()
    ]);

    return new Response(JSON.stringify({
      global_remaining: globalData ? globalData.remaining_count : 500,
      user_remaining: 50 - (userData ? userData.count : 0)
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ global_remaining: 500, user_remaining: 50 }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
