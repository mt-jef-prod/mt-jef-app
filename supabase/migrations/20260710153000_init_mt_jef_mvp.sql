create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'task_status'
  ) then
    create type public.task_status as enum (
      'todo',
      'in_progress',
      'blocked',
      'completed',
      'postponed',
      'cancelled'
    );
  end if;

  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_status'
  ) then
    create type public.project_status as enum (
      'idea',
      'preparation',
      'active',
      'blocked',
      'paused',
      'completed',
      'abandoned',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'transaction_type'
  ) then
    create type public.transaction_type as enum (
      'income',
      'expense'
    );
  end if;

  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'finance_status'
  ) then
    create type public.finance_status as enum (
      'planned',
      'committed',
      'paid',
      'received',
      'cancelled'
    );
  end if;

  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'prayer_status'
  ) then
    create type public.prayer_status as enum (
      'completed',
      'late',
      'missed',
      'not_recorded'
    );
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  birth_date date,
  city text,
  country text not null default 'France',
  timezone text not null default 'Europe/Paris',
  preferred_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_preferred_currency_chk
    check (preferred_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  transaction_type public.transaction_type,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_name_chk
    check (nullif(btrim(name), '') is not null),
  constraint finance_categories_slug_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint finance_categories_sort_order_chk
    check (sort_order >= 0),
  constraint finance_categories_system_user_chk
    check (
      (is_system = true and user_id is null)
      or
      (is_system = false and user_id is not null)
    )
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  intention text,
  objective text,
  expected_result text,
  category text,
  priority smallint not null default 3,
  status public.project_status not null default 'idea',
  start_date date,
  target_date date,
  estimated_budget numeric(14,2) not null default 0,
  actual_budget numeric(14,2) not null default 0,
  available_funding numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  progress smallint not null default 0,
  first_action_title text,
  first_action_defined boolean not null default false,
  cost_estimation_status text not null default 'unknown_to_estimate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_chk
    check (nullif(btrim(title), '') is not null),
  constraint projects_priority_chk
    check (priority between 1 and 5),
  constraint projects_progress_chk
    check (progress between 0 and 100),
  constraint projects_estimated_budget_chk
    check (estimated_budget >= 0),
  constraint projects_actual_budget_chk
    check (actual_budget >= 0),
  constraint projects_available_funding_chk
    check (available_funding >= 0),
  constraint projects_currency_chk
    check (currency ~ '^[A-Z]{3}$'),
  constraint projects_cost_estimation_status_chk
    check (
      cost_estimation_status in (
        'known',
        'free',
        'unknown_to_estimate'
      )
    ),
  constraint projects_active_requirements_chk
    check (
      status <> 'active'
      or (
        first_action_defined = true
        and nullif(btrim(first_action_title), '') is not null
        and cost_estimation_status in (
          'known',
          'free',
          'unknown_to_estimate'
        )
      )
    ),
  constraint projects_id_user_id_key
    unique (id, user_id)
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text,
  birth_date date,
  relationship text not null,
  interests text[] not null default '{}'::text[],
  notes text,
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_members_first_name_chk
    check (nullif(btrim(first_name), '') is not null),
  constraint family_members_relationship_chk
    check (nullif(btrim(relationship), '') is not null)
);

create table if not exists public.daily_intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  intention_date date not null default current_date,
  intention text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_intentions_intention_chk
    check (nullif(btrim(intention), '') is not null),
  constraint daily_intentions_user_date_key
    unique (user_id, intention_date)
);

