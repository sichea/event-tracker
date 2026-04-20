-- IPO(공모주) 일정 테이블
CREATE TABLE IF NOT EXISTS public.ipo_events (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    subscription_start TEXT,
    subscription_end TEXT,
    listing_date TEXT,
    confirmed_price TEXT,
    desired_price TEXT,
    competition_rate TEXT,
    lead_manager TEXT,
    min_subscription_amount BIGINT,
    status TEXT DEFAULT '청약예정',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 설정
ALTER TABLE public.ipo_events ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read ipo_events" ON public.ipo_events
    FOR SELECT USING (true);
