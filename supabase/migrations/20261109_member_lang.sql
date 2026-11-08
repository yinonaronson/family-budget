-- השפה של כל בן משפחה — כדי שההתראות והסיכום היומי יגיעו אליו בשפה שבחר באפליקציה.
-- האפליקציה מעדכנת את השורה של המשתמש עצמו (מדיניות hm_update כבר מאפשרת).
alter table public.household_members
  add column if not exists lang text not null default 'he';

alter table public.household_members drop constraint if exists household_members_lang_chk;
alter table public.household_members
  add constraint household_members_lang_chk check (lang in ('he', 'en', 'ar'));