create table if not exists public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  status public.task_status not null default 'todo',
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_steps_title_chk
    check (nullif(btrim(title), '') is not null),
  constraint project_steps_order_index_chk
    check (order_index >= 0),
  constraint project_steps_project_user_fkey
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete cascade
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null,
  description text,
  domain text,
  urgency smallint not null default 3,
  importance smallint not null default 3,
  spiritual_impact smallint not null default 0,
  family_impact smallint not null default 0,
  financial_impact smallint not null default 0,
  administrative_impact smallint not null default 0,
  effort smallint not null default 3,
  duration_minutes integer,
  priority_score numeric(8,2) not null default 0,
  due_date date,
  scheduled_at timestamptz,
  status public.task_status not null default 'todo',
  proof_required boolean not null default false,
  proof_url text,
  postponed_count integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_chk
    check (nullif(btrim(title), '') is not null),
  constraint tasks_urgency_chk
    check (urgency between 0 and 5),
  constraint tasks_importance_chk
    check (importance between 0 and 5),
  constraint tasks_spiritual_impact_chk
    check (spiritual_impact between 0 and 5),
  constraint tasks_family_impact_chk
    check (family_impact between 0 and 5),
  constraint tasks_financial_impact_chk
    check (financial_impact between 0 and 5),
  constraint tasks_administrative_impact_chk
    check (administrative_impact between 0 and 5),
  constraint tasks_effort_chk
    check (effort between 0 and 5),
  constraint tasks_duration_minutes_chk
    check (duration_minutes is null or duration_minutes > 0),
  constraint tasks_postponed_count_chk
    check (postponed_count >= 0),
  constraint tasks_completed_proof_chk
    check (
      status <> 'completed'
      or proof_required = false
      or nullif(btrim(proof_url), '') is not null
    ),
  constraint tasks_project_user_fkey
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete no action
);

create table if not exists public.finances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  category_id uuid not null references public.finance_categories (id),
  transaction_type public.transaction_type not null,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  transaction_date date not null default current_date,
  status public.finance_status not null default 'planned',
  is_mandatory boolean not null default false,
  is_reserved boolean not null default false,
  description text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finances_amount_chk
    check (amount > 0),
  constraint finances_currency_chk
    check (currency ~ '^[A-Z]{3}$'),
  constraint finances_reserved_expense_chk
    check (
      is_reserved = false
      or transaction_type = 'expense'
    ),
  constraint finances_status_compatibility_chk
    check (
      (
        transaction_type = 'expense'
        and status in (
          'planned',
          'committed',
          'paid',
          'cancelled'
        )
      )
      or
      (
        transaction_type = 'income'
        and status in (
          'planned',
          'committed',
          'received',
          'cancelled'
        )
      )
    ),
  constraint finances_project_user_fkey
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete no action
);

create table if not exists public.account_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_name text not null,
  balance numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  balance_date timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_balances_account_name_chk
    check (nullif(btrim(account_name), '') is not null),
  constraint account_balances_currency_chk
    check (currency ~ '^[A-Z]{3}$'),
  constraint account_balances_user_account_currency_key
    unique (user_id, account_name, currency)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id),
  period_start date not null,
  period_end date not null,
  planned_amount numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_period_chk
    check (period_start <= period_end),
  constraint budgets_planned_amount_chk
    check (planned_amount >= 0),
  constraint budgets_currency_chk
    check (currency ~ '^[A-Z]{3}$'),
  constraint budgets_user_category_period_currency_key
    unique (user_id, category_id, period_start, period_end, currency)
);

create table if not exists public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prayer_name text not null,
  prayer_date date not null default current_date,
  status public.prayer_status not null default 'not_recorded',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prayer_logs_prayer_name_chk
    check (
      prayer_name in (
        'fajr',
        'dhuhr',
        'asr',
        'maghrib',
        'isha'
      )
    ),
  constraint prayer_logs_user_date_name_key
    unique (user_id, prayer_date, prayer_name)
);

create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  review_date date not null default current_date,
  prayer_completed boolean,
  priority_completed boolean,
  family_present boolean,
  money_managed boolean,
  health_action boolean,
  learning_action boolean,
  mood smallint,
  energy smallint,
  note text,
  tomorrow_correction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_reviews_mood_chk
    check (mood is null or mood between 1 and 5),
  constraint daily_reviews_energy_chk
    check (energy is null or energy between 1 and 5),
  constraint daily_reviews_user_date_key
    unique (user_id, review_date)
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
  v_first_name text;
  v_last_name text;
  v_birth_date_text text;
  v_birth_date date;
  v_city text;
  v_country text;
  v_timezone text;
  v_preferred_currency text;
