-- 알림 발송 기록 테이블 (중복 발송 방지용)
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_id TEXT NOT NULL,          -- 이벤트 ID 또는 공모주 ID
    target_type TEXT NOT NULL,        -- 'etf_event', 'ipo_event'
    category TEXT NOT NULL,           -- 'new', 'deadline', 'start', 'listing'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- 동일 유저에게 동일 조건의 알림이 중복 저장되지 않도록 유니크 제약
    UNIQUE(user_id, target_id, category)
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_notif_logs_user_target ON public.notification_logs(user_id, target_id);

-- RLS 보안 설정
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 관리자(서비스 키)만 모든 로그를 다루고, 유저는 자신의 로그만 볼 수 있게 설정 (사실 백엔드 전용이라 크게 필요는 없지만 보안상 추가)
CREATE POLICY "Users can view their own notification logs" ON public.notification_logs
    FOR SELECT USING (auth.uid() = user_id);
