-- 1. 이벤트 데이터용 테이블
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    d_day INTEGER,
    status TEXT NOT NULL,
    link TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 유저별 이벤트 참여 상태 기록용 테이블
CREATE TABLE IF NOT EXISTS public.user_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, event_id)
);

-- 3. Row Level Security(RLS) 설정 활성화
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책(Policies)
-- 누구나(익명 포함) 공통 이벤트 목록 읽기 가능
CREATE POLICY "Anyone can read events" ON public.events
    FOR SELECT USING (true);

-- 유저 상태 기록은 오직 '로그인한 본인'만 조회/생성/삭제 가능
CREATE POLICY "Users can manage their own interaction" ON public.user_events
    FOR ALL USING (auth.uid() = user_id);

-- 서버(API 키 보유)에서만 events 테이블 삽입/수정이 가능하도록 하는 정책은 기본적으로 Service Role을 통하므로 위반 안됨.
