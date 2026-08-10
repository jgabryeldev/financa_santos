-- ============================================================
-- MIGRAÇÃO: complete colunas que o setup inicial não criou
-- Rode este script no SQL Editor do Supabase (uma vez).
-- ============================================================

alter table public.profiles
  add column if not exists name text;

alter table public.credit_cards
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

update public.credit_cards
set profile_id = (select id from public.profiles order by created_at asc limit 1)
where profile_id is null
  and exists (select 1 from public.profiles);

do $$
begin
  if not exists (select 1 from public.credit_cards where profile_id is null) then
    alter table public.credit_cards alter column profile_id set not null;
  end if;
end $$;

alter table public.fixed_finances
  add column if not exists day int;

alter table public.fixed_finances
  drop constraint if exists fixed_finances_day_check;

alter table public.fixed_finances
  add constraint fixed_finances_day_check check (day is null or day between 1 and 31);

alter table public.fixed_finances
  add column if not exists color text not null default '#6366f1';

-- RLS dos cartões (pode não ter sido criada sem profile_id)
alter table public.credit_cards enable row level security;

drop policy if exists "credit_cards: select own" on public.credit_cards;
create policy "credit_cards: select own" on public.credit_cards
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "credit_cards: insert own" on public.credit_cards;
create policy "credit_cards: insert own" on public.credit_cards
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "credit_cards: update own" on public.credit_cards;
create policy "credit_cards: update own" on public.credit_cards
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "credit_cards: delete own" on public.credit_cards;
create policy "credit_cards: delete own" on public.credit_cards
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.credit_cards to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;
grant select, insert, update, delete on public.fixed_finances to anon, authenticated;

notify pgrst, 'reload schema';
