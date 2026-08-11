-- ============================================================
-- MIGRAÇÃO V4: tipo de cartão (crédito | alimentação)
-- Execute no SQL Editor do Supabase após v3.
-- ============================================================

alter table public.credit_cards
  add column if not exists kind text;

update public.credit_cards
set kind = 'credit'
where kind is null;

alter table public.credit_cards
  alter column kind set default 'credit';

do $$
begin
  alter table public.credit_cards alter column kind set not null;
exception when others then null;
end $$;

alter table public.credit_cards
  drop constraint if exists credit_cards_kind_check;

alter table public.credit_cards
  add constraint credit_cards_kind_check check (kind in ('credit', 'food'));

notify pgrst, 'reload schema';
