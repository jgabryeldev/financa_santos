-- ============================================================
-- FINANÇAS FAMÍLIA — Script de Setup do Supabase
-- Execute este script no SQL Editor do seu projeto Supabase
--
-- Ordem em projetos já existentes / com erro de schema:
--   1) supabase_setup.sql
--   2) supabase_migrate.sql
--   3) supabase_migrate_v2_reconcile.sql  ← day_of_month / color
--   4) supabase_migrate_v3_investments.sql ← cofrinhos / CDI
--   5) supabase_migrate_v4_card_kinds.sql  ← credit | food
--   6) supabase_migrate_v5_family_household.sql ← dados compartilhados + auditoria
--
-- Schema canônico de fixed_finances: day (nullable), color (NOT NULL).
-- credit_cards.kind: 'credit' (fatura) | 'food' (limite mensal sem fatura).
-- Família: um household; todos os membros vêem os mesmos dados financeiros.
-- Não use day_of_month.
-- ============================================================

-- Habilita a extensão UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: profiles
-- Um perfil por usuário autenticado
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  name        text,
  created_at  timestamptz not null default now()
);

-- RLS: cada usuário acessa apenas seu próprio perfil
alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = user_id);

create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: cria perfil automaticamente ao cadastrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TABELA: credit_cards
-- Cartões de crédito vinculados ao perfil
-- ============================================================
create table if not exists public.credit_cards (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  credit_limit  numeric(12,2) not null default 0,
  closing_day   int not null check (closing_day between 1 and 31),
  due_day       int not null check (due_day between 1 and 31),
  color         text not null default '#6366f1',
  kind          text not null default 'credit' check (kind in ('credit', 'food')),
  created_at    timestamptz not null default now()
);

alter table public.credit_cards enable row level security;

create policy "credit_cards: select own" on public.credit_cards
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "credit_cards: insert own" on public.credit_cards
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "credit_cards: update own" on public.credit_cards
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "credit_cards: delete own" on public.credit_cards
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

-- ============================================================
-- TABELA: transactions
-- Transações de débito e crédito
-- ============================================================
create table if not exists public.transactions (
  id                  uuid primary key default uuid_generate_v4(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  description         text not null,
  amount              numeric(12,2) not null,
  type                text not null check (type in ('income', 'expense')),
  date                date not null,
  credit_card_id      uuid references public.credit_cards(id) on delete set null,
  group_id            uuid,
  installment_current int not null default 1,
  installment_total   int not null default 1,
  is_paid             boolean not null default true,
  created_at          timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions: select own" on public.transactions
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "transactions: insert own" on public.transactions
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "transactions: update own" on public.transactions
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "transactions: delete own" on public.transactions
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

-- ============================================================
-- TABELA: fixed_finances
-- Gastos/receitas fixas mensais
-- ============================================================
create table if not exists public.fixed_finances (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  description text not null,
  amount      numeric(12,2) not null,
  type        text not null check (type in ('income', 'expense')),
  day         int check (day between 1 and 31),
  color       text not null default '#6366f1',
  created_at  timestamptz not null default now()
);

alter table public.fixed_finances enable row level security;

create policy "fixed_finances: select own" on public.fixed_finances
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "fixed_finances: insert own" on public.fixed_finances
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "fixed_finances: update own" on public.fixed_finances
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

create policy "fixed_finances: delete own" on public.fixed_finances
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

-- ============================================================
-- MIGRAÇÃO: colunas que o CREATE TABLE IF NOT EXISTS não adiciona
-- Seguro rodar de novo se as tabelas já existirem.
-- ============================================================

alter table public.profiles
  add column if not exists name text;

alter table public.credit_cards
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

update public.credit_cards
set profile_id = (select id from public.profiles order by created_at asc limit 1)
where profile_id is null
  and exists (select 1 from public.profiles);

alter table public.fixed_finances
  add column if not exists day int;

alter table public.fixed_finances
  add column if not exists color text not null default '#6366f1';

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.credit_cards to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;
grant select, insert, update, delete on public.fixed_finances to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
