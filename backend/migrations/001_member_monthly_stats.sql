-- Run once in the Neon SQL editor. Adds 1 column, 1 table, 1 view, 3 functions, 2 triggers.

BEGIN;

-- 1. marks people who started in Connect, so "new first-timers per month" can be counted exactly
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS connect_origin boolean NOT NULL DEFAULT false;

-- 2. backfill: first-timers still in Connect, or dropped from it before ever becoming members (member_status stays NULL)
UPDATE public.members
SET connect_origin = true
WHERE connect_origin = false
  AND (
    connection_status IN ('pending', 'assigned')
    OR (connection_status = 'removed' AND member_status IS NULL)
  );

-- 3. rows created with a connection_status are first-timers; in the database so no code path can forget it
CREATE OR REPLACE FUNCTION public.set_connect_origin()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.connection_status IS NOT NULL THEN
    NEW.connect_origin := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_connect_origin ON public.members;
CREATE TRIGGER trg_members_connect_origin
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_connect_origin();

-- 4. the one definition of each count, shared by the dashboard cards and the monthly snapshot
CREATE OR REPLACE VIEW public.v_member_counts AS
SELECT
  COUNT(*) FILTER (WHERE member_status = 'mentor')                      AS mentors,
  COUNT(*) FILTER (WHERE member_status = 'potential mentor')            AS potential_mentors,
  COUNT(*) FILTER (WHERE member_status = 'mentee')                      AS mentees,
  COUNT(*) FILTER (WHERE connection_status IN ('pending', 'assigned'))  AS connect
FROM public.members;

-- 5. one row per month; month = first day of the month (Manila time)
CREATE TABLE IF NOT EXISTS public.member_monthly_stats (
  month             date PRIMARY KEY,
  mentors           integer NOT NULL,
  potential_mentors integer NOT NULL,
  mentees           integer NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_monthly_stats_month_check CHECK (EXTRACT(DAY FROM month) = 1)
);

-- 6. recount and overwrite the current month's row; recounting (not +1/-1) means a past mistake self-corrects
CREATE OR REPLACE FUNCTION public.refresh_current_month_stats()
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.member_monthly_stats (month, mentors, potential_mentors, mentees)
  SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Manila')::date,
         c.mentors, c.potential_mentors, c.mentees
  FROM public.v_member_counts c
  ON CONFLICT (month) DO UPDATE
    SET mentors = EXCLUDED.mentors,
        potential_mentors = EXCLUDED.potential_mentors,
        mentees = EXCLUDED.mentees,
        updated_at = now();
$$;

-- 7. statement-level trigger: a bulk change recounts once, not once per row
CREATE OR REPLACE FUNCTION public.trg_refresh_member_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_current_month_stats();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_stats ON public.members;
CREATE TRIGGER trg_members_stats
  AFTER INSERT OR DELETE OR UPDATE OF member_status ON public.members
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_member_stats();

-- 8. first point on the chart: today's counts
SELECT public.refresh_current_month_stats();

COMMIT;



-- DROP TRIGGER IF EXISTS trg_members_stats ON public.members;
-- DROP TRIGGER IF EXISTS trg_members_connect_origin ON public.members;
-- DROP FUNCTION IF EXISTS public.trg_refresh_member_stats();
-- DROP FUNCTION IF EXISTS public.refresh_current_month_stats();
-- DROP FUNCTION IF EXISTS public.set_connect_origin();
-- DROP VIEW IF EXISTS public.v_member_counts;
-- DROP TABLE IF EXISTS public.member_monthly_stats;
-- ALTER TABLE public.members DROP COLUMN IF EXISTS connect_origin;