-- ============================================================
-- התראות פוש — הכיס המשפחתי (אפליקציית האייפון/אנדרואיד)
--
-- 1. כל טלפון שמאשר התראות רושם אסימון (Expo push token) דרך
--    register_push_token. אסימון שייך למשתמש אחד בכל רגע.
-- 2. כל בן משפחה בוחר לעצמו: התראה על תנועה חדשה (push_tx) וסיכום
--    יומי של אתמול (push_daily). שניהם פעילים כברירת מחדל, אבל
--    בפועל מגיעים רק למי שהתקין את האפליקציה ואישר התראות.
-- 3. הוספת תנועות קוראת לפונקציה push (פעם אחת לכל שמירה, לא לכל
--    שורה — ייבוא של 40 תנועות יוצר התראה אחת).
-- 4. כל בוקר pg_cron קורא לפונקציה push לסיכום של אתמול.
-- הסוד שמאמת את הקריאות שמור ב-Vault בשם push_secret.
-- ============================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- אסימוני פוש ----------
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own_select on public.push_tokens;
create policy push_tokens_own_select on public.push_tokens for select using (user_id = auth.uid());
drop policy if exists push_tokens_own_delete on public.push_tokens;
create policy push_tokens_own_delete on public.push_tokens for delete using (user_id = auth.uid());
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

-- רישום: אותו טלפון יכול לעבור בין משתמשים (התנתקות והתחברות), לכן
-- האסימון "עובר" למשתמש המחובר עכשיו. רק דרך הפונקציה, לא ישירות.
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$' then
    raise exception 'invalid push token';
  end if;
  insert into public.push_tokens(token, user_id, platform)
  values (p_token, auth.uid(), left(p_platform, 20))
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------- העדפות לכל בן משפחה ----------
alter table public.household_members add column if not exists push_tx boolean not null default true;
alter table public.household_members add column if not exists push_daily boolean not null default true;

-- ---------- קריאה לפונקציה push ----------
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
    timeout_milliseconds := 8000
  );
end $$;
revoke all on function public.call_push(jsonb) from public, anon, authenticated;

-- תנועות חדשות: טריגר ברמת פקודה, כך ששמירה של כמה תנועות יחד = קריאה אחת.
-- תקלה כאן לעולם לא מונעת את שמירת התנועה.
create or replace function public.notify_new_transactions()
returns trigger language plpgsql security definer set search_path = public as $$
declare payload jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'id', id, 'household_id', household_id, 'kind', kind, 'amount', amount,
           'category_id', category_id, 'note', note, 'created_by', created_by,
           'occurred_on', occurred_on))
    into payload
    from new_rows
   where amount is not null and created_by is not null;
  if payload is not null then
    perform public.call_push(jsonb_build_object('event', 'tx', 'rows', payload));
  end if;
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists transactions_push on public.transactions;
create trigger transactions_push
  after insert on public.transactions
  referencing new table as new_rows
  for each statement execute function public.notify_new_transactions();

-- סיכום יומי — 06:00 UTC (08:00 בחורף, 09:00 בקיץ בישראל)
select cron.unschedule('family-daily-push') where exists (select 1 from cron.job where jobname = 'family-daily-push');
select cron.schedule('family-daily-push', '0 6 * * *', $$ select public.call_push('{"event":"daily"}'::jsonb) $$);
