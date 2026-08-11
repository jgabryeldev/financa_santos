-- ============================================================
-- MIGRAÇÃO V2: reconcilia schema legado com o app
-- Execute no SQL Editor do Supabase (uma vez; é idempotente).
--
-- Ordem recomendada:
--   1) supabase_setup.sql   (projetos novos)
--   2) supabase_migrate.sql (colunas básicas)
--   3) ESTE arquivo         (day_of_month → day, color, etc.)
--
-- Corrige erros comunsidos:
--   PGRST204  — coluna color ausente em fixed_finances
--   23502     — day_of_month NOT NULL sem valor no insert
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists name text;

-- ── credit_cards ────────────────────────────────────────────
alter table public.credit_cards
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

alter table public.credit_cards
  add column if not exists credit_limit numeric(12,2) not null default 0;

alter table public.credit_cards
  add column if not exists closing_day int;

alter table public.credit_cards
  add column if not exists due_day int;

alter table public.credit_cards
  add column if not exists color text not null default '#6366f1';

update public.credit_cards
set profile_id = (select id from public.profiles order by created_at asc limit 1)
where profile_id is null
  and exists (select 1 from public.profiles);

do $$
begin
  if not exists (select 1 from public.credit_cards where profile_id is null) then
    begin
      alter table public.credit_cards alter column profile_id set not null;
    exception when others then null;
    end;
  end if;

  -- closing_day / due_day: preenche e reforça constraints se vazios
  update public.credit_cards set closing_day = 1 where closing_day is null;
  update public.credit_cards set due_day = 10 where due_day is null;

  begin
    alter table public.credit_cards alter column closing_day set not null;
  exception when others then null;
  end;
  begin
    alter table public.credit_cards alter column due_day set not null;
  exception when others then null;
  end;

  alter table public.credit_cards drop constraint if exists credit_cards_closing_day_check;
  alter table public.credit_cards
    add constraint credit_cards_closing_day_check check (closing_day between 1 and 31);

  alter table public.credit_cards drop constraint if exists credit_cards_due_day_check;
  alter table public.credit_cards
    add constraint credit_cards_due_day_check check (due_day between 1 and 31);
end $$;

-- ── transactions ────────────────────────────────────────────
alter table public.transactions
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

alter table public.transactions
  add column if not exists credit_card_id uuid references public.credit_cards(id) on delete set null;

alter table public.transactions
  add column if not exists group_id uuid;

alter table public.transactions
  add column if not exists installment_current int not null default 1;

alter table public.transactions
  add column if not exists installment_total int not null default 1;

alter table public.transactions
  add column if not exists is_paid boolean not null default true;

-- ── fixed_finances: color ───────────────────────────────────
alter table public.fixed_finances
  add column if not exists color text;

update public.fixed_finances
set color = '#6366f1'
where color is null;

alter table public.fixed_finances
  alter column color set default '#6366f1';

do $$
begin
  alter table public.fixed_finances alter column color set not null;
exception when others then null;
end $$;

-- ── fixed_finances: day_of_month → day ──────────────────────
do $$
declare
  has_day boolean;
  has_day_of_month boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fixed_finances' and column_name = 'day'
  ) into has_day;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fixed_finances' and column_name = 'day_of_month'
  ) into has_day_of_month;

  if has_day_of_month and not has_day then
    alter table public.fixed_finances rename column day_of_month to day;
    has_day := true;
    has_day_of_month := false;
  end if;

  if has_day_of_month and has_day then
    execute 'update public.fixed_finances set day = coalesce(day, day_of_month)';
    alter table public.fixed_finances drop column day_of_month;
    has_day_of_month := false;
  end if;

  if not has_day then
    alter table public.fixed_finances add column day int;
  end if;

  -- Dia opcional na UI: remove NOT NULL se existir
  begin
    alter table public.fixed_finances alter column day drop not null;
  exception when others then null;
  end;

  alter table public.fixed_finances drop constraint if exists fixed_finances_day_check;
  alter table public.fixed_finances drop constraint if exists fixed_finances_day_of_month_check;

  alter table public.fixed_finances
    add constraint fixed_finances_day_check check (day is null or day between 1 and 31);
end $$;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.credit_cards enable row level security;
alter table public.transactions enable row level security;
alter table public.fixed_finances enable row level security;

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

drop policy if exists "fixed_finances: select own" on public.fixed_finances;
create policy "fixed_finances: select own" on public.fixed_finances
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "fixed_finances: insert own" on public.fixed_finances;
create policy "fixed_finances: insert own" on public.fixed_finances
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "fixed_finances: update own" on public.fixed_finances;
create policy "fixed_finances: update own" on public.fixed_finances
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "fixed_finances: delete own" on public.fixed_finances;
create policy "fixed_finances: delete own" on public.fixed_finances
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "transactions: select own" on public.transactions;
create policy "transactions: select own" on public.transactions
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "transactions: insert own" on public.transactions;
create policy "transactions: insert own" on public.transactions
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "transactions: update own" on public.transactions;
create policy "transactions: update own" on public.transactions
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "transactions: delete own" on public.transactions;
create policy "transactions: delete own" on public.transactions
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.credit_cards to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;
grant select, insert, update, delete on public.fixed_finances to anon, authenticated;

notify pgrst, 'reload schema';

-- ── Validação (rode após o script) ──────────────────────────
-- select column_name, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'fixed_finances'
-- order by 1;
-- Esperado: day (YES), color (NO), sem day_of_month
