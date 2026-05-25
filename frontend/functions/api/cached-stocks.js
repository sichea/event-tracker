import { createClient } from '@supabase/supabase-js';

/**
 * [Cached Stocks List] Cloudflare Pages Function: /api/cached-stocks
 * Fetches all stock analysis results stored in stock_analysis_cache.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  try {
    // 90일 이내에 판독된 종목만 조회 (기업 분기 실적 보고서 주기 고려)
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 90);
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
