-- ============================================================
-- MIGRAÇÃO V5: família compartilhada + auditoria por membro
-- Execute no SQL Editor do Supabase após v4.
--
-- Efeito:
--   • Todos os usuários autenticados da família vêem os mesmos
--     cartões, transações, fixos e investimentos.
--   • Transações guardam created_by_profile_id (quem lançou).
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Household (um só para o app familiar) ───────────────────
create table if not exists public.households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null default 'Família',
  created_at  timestamptz not null default now()
);

insert into public.households (id, name)
select '00000000-0000-4000-8000-000000000001'::uuid, 'Família'
where not exists (select 1 from public.households);

-- ── Colunas novas ───────────────────────────────────────────
alter table public.profiles
  add column if not exists household_id uuid references public.households(id),
  add column if not exists email text,
  add column if not exists name text;

alter table public.credit_cards
  add column if not exists household_id uuid references public.households(id);

alter table public.transactions
  add column if not exists household_id uuid references public.households(id),
  add column if not exists created_by_profile_id uuid references public.profiles(id);

alter table public.fixed_finances
  add column if not exists household_id uuid references public.households(id);

alter table public.investment_pots
  add column if not exists household_id uuid references public.households(id);

alter table public.investment_ledger
  add column if not exists household_id uuid references public.households(id);

-- ── Backfill: tudo no mesmo household ───────────────────────
update public.profiles
set household_id = '00000000-0000-4000-8000-000000000001'::uuid
where household_id is null;

-- E-mails a partir de auth.users (quando disponível)
update public.profiles p
set email = u.email
from auth.users u
where p.user_id = u.id
  and (p.email is null or p.email = '');

update public.profiles
set name = split_part(email, '@', 1)
where (name is null or name = '')
  and email is not null;

