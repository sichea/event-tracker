-- 시장 인사이트 테이블 (항상 1행만 유지)
CREATE TABLE IF NOT EXISTS public.market_insights (
    id TEXT PRIMARY KEY DEFAULT 'current',
    scenario TEXT NOT NULL DEFAULT 'rate_cut',
    kr_rate NUMERIC,
    us_rate NUMERIC,
    us_cpi NUMERIC,
    us_gdp NUMERIC,
    kr_rate_prev NUMERIC,
    us_rate_prev NUMERIC,
    news JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 누구나 읽을 수 있도록 RLS 설정
ALTER TABLE public.market_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market insights" ON public.market_insights
    FOR SELECT USING (true);
