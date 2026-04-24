-- 파킹통장 및 CMA 금리 정보를 저장하기 위한 테이블
CREATE TABLE IF NOT EXISTS public.parking_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'parking' or 'cma'
    institution VARCHAR(100) NOT NULL, -- 은행/증권사 명
    product_name VARCHAR(200) NOT NULL, -- 상품명
    base_rate DECIMAL(5,2) NOT NULL, -- 기본 금리
    max_rate DECIMAL(5,2) NOT NULL, -- 최고 금리
    description TEXT, -- 상세 조건
    tag VARCHAR(50), -- '최고금리', '무조건' 등의 태그
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 설정 - 모든 사용자 읽기 가능
ALTER TABLE public.parking_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.parking_rates FOR SELECT USING (true);
