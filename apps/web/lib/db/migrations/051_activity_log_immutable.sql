-- The audit trail (activity_logs) is append-only.
--
-- Allowed changes:
--   * actor_id set to NULL by the users FK (ON DELETE SET NULL); actor_name keeps the snapshot.
--   * rows removed by the tenants FK cascade (firm deletion), i.e. from inside another trigger.
--   * an explicit, logged purge: SET LOCAL renkflow.audit_purge = 'on' inside the purging
--     transaction (retention jobs, data-subject requests).
-- Everything else raises, including UPDATE/DELETE issued by the application role.

CREATE OR REPLACE FUNCTION public.activity_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('renkflow.audit_purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'activity_logs is append-only (delete of %)', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.actor_id IS NULL AND OLD.actor_id IS NOT NULL
     AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'activity_logs is append-only (update of %)', OLD.id USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS activity_logs_append_only ON public.activity_logs;
CREATE TRIGGER activity_logs_append_only
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.activity_logs_append_only();
