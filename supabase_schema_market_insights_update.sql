-- market_insights 테이블에 추천 종목 및 주의 종목 컬럼 추가
ALTER TABLE market_insights 
ADD COLUMN IF NOT EXISTS recommended_assets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS caution_assets JSONB DEFAULT '[]'::jsonb;

-- 기존 데이터 업데이트 (선택 사항)
UPDATE market_insights SET recommended_assets = '[]'::jsonb, caution_assets = '[]'::jsonb WHERE recommended_assets IS NULL;
