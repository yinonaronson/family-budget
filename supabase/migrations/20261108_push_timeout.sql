-- הסיכום היומי של 06:00 נחתך ב-8 שניות (הפעלה ראשונה של הפונקציה אחרי
-- שינה + שליחה ל-Expo). 30 שניות נותנות מרווח; זה רץ ברקע ולא מעכב שמירה.
create or replace function public.call_push(p_body jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'push_secret';
  if sec is null then return; end if;
  perform net.http_post(
    url := 'https://qibxcfifdamhscijuppe.supabase.co/functions/v1/push',
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', sec),
    timeout_milliseconds := 30000
  );
end $$;
revoke all on function public.call_push(jsonb) from public, anon, authenticated;
