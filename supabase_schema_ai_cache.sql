-- AI 분석 결과 캐싱을 위한 테이블
CREATE TABLE IF NOT EXISTS public.ai_analysis_cache (
    scenario_hash TEXT PRIMARY KEY, -- 검색어의 해시 또는 검색어 자체
    scenario_text TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 인덱스 추가 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_ai_cache_scenario ON public.ai_analysis_cache(scenario_text);

-- RLS 설정
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read AI cache" ON public.ai_analysis_cache FOR SELECT USING (true);
