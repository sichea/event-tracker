-- 1. 공모주 청약 사용자 기록을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_ipo_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ipo_id TEXT REFERENCES public.ipo_events(id) ON DELETE CASCADE NOT NULL,
    alias_id UUID REFERENCES public.user_aliases(id) ON DELETE CASCADE NOT NULL,
    brokerage TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, ipo_id, alias_id, brokerage)
);

-- 2. 새 테이블 보안(RLS) 정책 설정
ALTER TABLE public.user_ipo_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ipo subscriptions" ON public.user_ipo_subscriptions
    FOR ALL USING (auth.uid() = user_id);
