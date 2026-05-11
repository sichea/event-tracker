-- 저평가 우량주 판독기용 캐시 및 사용량 관리 테이블

-- 1. 종목 분석 캐시 테이블
CREATE TABLE IF NOT EXISTS public.stock_analysis_cache (
    company_name TEXT PRIMARY KEY,
    result JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 사용자별 일일 사용량 테이블
CREATE TABLE IF NOT EXISTS public.user_stock_api_usage (
    user_ip TEXT NOT NULL,
    usage_date DATE NOT NULL,
    count INTEGER DEFAULT 1,
    PRIMARY KEY (user_ip, usage_date)
);

-- RLS 설정 (모두 읽기/쓰기 허용 - 서비스 키로만 접근하므로 안전)
ALTER TABLE public.stock_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service key" ON public.stock_analysis_cache USING (true) WITH CHECK (true);

ALTER TABLE public.user_stock_api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service key" ON public.user_stock_api_usage USING (true) WITH CHECK (true);
