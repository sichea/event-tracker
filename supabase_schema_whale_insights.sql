-- whale_insights 테이블 생성
CREATE TABLE IF NOT EXISTS whale_insights (
    id TEXT PRIMARY KEY, -- 'current' 한 줄만 관리
    dart JSONB DEFAULT '[]'::jsonb,
    nps JSONB DEFAULT '[]'::jsonb,
    legends JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입 (없을 경우에만)
INSERT INTO whale_insights (id, dart, nps, legends)
VALUES ('current', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
