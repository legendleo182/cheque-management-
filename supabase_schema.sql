-- ========================================================
-- CHEQUE MANAGEMENT SYSTEM - SUPABASE DATABASE SCHEMA
-- For Reliable Drapes (RD) & Shree Ambica Furnishings (SAF)
-- ========================================================

-- 1. Create Cheques Table
CREATE TABLE IF NOT EXISTS public.cheques (
    id TEXT PRIMARY KEY,
    firm TEXT NOT NULL DEFAULT 'RD', -- 'RD' or 'SAF'
    module_type TEXT NOT NULL DEFAULT 'CLEARING', -- 'CLEARING', 'HOLD', 'RETURNED'
    sr_no INTEGER,
    cheque_number TEXT NOT NULL,
    party_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    branch TEXT DEFAULT '',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cheque_date TEXT,
    clearing_date TEXT,
    sent_to_bank_date TEXT,
    actual_clear_date TEXT,
    hold_date TEXT,
    hold_reason TEXT,
    instruction_by TEXT,
    return_date TEXT,
    return_reason TEXT,
    action_taken TEXT,
    recovery_status TEXT DEFAULT 'UNRESOLVED',
    status TEXT NOT NULL DEFAULT 'SENT_FOR_CLEARING',
    cheque_photo TEXT,
    receipt_photo TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for High-Speed Filtering
CREATE INDEX IF NOT EXISTS idx_cheques_firm ON public.cheques(firm);
CREATE INDEX IF NOT EXISTS idx_cheques_module_type ON public.cheques(module_type);
CREATE INDEX IF NOT EXISTS idx_cheques_status ON public.cheques(status);
CREATE INDEX IF NOT EXISTS idx_cheques_party_name ON public.cheques(party_name);
CREATE INDEX IF NOT EXISTS idx_cheques_number ON public.cheques(cheque_number);
CREATE INDEX IF NOT EXISTS idx_cheques_clearing_date ON public.cheques(clearing_date);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;

-- 4. Public Access Policy (Allows reading and writing from backend and client)
DROP POLICY IF EXISTS "Allow full access to cheques" ON public.cheques;
CREATE POLICY "Allow full access to cheques" 
ON public.cheques 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Optional Storage Bucket for Photos (Uncomment if needed)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('cheque-photos', 'cheque-photos', true)
-- ON CONFLICT (id) DO NOTHING;
