SELECT cron.unschedule('push-dispatch') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-dispatch');

SELECT cron.schedule(
  'push-dispatch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--a77d7b12-6e0f-4067-a287-df4b56570dbb.lovable.app/api/public/push/dispatch',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);