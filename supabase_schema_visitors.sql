-- 방문자 카운터 테이블
CREATE TABLE IF NOT EXISTS site_visitors (
  id TEXT PRIMARY KEY DEFAULT 'counter',
  today_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입
INSERT INTO site_visitors (id, today_count, total_count, last_reset_date)
VALUES ('counter', 0, 0, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- RLS 설정
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있음
CREATE POLICY "Public read access" ON site_visitors
  FOR SELECT USING (true);

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "Authenticated update" ON site_visitors
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 방문자 수를 증가시키는 함수
CREATE OR REPLACE FUNCTION increment_visitor()
RETURNS void AS $$
DECLARE
  current_reset_date DATE;
BEGIN
  SELECT last_reset_date INTO current_reset_date FROM site_visitors WHERE id = 'counter';
  
  IF current_reset_date < CURRENT_DATE THEN
    -- 날짜가 바뀌었으면 오늘 카운트 리셋
    UPDATE site_visitors 
    SET today_count = 1, 
        total_count = total_count + 1, 
        last_reset_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = 'counter';
  ELSE
    -- 같은 날이면 카운트만 증가
    UPDATE site_visitors 
    SET today_count = today_count + 1, 
        total_count = total_count + 1,
        updated_at = NOW()
    WHERE id = 'counter';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