update public.credit_cards c
set household_id = coalesce(
  (select p.household_id from public.profiles p where p.id = c.profile_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
where c.household_id is null;

update public.transactions t
set household_id = coalesce(
  (select p.household_id from public.profiles p where p.id = t.profile_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
where t.household_id is null;

update public.transactions
set created_by_profile_id = profile_id
where created_by_profile_id is null;

update public.fixed_finances f
set household_id = coalesce(
  (select p.household_id from public.profiles p where p.id = f.profile_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
where f.household_id is null;

update public.investment_pots i
set household_id = coalesce(
  (select p.household_id from public.profiles p where p.id = i.profile_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
where i.household_id is null;

update public.investment_ledger l
set household_id = coalesce(
  (select p.household_id from public.profiles p where p.id = l.profile_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
where l.household_id is null;

-- NOT NULL após backfill
do $$
begin
  alter table public.profiles alter column household_id set not null;
exception when others then null;
end $$;

do $$
begin
  alter table public.credit_cards alter column household_id set not null;
exception when others then null;
end $$;

do $$
begin
  alter table public.transactions alter column household_id set not null;
exception when others then null;
end $$;

do $$
begin
  alter table public.transactions alter column created_by_profile_id set not null;
exception when others then null;
end $$;

do $$
begin
  alter table public.fixed_finances alter column household_id set not null;
exception when others then null;
end $$;

do $$
begin
  alter table public.investment_pots alter column household_id set not null;
exception when others then null;
end $$;

do $$
begin
  alter table public.investment_ledger alter column household_id set not null;
exception when others then null;
end $$;

create index if not exists profiles_household_idx on public.profiles (household_id);
create index if not exists credit_cards_household_idx on public.credit_cards (household_id);
create index if not exists transactions_household_idx on public.transactions (household_id, date);
create index if not exists transactions_created_by_idx on public.transactions (created_by_profile_id);
create index if not exists fixed_finances_household_idx on public.fixed_finances (household_id);
create index if not exists investment_pots_household_idx on public.investment_pots (household_id);
create index if not exists investment_ledger_household_idx on public.investment_ledger (household_id);

-- ── UNIQUE em profiles.user_id (exigido por ON CONFLICT / trigger) ──
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.profiles'::regclass
      and c.contype in ('u', 'p')
      and a.attname = 'user_id'
      and a.attisdropped = false
  ) and not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexdef ilike '%unique%(%user_id%)%'
  ) then
    -- remove duplicatas se existirem (mantém o perfil mais antigo)
    delete from public.profiles a
    using public.profiles b
    where a.user_id = b.user_id
      and a.created_at > b.created_at;

    alter table public.profiles
      add constraint profiles_user_id_key unique (user_id);
  end if;
exception
  when duplicate_object then null;
  when unique_violation then
    raise exception 'Há perfis duplicados com o mesmo user_id. Remova duplicatas e rode a migração de novo.';
end $$;

-- ── Helper: household do usuário logado ─────────────────────
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated, anon;

-- ── Trigger: novos usuários entram na mesma família ─────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  display_name text;
begin
  select id into hid from public.households order by created_at asc limit 1;
  if hid is null then
    insert into public.households (id, name)
    values ('00000000-0000-4000-8000-000000000001'::uuid, 'Família')
    returning id into hid;
  end if;

  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );

  if exists (select 1 from public.profiles where user_id = new.id) then
    update public.profiles
    set
      household_id = coalesce(household_id, hid),
      email = coalesce(email, new.email),
      name = coalesce(nullif(name, ''), display_name)
    where user_id = new.id;
  else
    insert into public.profiles (user_id, household_id, email, name)
    values (new.id, hid, new.email, display_name);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garante que usuários já existentes tenham perfil na família
insert into public.profiles (user_id, household_id, email, name)
select
  u.id,
  '00000000-0000-4000-8000-000000000001'::uuid,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id);

-- ── RLS households ──────────────────────────────────────────
alter table public.households enable row level security;

drop policy if exists "households: select member" on public.households;
create policy "households: select authenticated" on public.households
  for select to authenticated using (true);

-- ── RLS profiles (membros se vêem) ──────────────────────────
drop policy if exists "profiles: select own" on public.profiles;
drop policy if exists "profiles: select household" on public.profiles;
create policy "profiles: select household" on public.profiles
  for select using (
    user_id = auth.uid()
    or household_id = public.current_household_id()
  );

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = user_id);

-- ── RLS: dados compartilhados por household ─────────────────
drop policy if exists "credit_cards: select own" on public.credit_cards;
drop policy if exists "credit_cards: select household" on public.credit_cards;
create policy "credit_cards: select household" on public.credit_cards
  for select using (household_id = public.current_household_id());

drop policy if exists "credit_cards: insert own" on public.credit_cards;
drop policy if exists "credit_cards: insert household" on public.credit_cards;
create policy "credit_cards: insert household" on public.credit_cards
  for insert with check (household_id = public.current_household_id());

drop policy if exists "credit_cards: update own" on public.credit_cards;
drop policy if exists "credit_cards: update household" on public.credit_cards;
create policy "credit_cards: update household" on public.credit_cards
  for update using (household_id = public.current_household_id());

drop policy if exists "credit_cards: delete own" on public.credit_cards;
drop policy if exists "credit_cards: delete household" on public.credit_cards;
create policy "credit_cards: delete household" on public.credit_cards
  for delete using (household_id = public.current_household_id());

drop policy if exists "transactions: select own" on public.transactions;
drop policy if exists "transactions: select household" on public.transactions;
create policy "transactions: select household" on public.transactions
  for select using (household_id = public.current_household_id());

drop policy if exists "transactions: insert own" on public.transactions;
drop policy if exists "transactions: insert household" on public.transactions;
create policy "transactions: insert household" on public.transactions
  for insert with check (household_id = public.current_household_id());

drop policy if exists "transactions: update own" on public.transactions;
drop policy if exists "transactions: update household" on public.transactions;
create policy "transactions: update household" on public.transactions
  for update using (household_id = public.current_household_id());

drop policy if exists "transactions: delete own" on public.transactions;
drop policy if exists "transactions: delete household" on public.transactions;
create policy "transactions: delete household" on public.transactions
  for delete using (household_id = public.current_household_id());

drop policy if exists "fixed_finances: select own" on public.fixed_finances;
drop policy if exists "fixed_finances: select household" on public.fixed_finances;
create policy "fixed_finances: select household" on public.fixed_finances
  for select using (household_id = public.current_household_id());

drop policy if exists "fixed_finances: insert own" on public.fixed_finances;
drop policy if exists "fixed_finances: insert household" on public.fixed_finances;
create policy "fixed_finances: insert household" on public.fixed_finances
  for insert with check (household_id = public.current_household_id());

drop policy if exists "fixed_finances: update own" on public.fixed_finances;
drop policy if exists "fixed_finances: update household" on public.fixed_finances;
create policy "fixed_finances: update household" on public.fixed_finances
  for update using (household_id = public.current_household_id());

drop policy if exists "fixed_finances: delete own" on public.fixed_finances;
drop policy if exists "fixed_finances: delete household" on public.fixed_finances;
create policy "fixed_finances: delete household" on public.fixed_finances
  for delete using (household_id = public.current_household_id());

-- Investimentos (se a tabela existir)
do $$
begin
  if to_regclass('public.investment_pots') is not null then
    execute 'drop policy if exists "investment_pots: select own" on public.investment_pots';
    execute 'drop policy if exists "investment_pots: select household" on public.investment_pots';
    execute 'create policy "investment_pots: select household" on public.investment_pots for select using (household_id = public.current_household_id())';

    execute 'drop policy if exists "investment_pots: insert own" on public.investment_pots';
    execute 'drop policy if exists "investment_pots: insert household" on public.investment_pots';
    execute 'create policy "investment_pots: insert household" on public.investment_pots for insert with check (household_id = public.current_household_id())';

    execute 'drop policy if exists "investment_pots: update own" on public.investment_pots';
    execute 'drop policy if exists "investment_pots: update household" on public.investment_pots';
    execute 'create policy "investment_pots: update household" on public.investment_pots for update using (household_id = public.current_household_id())';

    execute 'drop policy if exists "investment_pots: delete own" on public.investment_pots';
    execute 'drop policy if exists "investment_pots: delete household" on public.investment_pots';
    execute 'create policy "investment_pots: delete household" on public.investment_pots for delete using (household_id = public.current_household_id())';
  end if;

  if to_regclass('public.investment_ledger') is not null then
    execute 'drop policy if exists "investment_ledger: select own" on public.investment_ledger';
    execute 'drop policy if exists "investment_ledger: select household" on public.investment_ledger';
    execute 'create policy "investment_ledger: select household" on public.investment_ledger for select using (household_id = public.current_household_id())';

    execute 'drop policy if exists "investment_ledger: insert own" on public.investment_ledger';
    execute 'drop policy if exists "investment_ledger: insert household" on public.investment_ledger';
    execute 'create policy "investment_ledger: insert household" on public.investment_ledger for insert with check (household_id = public.current_household_id())';

    execute 'drop policy if exists "investment_ledger: update own" on public.investment_ledger';
    execute 'drop policy if exists "investment_ledger: update household" on public.investment_ledger';
    execute 'create policy "investment_ledger: update household" on public.investment_ledger for update using (household_id = public.current_household_id())';

    execute 'drop policy if exists "investment_ledger: delete own" on public.investment_ledger';
    execute 'drop policy if exists "investment_ledger: delete household" on public.investment_ledger';
    execute 'create policy "investment_ledger: delete household" on public.investment_ledger for delete using (household_id = public.current_household_id())';
  end if;
end $$;

grant select on public.households to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.credit_cards to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.fixed_finances to authenticated;

notify pgrst, 'reload schema';
