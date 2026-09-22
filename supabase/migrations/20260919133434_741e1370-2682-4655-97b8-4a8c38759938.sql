ALTER TABLE public.daily_records
  ADD COLUMN IF NOT EXISTS lunges integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS glute_bridges integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leg_raises integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS burpees integer NOT NULL DEFAULT 0;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'man',
  ADD COLUMN IF NOT EXISTS active_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS highest_unlocked integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS status_id text NOT NULL DEFAULT 'half_3',
  ADD COLUMN IF NOT EXISTS status_month text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_gender_check') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_gender_check CHECK (gender IN ('man','woman'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_active_count_check') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_active_count_check CHECK (active_count BETWEEN 3 AND 7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_highest_unlocked_check') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_highest_unlocked_check CHECK (highest_unlocked BETWEEN 3 AND 7);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.member_month_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  month text NOT NULL,
  status_id text NOT NULL,
  active_count integer NOT NULL,
  full_days integer NOT NULL DEFAULT 0,
  unlocked_count integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, month)
);

GRANT ALL ON public.member_month_progress TO service_role;

ALTER TABLE public.member_month_progress ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS member_month_progress_updated_at ON public.member_month_progress;
CREATE TRIGGER member_month_progress_updated_at
BEFORE UPDATE ON public.member_month_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();