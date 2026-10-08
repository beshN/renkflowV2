-- Notifications and notification preferences were written as JSON text inside jsonb (a JSON string
-- holding the object). Rewrite those values as the objects they hold; values already stored as
-- objects are left alone, so running it again changes nothing.
UPDATE public.notifications SET data = (data #>> '{}')::jsonb WHERE jsonb_typeof(data) = 'string';
UPDATE public.notifications SET channels = (channels #>> '{}')::jsonb WHERE jsonb_typeof(channels) = 'string';
DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    UPDATE public.notification_preferences SET email = (email #>> '{}')::jsonb WHERE jsonb_typeof(email) = 'string';
    UPDATE public.notification_preferences SET push = (push #>> '{}')::jsonb WHERE jsonb_typeof(push) = 'string';
    UPDATE public.notification_preferences SET in_app = (in_app #>> '{}')::jsonb WHERE jsonb_typeof(in_app) = 'string';
  END IF;
END $$;
