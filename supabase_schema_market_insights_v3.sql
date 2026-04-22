-- market_insights 테이블 구조 업데이트 (v3)
-- 수익률 기준일 및 모든 시나리오 통합 데이터 컬럼 추가
ALTER TABLE market_insights 
ADD COLUMN IF NOT EXISTS yield_date TEXT,
ADD COLUMN IF NOT EXISTS all_scenarios_data JSONB DEFAULT '{}'::jsonb;

-- 기존 데이터 초기화
UPDATE market_insights 
SET all_scenarios_data = '{}'::jsonb 
WHERE all_scenarios_data IS NULL;
