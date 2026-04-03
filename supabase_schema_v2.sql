-- 1. 새로운 별명(계좌) 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_aliases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name)
);

-- 2. 새 테이블 보안(RLS) 정책 설정
ALTER TABLE public.user_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own aliases" ON public.user_aliases
    FOR ALL USING (auth.uid() = user_id);

-- 3. 기존 user_events(참여 상태 보관) 테이블 초기화 및 스키마 변경
-- (기존에 0회 참여하셨을 테니 초기화 후 재구성하는 것이 안전합니다)
TRUNCATE TABLE public.user_events;

-- 4. 기존 제약조건 삭제 및 새로운 별명 컬럼 추가
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_user_id_event_id_key;
ALTER TABLE public.user_events ADD COLUMN IF NOT EXISTS alias_id UUID REFERENCES public.user_aliases(id) ON DELETE CASCADE;

-- 5. 계좌별 참여 상태 저장을 위한 새로운 복합 유니크 키 생성
ALTER TABLE public.user_events ADD CONSTRAINT user_events_user_id_event_id_alias_id_key UNIQUE (user_id, event_id, alias_id);
