CREATE TABLE IF NOT EXISTS public.profile_integrity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  prev_hash TEXT,
  payload_snapshot JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profile_integrity_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS profile_integrity_log_user_id_created_at_idx
  ON public.profile_integrity_log(user_id, created_at DESC);