begin
  v_meta := case
    when pg_catalog.jsonb_typeof(new.raw_user_meta_data) = 'object' then new.raw_user_meta_data
    else '{}'::jsonb
  end;

  v_first_name := case
    when v_meta ? 'first_name' and pg_catalog.btrim(v_meta ->> 'first_name') <> '' then
      pg_catalog.btrim(v_meta ->> 'first_name')
  end;

  v_last_name := case
    when v_meta ? 'last_name' and pg_catalog.btrim(v_meta ->> 'last_name') <> '' then
      pg_catalog.btrim(v_meta ->> 'last_name')
  end;

  v_city := case
    when v_meta ? 'city' and pg_catalog.btrim(v_meta ->> 'city') <> '' then
      pg_catalog.btrim(v_meta ->> 'city')
  end;

  v_country := case
    when v_meta ? 'country' and pg_catalog.btrim(v_meta ->> 'country') <> '' then
      pg_catalog.btrim(v_meta ->> 'country')
    else
      'France'
  end;

  v_timezone := case
    when v_meta ? 'timezone' and pg_catalog.btrim(v_meta ->> 'timezone') <> '' then
      pg_catalog.btrim(v_meta ->> 'timezone')
    else
      'Europe/Paris'
  end;

  v_preferred_currency := case
    when v_meta ? 'preferred_currency' and pg_catalog.btrim(v_meta ->> 'preferred_currency') <> '' then
      pg_catalog.upper(pg_catalog.btrim(v_meta ->> 'preferred_currency'))
    else
      'EUR'
  end;

  if v_preferred_currency !~ '^[A-Z]{3}$' then
    v_preferred_currency := 'EUR';
  end if;

  if v_meta ? 'birth_date' then
    v_birth_date_text := pg_catalog.btrim(v_meta ->> 'birth_date');

    if v_birth_date_text ~ '^\d{4}-\d{2}-\d{2}$' then
      begin
        v_birth_date := v_birth_date_text::date;
      exception
        when others then
          v_birth_date := null;
      end;
    end if;
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    birth_date,
    city,
    country,
    timezone,
    preferred_currency
  )
  values (
    new.id,
    v_first_name,
    v_last_name,
    v_birth_date,
    v_city,
    coalesce(v_country, 'France'),
    coalesce(v_timezone, 'Europe/Paris'),
    coalesce(v_preferred_currency, 'EUR')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.apply_task_priority_score()
returns trigger
language plpgsql
as $$
begin
  new.priority_score := pg_catalog.round(
    (new.urgency::numeric * 3)
    + (new.importance::numeric * 3)
    + (new.spiritual_impact::numeric * 1.5)
    + (new.family_impact::numeric * 1.5)
    + (new.financial_impact::numeric * 1.5)
    + (new.administrative_impact::numeric * 2)
    - (new.effort::numeric * 0.5),
    2
  );

  return new;
end;
$$;

create or replace function public.assert_finance_category_allowed(
  p_category_id uuid,
  p_user_id uuid,
  p_expected_type public.transaction_type,
  p_context text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.finance_categories%rowtype;
begin
  select *
  into v_category
  from public.finance_categories as c
  where c.id = p_category_id;

  if not found then
    raise exception '% category % does not exist.', p_context, p_category_id
      using errcode = '23514';
  end if;

  if v_category.is_active is not true then
    raise exception '% category % is inactive.', p_context, p_category_id
      using errcode = '23514';
  end if;

  if v_category.is_system is false
     and v_category.user_id is distinct from p_user_id then
    raise exception '% category % belongs to another user.', p_context, p_category_id
      using errcode = '23514';
  end if;

  if v_category.transaction_type is not null
     and v_category.transaction_type <> p_expected_type then
    raise exception '% category % expects transaction_type %, got %.',
      p_context,
      p_category_id,
      v_category.transaction_type,
      p_expected_type
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.validate_finances_category_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_finance_category_allowed(
    new.category_id,
    new.user_id,
    new.transaction_type,
    'Finance transaction'
  );

  return new;
end;
$$;

create or replace function public.validate_budgets_category_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_finance_category_allowed(
    new.category_id,
    new.user_id,
    'expense'::public.transaction_type,
    'Budget'
  );

  return new;
end;
$$;

create or replace function public.detach_project_references()
returns trigger
language plpgsql
as $$
begin
  update public.tasks
     set project_id = null,
         updated_at = now()
   where project_id = old.id
     and user_id = old.user_id;

  update public.finances
     set project_id = null,
         updated_at = now()
   where project_id = old.id
     and user_id = old.user_id;

  return old;
end;
$$;

create or replace function public.upsert_account_balance_on_insert()
returns trigger
language plpgsql
as $$
declare
  v_existing_id uuid;
begin
  new.account_name := btrim(new.account_name);

  select ab.id
  into v_existing_id
  from public.account_balances as ab
  where ab.user_id = new.user_id
    and ab.account_name = new.account_name
    and ab.currency = new.currency
  for update;

  if found then
    update public.account_balances
       set balance = new.balance,
           balance_date = new.balance_date,
           is_active = new.is_active,
           updated_at = now()
     where id = v_existing_id;

    return null;
  end if;

  return new;
end;
$$;

create index if not exists family_members_user_id_idx
  on public.family_members (user_id);

create index if not exists family_members_birth_date_idx
  on public.family_members (birth_date);

create index if not exists family_members_next_contact_at_idx
  on public.family_members (next_contact_at);

create index if not exists family_members_user_next_contact_at_idx
  on public.family_members (user_id, next_contact_at);

create index if not exists projects_user_id_idx
  on public.projects (user_id);

create index if not exists projects_status_idx
  on public.projects (status);

create index if not exists projects_target_date_idx
  on public.projects (target_date);

create index if not exists projects_user_status_idx
  on public.projects (user_id, status);

create index if not exists projects_user_priority_idx
  on public.projects (user_id, priority);

create index if not exists project_steps_project_user_idx
  on public.project_steps (project_id, user_id);

create index if not exists project_steps_user_id_idx
  on public.project_steps (user_id);

create index if not exists project_steps_status_idx
  on public.project_steps (status);

create index if not exists project_steps_target_date_idx
  on public.project_steps (target_date);

create index if not exists tasks_user_id_idx
  on public.tasks (user_id);

create index if not exists tasks_project_user_idx
  on public.tasks (project_id, user_id);

create index if not exists tasks_status_idx
  on public.tasks (status);

create index if not exists tasks_due_date_idx
  on public.tasks (due_date);

create index if not exists tasks_scheduled_at_idx
  on public.tasks (scheduled_at);

create index if not exists tasks_user_status_idx
  on public.tasks (user_id, status);

create index if not exists tasks_user_priority_score_idx
  on public.tasks (user_id, priority_score desc);

create unique index if not exists finance_categories_system_slug_uidx
  on public.finance_categories (slug)
  where is_system = true;

create unique index if not exists finance_categories_user_slug_uidx
  on public.finance_categories (user_id, slug)
  where is_system = false;

create index if not exists finance_categories_user_id_idx
  on public.finance_categories (user_id);

create index if not exists finances_user_id_idx
  on public.finances (user_id);

create index if not exists finances_project_user_idx
  on public.finances (project_id, user_id);

create index if not exists finances_category_id_idx
  on public.finances (category_id);

create index if not exists finances_transaction_date_idx
  on public.finances (transaction_date);

create index if not exists finances_status_idx
  on public.finances (status);

create index if not exists finances_user_transaction_date_idx
  on public.finances (user_id, transaction_date);

create index if not exists finances_user_currency_idx
  on public.finances (user_id, currency);

-- Supports the budget-status view join on expense rows by user/category/currency/period.
create index if not exists finances_expense_budget_lookup_idx
  on public.finances (user_id, category_id, currency, transaction_date)
  where transaction_type = 'expense';

-- Supports protected outflow aggregation without scanning all finance rows.
create index if not exists finances_protected_outflows_idx
  on public.finances (user_id, currency, transaction_date)
  where transaction_type = 'expense'
    and status in ('planned', 'committed')
    and (is_mandatory = true or is_reserved = true);

create index if not exists account_balances_active_currency_idx
  on public.account_balances (user_id, currency)
  where is_active = true;

create index if not exists budgets_user_period_idx
  on public.budgets (user_id, period_start, period_end);

insert into public.finance_categories (
  name,
  slug,
  transaction_type,
  is_system,
  is_active,
  sort_order
)
values
  ('Logement', 'logement', 'expense', true, true, 10),
  ('Alimentation', 'alimentation', 'expense', true, true, 20),
  ('Transport', 'transport', 'expense', true, true, 30),
  ('Enfants', 'enfants', 'expense', true, true, 40),
  ('Santé', 'sante', 'expense', true, true, 50),
  ('Véhicule', 'vehicule', 'expense', true, true, 60),
  ('Démarches administratives', 'demarches-administratives', 'expense', true, true, 70),
  ('Dettes', 'dettes', 'expense', true, true, 80),
  ('Projets', 'projets', 'expense', true, true, 90),
  ('Sénégal', 'senegal', 'expense', true, true, 100),
  ('Loisirs', 'loisirs', 'expense', true, true, 110),
  ('Formation', 'formation', 'expense', true, true, 120),
  ('Revenus professionnels', 'revenus-professionnels', 'income', true, true, 130),
  ('Allocations', 'allocations', 'income', true, true, 140),
  ('Autres revenus', 'autres-revenus', 'income', true, true, 150)
on conflict (slug) where is_system = true do nothing;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_family_members_updated_at on public.family_members;
create trigger set_family_members_updated_at
before update on public.family_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_daily_intentions_updated_at on public.daily_intentions;
create trigger set_daily_intentions_updated_at
before update on public.daily_intentions
for each row
execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists set_project_steps_updated_at on public.project_steps;
create trigger set_project_steps_updated_at
before update on public.project_steps
for each row
execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_finance_categories_updated_at on public.finance_categories;
create trigger set_finance_categories_updated_at
before update on public.finance_categories
for each row
execute function public.set_updated_at();

drop trigger if exists set_finances_updated_at on public.finances;
create trigger set_finances_updated_at
before update on public.finances
for each row
execute function public.set_updated_at();

drop trigger if exists set_account_balances_updated_at on public.account_balances;
create trigger set_account_balances_updated_at
before update on public.account_balances
for each row
execute function public.set_updated_at();

drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at
before update on public.budgets
for each row
execute function public.set_updated_at();

drop trigger if exists set_prayer_logs_updated_at on public.prayer_logs;
create trigger set_prayer_logs_updated_at
before update on public.prayer_logs
for each row
execute function public.set_updated_at();

drop trigger if exists set_daily_reviews_updated_at on public.daily_reviews;
create trigger set_daily_reviews_updated_at
before update on public.daily_reviews
for each row
execute function public.set_updated_at();

drop trigger if exists apply_task_priority_score on public.tasks;
create trigger apply_task_priority_score
before insert or update of
  urgency,
  importance,
  spiritual_impact,
  family_impact,
  financial_impact,
  administrative_impact,
  effort
on public.tasks
for each row
execute function public.apply_task_priority_score();

drop trigger if exists validate_finances_category on public.finances;
create trigger validate_finances_category
before insert or update of category_id, user_id, transaction_type
on public.finances
for each row
execute function public.validate_finances_category_trigger();

drop trigger if exists validate_budgets_category on public.budgets;
create trigger validate_budgets_category
before insert or update of category_id, user_id
on public.budgets
for each row
execute function public.validate_budgets_category_trigger();

drop trigger if exists detach_project_references on public.projects;
create trigger detach_project_references
before delete on public.projects
for each row
execute function public.detach_project_references();

drop trigger if exists upsert_account_balance_on_insert on public.account_balances;
create trigger upsert_account_balance_on_insert
before insert on public.account_balances
for each row
execute function public.upsert_account_balance_on_insert();

alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.daily_intentions enable row level security;
alter table public.projects enable row level security;
alter table public.project_steps enable row level security;
alter table public.tasks enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finances enable row level security;
alter table public.account_balances enable row level security;
alter table public.budgets enable row level security;
alter table public.prayer_logs enable row level security;
alter table public.daily_reviews enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
on public.profiles
for delete
using ((select auth.uid()) = id);

drop policy if exists family_members_select_own on public.family_members;
create policy family_members_select_own
on public.family_members
for select
using ((select auth.uid()) = user_id);

drop policy if exists family_members_insert_own on public.family_members;
create policy family_members_insert_own
on public.family_members
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists family_members_update_own on public.family_members;
create policy family_members_update_own
on public.family_members
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists family_members_delete_own on public.family_members;
create policy family_members_delete_own
on public.family_members
for delete
using ((select auth.uid()) = user_id);

drop policy if exists daily_intentions_select_own on public.daily_intentions;
create policy daily_intentions_select_own
on public.daily_intentions
for select
using ((select auth.uid()) = user_id);

drop policy if exists daily_intentions_insert_own on public.daily_intentions;
create policy daily_intentions_insert_own
on public.daily_intentions
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists daily_intentions_update_own on public.daily_intentions;
create policy daily_intentions_update_own
on public.daily_intentions
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists daily_intentions_delete_own on public.daily_intentions;
create policy daily_intentions_delete_own
on public.daily_intentions
for delete
using ((select auth.uid()) = user_id);

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own
on public.projects
for select
using ((select auth.uid()) = user_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own
on public.projects
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own
on public.projects
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own
on public.projects
for delete
using ((select auth.uid()) = user_id);

drop policy if exists project_steps_select_own on public.project_steps;
create policy project_steps_select_own
on public.project_steps
for select
using ((select auth.uid()) = user_id);

drop policy if exists project_steps_insert_own on public.project_steps;
create policy project_steps_insert_own
on public.project_steps
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists project_steps_update_own on public.project_steps;
create policy project_steps_update_own
on public.project_steps
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists project_steps_delete_own on public.project_steps;
create policy project_steps_delete_own
on public.project_steps
for delete
using ((select auth.uid()) = user_id);

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own
on public.tasks
for select
using ((select auth.uid()) = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own
on public.tasks
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own
on public.tasks
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own
on public.tasks
for delete
using ((select auth.uid()) = user_id);

drop policy if exists finance_categories_select_visible on public.finance_categories;
create policy finance_categories_select_visible
on public.finance_categories
for select
using (
  is_system = true
  or user_id = (select auth.uid())
);

drop policy if exists finance_categories_insert_personal on public.finance_categories;
create policy finance_categories_insert_personal
on public.finance_categories
for insert
with check (
  is_system = false
  and user_id = (select auth.uid())
);

drop policy if exists finance_categories_update_personal on public.finance_categories;
create policy finance_categories_update_personal
on public.finance_categories
for update
using (
  is_system = false
  and user_id = (select auth.uid())
)
with check (
  is_system = false
  and user_id = (select auth.uid())
);

drop policy if exists finance_categories_delete_personal on public.finance_categories;
create policy finance_categories_delete_personal
on public.finance_categories
for delete
using (
  is_system = false
  and user_id = (select auth.uid())
);

drop policy if exists finances_select_own on public.finances;
create policy finances_select_own
on public.finances
for select
using ((select auth.uid()) = user_id);

drop policy if exists finances_insert_own on public.finances;
create policy finances_insert_own
on public.finances
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists finances_update_own on public.finances;
create policy finances_update_own
on public.finances
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists finances_delete_own on public.finances;
create policy finances_delete_own
on public.finances
for delete
using ((select auth.uid()) = user_id);

drop policy if exists account_balances_select_own on public.account_balances;
create policy account_balances_select_own
on public.account_balances
for select
using ((select auth.uid()) = user_id);

drop policy if exists account_balances_insert_own on public.account_balances;
create policy account_balances_insert_own
on public.account_balances
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists account_balances_update_own on public.account_balances;
create policy account_balances_update_own
on public.account_balances
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists account_balances_delete_own on public.account_balances;
create policy account_balances_delete_own
on public.account_balances
for delete
using ((select auth.uid()) = user_id);

drop policy if exists budgets_select_own on public.budgets;
create policy budgets_select_own
on public.budgets
for select
using ((select auth.uid()) = user_id);

drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own
on public.budgets
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own
on public.budgets
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists budgets_delete_own on public.budgets;
create policy budgets_delete_own
on public.budgets
for delete
using ((select auth.uid()) = user_id);

drop policy if exists prayer_logs_select_own on public.prayer_logs;
create policy prayer_logs_select_own
on public.prayer_logs
for select
using ((select auth.uid()) = user_id);

drop policy if exists prayer_logs_insert_own on public.prayer_logs;
create policy prayer_logs_insert_own
on public.prayer_logs
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists prayer_logs_update_own on public.prayer_logs;
create policy prayer_logs_update_own
on public.prayer_logs
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists prayer_logs_delete_own on public.prayer_logs;
create policy prayer_logs_delete_own
on public.prayer_logs
for delete
using ((select auth.uid()) = user_id);

drop policy if exists daily_reviews_select_own on public.daily_reviews;
create policy daily_reviews_select_own
on public.daily_reviews
for select
using ((select auth.uid()) = user_id);

drop policy if exists daily_reviews_insert_own on public.daily_reviews;
create policy daily_reviews_insert_own
on public.daily_reviews
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists daily_reviews_update_own on public.daily_reviews;
create policy daily_reviews_update_own
on public.daily_reviews
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists daily_reviews_delete_own on public.daily_reviews;
create policy daily_reviews_delete_own
on public.daily_reviews
for delete
using ((select auth.uid()) = user_id);

create or replace view public.vue_solde_reel_disponible
with (security_invoker = true)
as
with currencies as (
  select ab.user_id, ab.currency
  from public.account_balances as ab
  where ab.is_active = true
  union
  select f.user_id, f.currency
  from public.finances as f
  where f.transaction_type = 'expense'
    and f.status in ('planned', 'committed')
    and (f.is_mandatory = true or f.is_reserved = true)
),
balances as (
  select
    ab.user_id,
    ab.currency,
    coalesce(sum(ab.balance), 0) as current_balance
  from public.account_balances as ab
  where ab.is_active = true
  group by ab.user_id, ab.currency
),
protected_outflows as (
  select
    f.user_id,
    f.currency,
    coalesce(sum(f.amount), 0) as protected_outflows
  from public.finances as f
  where f.transaction_type = 'expense'
    and f.status in ('planned', 'committed')
    and (f.is_mandatory = true or f.is_reserved = true)
  group by f.user_id, f.currency
)
select
  c.user_id,
  c.currency,
  coalesce(b.current_balance, 0) as current_balance,
  coalesce(p.protected_outflows, 0) as protected_outflows,
  coalesce(b.current_balance, 0) - coalesce(p.protected_outflows, 0) as real_available_balance
from currencies as c
left join balances as b
  on b.user_id = c.user_id
 and b.currency = c.currency
left join protected_outflows as p
  on p.user_id = c.user_id
 and p.currency = c.currency;

create or replace view public.vue_budget_status
with (security_invoker = true)
as
select
  b.id as budget_id,
  b.user_id,
  b.category_id,
  b.period_start,
  b.period_end,
  b.currency,
  b.planned_amount,
  coalesce(sum(f.amount) filter (where f.status = 'paid'), 0) as spent_amount,
  coalesce(sum(f.amount) filter (where f.status = 'committed'), 0) as committed_amount,
  b.planned_amount
    - coalesce(sum(f.amount) filter (where f.status = 'paid'), 0)
    - coalesce(sum(f.amount) filter (where f.status = 'committed'), 0) as remaining_amount,
  pg_catalog.round(
    (
      (
        coalesce(sum(f.amount) filter (where f.status = 'paid'), 0)
        + coalesce(sum(f.amount) filter (where f.status = 'committed'), 0)
      )
      / nullif(b.planned_amount, 0)
    ) * 100,
    2
  ) as consumption_percentage
from public.budgets as b
left join public.finances as f
  on f.user_id = b.user_id
 and f.category_id = b.category_id
 and f.currency = b.currency
 and f.transaction_type = 'expense'
 and f.transaction_date between b.period_start and b.period_end
group by
  b.id,
  b.user_id,
  b.category_id,
  b.period_start,
  b.period_end,
  b.currency,
  b.planned_amount;

revoke all on schema public from public;
revoke all on schema public from anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

revoke all on table
  public.profiles,
  public.family_members,
  public.daily_intentions,
  public.projects,
  public.project_steps,
  public.tasks,
  public.finance_categories,
  public.finances,
  public.account_balances,
  public.budgets,
  public.prayer_logs,
  public.daily_reviews
from anon, authenticated;

revoke all on table
  public.vue_solde_reel_disponible,
  public.vue_budget_status
from anon, authenticated;

grant select, update
on table public.profiles
to authenticated;

grant select, insert, update, delete
on table
  public.family_members,
  public.daily_intentions,
  public.projects,
  public.project_steps,
  public.tasks,
  public.finance_categories,
  public.finances,
  public.account_balances,
  public.budgets,
  public.prayer_logs,
  public.daily_reviews
to authenticated;

grant select
on table
  public.vue_solde_reel_disponible,
  public.vue_budget_status
to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.apply_task_priority_score() from public, anon, authenticated;
revoke execute on function public.assert_finance_category_allowed(uuid, uuid, public.transaction_type, text) from public, anon, authenticated;
revoke execute on function public.validate_finances_category_trigger() from public, anon, authenticated;
revoke execute on function public.validate_budgets_category_trigger() from public, anon, authenticated;
revoke execute on function public.detach_project_references() from public, anon, authenticated;
revoke execute on function public.upsert_account_balance_on_insert() from public, anon, authenticated;
