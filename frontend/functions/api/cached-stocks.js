import { createClient } from '@supabase/supabase-js';

/**
 * [Cached Stocks List] Cloudflare Pages Function: /api/cached-stocks
 * Fetches all stock analysis results stored in stock_analysis_cache.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  try {
    // 이번 달 1일 00:00:00 이후에 판독된 종목만 조회 (매월 리셋 적용)
    const now = new Date();
    const limitDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const limitIso = limitDate.toISOString();

    const { data, error } = await supabase
      .from('stock_analysis_cache')
      .select('company_name, result, created_at')
      .gte('created_at', limitIso)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify(data || []), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error fetching cached stocks:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
