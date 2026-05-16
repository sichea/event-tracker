-- Create user_ipo_reports table
CREATE TABLE IF NOT EXISTS public.user_ipo_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stock_name TEXT NOT NULL,
    profit NUMERIC DEFAULT 0,
    return_rate NUMERIC DEFAULT 0,
    sell_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure user can only see their own reports
    CONSTRAINT user_ipo_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.user_ipo_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own reports"
    ON public.user_ipo_reports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports"
    ON public.user_ipo_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
    ON public.user_ipo_reports FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
    ON public.user_ipo_reports FOR DELETE
    USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_ipo_reports_user_id ON public.user_ipo_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ipo_reports_sell_date ON public.user_ipo_reports(sell_date);
