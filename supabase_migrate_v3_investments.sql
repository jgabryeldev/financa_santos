-- ============================================================
-- MIGRAÇÃO V3: módulo Investimentos (cofrinhos % CDI)
-- Execute no SQL Editor do Supabase após setup / migrate / v2.
-- ============================================================

create table if not exists public.investment_pots (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  cdi_percent   numeric(8,2) not null check (cdi_percent > 0 and cdi_percent <= 300),
  liquidity     text not null check (liquidity in ('daily', 'dated')),
  unlock_date   date,
  color         text not null default '#10b981',
  status        text not null default 'active' check (status in ('active', 'closed')),
  created_at    timestamptz not null default now(),
  constraint investment_pots_dated_unlock check (
    (liquidity = 'daily' and unlock_date is null)
    or (liquidity = 'dated' and unlock_date is not null)
  )
);

create table if not exists public.investment_ledger (
  id                 uuid primary key default uuid_generate_v4(),
  pot_id             uuid not null references public.investment_pots(id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  type               text not null check (type in ('apply', 'redeem')),
  amount             numeric(12,2) not null check (amount > 0),
  -- no resgate: quanto do amount era principal vs rendimento (auditoria)
  principal_amount   numeric(12,2),
  yield_amount       numeric(12,2),
  occurred_on        date not null default (timezone('America/Sao_Paulo', now()))::date,
  note               text,
  created_at         timestamptz not null default now(),
  constraint investment_ledger_redeem_parts check (
    (type = 'apply' and principal_amount is null and yield_amount is null)
    or (
      type = 'redeem'
      and principal_amount is not null
      and yield_amount is not null
      and principal_amount >= 0
      and yield_amount >= 0
      and abs((principal_amount + yield_amount) - amount) < 0.02
    )
  )
);

create index if not exists investment_pots_profile_idx
  on public.investment_pots (profile_id);

create index if not exists investment_ledger_pot_idx
  on public.investment_ledger (pot_id, occurred_on);

create index if not exists investment_ledger_profile_idx
  on public.investment_ledger (profile_id);

alter table public.investment_pots enable row level security;
alter table public.investment_ledger enable row level security;

drop policy if exists "investment_pots: select own" on public.investment_pots;
create policy "investment_pots: select own" on public.investment_pots
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_pots: insert own" on public.investment_pots;
create policy "investment_pots: insert own" on public.investment_pots
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_pots: update own" on public.investment_pots;
create policy "investment_pots: update own" on public.investment_pots
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_pots: delete own" on public.investment_pots;
create policy "investment_pots: delete own" on public.investment_pots
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_ledger: select own" on public.investment_ledger;
create policy "investment_ledger: select own" on public.investment_ledger
  for select using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_ledger: insert own" on public.investment_ledger;
create policy "investment_ledger: insert own" on public.investment_ledger
  for insert with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_ledger: update own" on public.investment_ledger;
create policy "investment_ledger: update own" on public.investment_ledger
  for update using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "investment_ledger: delete own" on public.investment_ledger;
create policy "investment_ledger: delete own" on public.investment_ledger
  for delete using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

grant select, insert, update, delete on public.investment_pots to anon, authenticated;
grant select, insert, update, delete on public.investment_ledger to anon, authenticated;

notify pgrst, 'reload schema';
