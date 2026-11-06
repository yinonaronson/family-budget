-- הרשמה חופשית: כל משתמש חדש בלי הזמנה מקבל משפחה חדשה וריקה משלו.
--
-- היצירה עוברת דרך פונקציה אחת בצד השרת ולא דרך כמה insert-ים מהדפדפן:
--  * אטומי — אין משפחה בלי חבר או בלי קטגוריות אם משהו נכשל באמצע.
--  * לא כפול — נעילה לפי משתמש, ואם כבר יש לו משפחה מחזירים אותה.
--  * אפשר לסגור את הדלת האחורית: עד עכשיו כל משתמש מחובר יכול היה
--    להכניס את עצמו כחבר לכל משפחה שהמזהה שלה ידוע לו (hm_insert).

create or replace function public.create_my_household(
  p_name text,
  p_display_name text,
  p_categories jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  hid uuid;
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  -- שני מכשירים שנכנסים באותו רגע לא יפתחו שתי משפחות
  perform pg_advisory_xact_lock(hashtext('create_my_household:' || me::text));

  select household_id into hid
    from household_members where user_id = me
    order by joined_at limit 1;
  if hid is not null then
    return jsonb_build_object('id', hid, 'created', false);
  end if;

  insert into households (name, created_by)
  values (coalesce(nullif(btrim(p_name), ''), 'המשפחה שלי'), me)
  returning id into hid;

  insert into household_members (household_id, user_id, display_name, role, slot)
  values (hid, me, left(coalesce(nullif(btrim(p_display_name), ''), 'אני'), 60), 'owner', 1);

  -- קטגוריות ברירת המחדל מגיעות מהאפליקציה (שם הן מוגדרות), עם תקרה
  insert into categories (household_id, kind, icon, name, budget, slot, freq)
  select hid,
         (c->>'kind')::cat_kind,
         left(coalesce(c->>'icon', '📌'), 8),
         left(c->>'name', 60),
         greatest(coalesce((c->>'budget')::numeric, 0), 0),
         coalesce((c->>'slot')::smallint, 1),
         coalesce((c->>'freq')::smallint, 1)
    from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) with ordinality as t(c, i)
   where i <= 60 and coalesce(c->>'name', '') <> '';

  return jsonb_build_object('id', hid, 'created', true);
end;
$$;

revoke all on function public.create_my_household(text, text, jsonb) from public, anon;
grant execute on function public.create_my_household(text, text, jsonb) to authenticated;

-- הצטרפות למשפחה קיימת רק דרך redeem_invite (security definer) או בידי הבעלים.
drop policy if exists hm_insert on household_members;
create policy hm_insert on household_members
  for insert with check (is_owner(household_id));

-- משפחות נוצרות רק דרך create_my_household
drop policy if exists hh_insert on households;
