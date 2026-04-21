-- 아파트 청약 일정 테이블
CREATE TABLE IF NOT EXISTS public.apt_subscriptions (
    id TEXT PRIMARY KEY,
    region TEXT NOT NULL,              -- 지역 (서울, 경기 등)
    housing_type TEXT,                 -- 주택구분 (민영, 국민)
    sale_type TEXT,                    -- 분양/임대
    name TEXT NOT NULL,                -- 주택명
    constructor TEXT,                  -- 시공사
    contact TEXT,                      -- 문의처
    announcement_date DATE,            -- 모집공고일
    subscription_start DATE,           -- 청약 시작일
    subscription_end DATE,             -- 청약 종료일
    winner_date DATE,                  -- 당첨자 발표일
    is_lotto BOOLEAN DEFAULT FALSE,    -- 로또 청약 여부
    lotto_reason TEXT,                 -- 로또 청약 판정 사유
    status TEXT DEFAULT '청약예정',     -- 청약예정/청약중/청약마감
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 누구나 읽을 수 있도록 RLS 설정
ALTER TABLE public.apt_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read apt subscriptions" ON public.apt_subscriptions
    FOR SELECT USING (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_apt_subs_status ON public.apt_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_apt_subs_region ON public.apt_subscriptions(region);
CREATE INDEX IF NOT EXISTS idx_apt_subs_lotto ON public.apt_subscriptions(is_lotto);
