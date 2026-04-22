-- Canonicalize expense payment/account method for dashboard balance consistency.
-- Safe to run multiple times.

alter table if exists public.expenses
  add column if not exists payment_method text;

-- Backfill from legacy columns only when payment_method is empty.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'method'
  ) then
    execute $sql$
      update public.expenses
      set payment_method = lower(trim(method))
      where coalesce(trim(payment_method), '') = ''
        and coalesce(trim(method), '') <> ''
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'account_method'
  ) then
    execute $sql$
      update public.expenses
      set payment_method = lower(trim(account_method))
      where coalesce(trim(payment_method), '') = ''
        and coalesce(trim(account_method), '') <> ''
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'account_type'
  ) then
    execute $sql$
      update public.expenses
      set payment_method = lower(trim(account_type))
      where coalesce(trim(payment_method), '') = ''
        and coalesce(trim(account_type), '') <> ''
    $sql$;
  end if;
end $$;
