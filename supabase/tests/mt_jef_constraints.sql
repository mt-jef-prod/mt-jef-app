begin;
set local search_path = public, extensions;

create or replace function pg_temp.expect_exception(
  p_sql text,
  p_label text,
  p_expected_sqlstate text default null,
  p_expected_message_substring text default null
)
returns void
language plpgsql
as $$
declare
  v_state text;
  v_message text;
begin
  execute p_sql;
  raise exception 'Test failed [%]: expected an exception but the statement succeeded.', p_label;
exception
  when others then
    get stacked diagnostics
      v_state = returned_sqlstate,
      v_message = message_text;

    if p_expected_sqlstate is not null and v_state <> p_expected_sqlstate then
      raise exception 'Test failed [%]: expected SQLSTATE %, got % (%).', p_label, p_expected_sqlstate, v_state, v_message;
    end if;

    if p_expected_message_substring is not null
       and position(p_expected_message_substring in v_message) = 0 then
      raise exception 'Test failed [%]: expected message containing "%", got "%".', p_label, p_expected_message_substring, v_message;
    end if;

    raise notice 'PASS [%]: %', p_label, v_message;
end;
$$;

create or replace function pg_temp.expect_true(
  p_condition boolean,
  p_label text
)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'Test failed [%]: condition is false.', p_label;
  end if;

  raise notice 'PASS [%]', p_label;
end;
$$;

create or replace function pg_temp.expect_numeric(
  p_actual numeric,
  p_expected numeric,
  p_label text
)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'Test failed [%]: expected %, got %.', p_label, p_expected, p_actual;
  end if;

  raise notice 'PASS [%]: %', p_label, p_actual;
end;
$$;

create or replace function pg_temp.expect_null(
  p_actual anyelement,
  p_label text
)
returns void
language plpgsql
as $$
begin
  if p_actual is not null then
    raise exception 'Test failed [%]: expected NULL, got %.', p_label, p_actual;
  end if;

  raise notice 'PASS [%]', p_label;
end;
$$;

create temp table pg_temp.test_ctx as
select
  gen_random_uuid() as user_a_id,
  gen_random_uuid() as user_b_id;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  user_a_id,
  'authenticated',
  'authenticated',
  'constraint-a@example.test',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from pg_temp.test_ctx
union all
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  user_b_id,
  'authenticated',
  'authenticated',
  'constraint-b@example.test',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from pg_temp.test_ctx;

insert into public.finance_categories (
  user_id,
  name,
  slug,
  transaction_type,
  is_system,
  is_active,
  sort_order
)
select
  user_a_id,
  'Categorie utilisateur A',
  'categorie-utilisateur-a',
  'expense',
  false,
  true,
  10
from pg_temp.test_ctx;

insert into public.finance_categories (
  user_id,
  name,
  slug,
  transaction_type,
  is_system,
  is_active,
  sort_order
)
select
  user_b_id,
  'Categorie utilisateur B',
  'categorie-utilisateur-b',
  'expense',
  false,
  true,
  10
from pg_temp.test_ctx;

insert into public.projects (
  user_id,
  title,
  status,
  cost_estimation_status
)
select
  user_a_id,
  'Projet test A',
  'preparation',
  'unknown_to_estimate'
from pg_temp.test_ctx;

insert into public.projects (
  user_id,
  title,
  status,
  cost_estimation_status
)
select
  user_b_id,
  'Projet test B',
  'preparation',
  'unknown_to_estimate'
from pg_temp.test_ctx;

select pg_temp.expect_exception(
  $sql$
    insert into public.projects (user_id, title, currency)
    select user_a_id, 'Projet devise minuscule', 'eur'
    from pg_temp.test_ctx
  $sql$,
  '1 lowercase currency refused',
  '23514'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.projects (
      user_id,
      title,
      status,
      first_action_defined,
      cost_estimation_status
    )
    select
      user_a_id,
      'Projet actif invalide',
      'active',
      false,
      'known'
    from pg_temp.test_ctx
  $sql$,
  '2 active project without first action refused',
  '23514'
);

insert into public.projects (
  user_id,
  title,
  status,
  first_action_defined,
  first_action_title,
  cost_estimation_status,
  estimated_budget,
  currency
)
select
  user_a_id,
  'Projet actif gratuit valide',
  'active',
  true,
  'Prendre un premier rendez-vous',
  'free',
  0,
  'EUR'
from pg_temp.test_ctx;

select pg_temp.expect_true(
  exists (
    select 1
    from public.projects as p
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = p.user_id
    where p.title = 'Projet actif gratuit valide'
      and p.status = 'active'
      and p.cost_estimation_status = 'free'
  ),
  '3 free active project with first action accepted'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.finances (
      user_id,
      category_id,
      transaction_type,
      amount,
      currency
    )
    select
      ctx.user_a_id,
      fc.id,
      'expense',
      0,
      'EUR'
    from pg_temp.test_ctx as ctx
    cross join lateral (
      select id
      from public.finance_categories
      where slug = 'logement'
        and is_system = true
    ) as fc
  $sql$,
  '4 non-positive amount refused',
  '23514'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.finances (
      user_id,
      category_id,
      transaction_type,
      amount,
      currency,
      status
    )
    select
      ctx.user_a_id,
      fc.id,
      'expense',
      10,
      'EUR',
      'received'
    from pg_temp.test_ctx as ctx
    cross join lateral (
      select id
      from public.finance_categories
      where slug = 'logement'
        and is_system = true
    ) as fc
  $sql$,
  '5 expense with received status refused',
  '23514'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.finances (
      user_id,
      category_id,
      transaction_type,
      amount,
      currency,
      status
    )
    select
      ctx.user_a_id,
      fc.id,
      'income',
      10,
      'EUR',
      'paid'
    from pg_temp.test_ctx as ctx
    cross join lateral (
      select id
      from public.finance_categories
      where slug = 'revenus-professionnels'
        and is_system = true
    ) as fc
  $sql$,
  '6 income with paid status refused',
  '23514'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.finances (
      user_id,
      category_id,
      transaction_type,
      amount,
      currency,
      is_reserved
    )
    select
      ctx.user_a_id,
      fc.id,
      'income',
      10,
      'EUR',
      true
    from pg_temp.test_ctx as ctx
    cross join lateral (
      select id
      from public.finance_categories
      where slug = 'revenus-professionnels'
        and is_system = true
    ) as fc
  $sql$,
  '7 reserved income refused',
  '23514'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.tasks (
      user_id,
      title,
      status,
      proof_required
    )
    select
      user_a_id,
      'Tache sans preuve',
      'completed',
      true
    from pg_temp.test_ctx
  $sql$,
  '8 completed task without required proof refused',
  '23514'
);

insert into public.tasks (
  user_id,
  title,
  urgency,
  importance,
  spiritual_impact,
  family_impact,
  financial_impact,
  administrative_impact,
  effort
)
select
  user_a_id,
  'Tache score auto',
  5,
  4,
  2,
  1,
  0,
  3,
  2
from pg_temp.test_ctx;

select pg_temp.expect_numeric(
  (
    select t.priority_score
    from public.tasks as t
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = t.user_id
    where t.title = 'Tache score auto'
  ),
  36.50,
  '9 priority_score calculated on insert'
);

update public.tasks
set importance = 5
where title = 'Tache score auto'
  and user_id = (select user_a_id from pg_temp.test_ctx);

select pg_temp.expect_numeric(
  (
    select t.priority_score
    from public.tasks as t
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = t.user_id
    where t.title = 'Tache score auto'
  ),
  39.50,
  '9b priority_score recalculated on update'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.tasks (
      user_id,
      project_id,
      title
    )
    select
      ctx.user_a_id,
      p.id,
      'Tache cross-user invalide'
    from pg_temp.test_ctx as ctx
    join public.projects as p
      on p.user_id = ctx.user_b_id
     and p.title = 'Projet test B'
  $sql$,
  '10 cross-user task project relation refused',
  '23503'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.finances (
      user_id,
      project_id,
      category_id,
      transaction_type,
      amount,
      currency
    )
    select
      ctx.user_a_id,
      p.id,
      fc.id,
      'expense',
      10,
      'EUR'
    from pg_temp.test_ctx as ctx
    join public.projects as p
      on p.user_id = ctx.user_b_id
     and p.title = 'Projet test B'
    cross join lateral (
      select id
      from public.finance_categories
      where slug = 'logement'
        and is_system = true
    ) as fc
  $sql$,
  '11 cross-user finance project relation refused',
  '23503'
);

select pg_temp.expect_exception(
  $sql$
    insert into public.finances (
      user_id,
      category_id,
      transaction_type,
      amount,
      currency
    )
    select
      ctx.user_a_id,
      fc.id,
      'expense',
      10,
      'EUR'
    from pg_temp.test_ctx as ctx
    join public.finance_categories as fc
      on fc.user_id = ctx.user_b_id
     and fc.slug = 'categorie-utilisateur-b'
  $sql$,
  '12 other user personal category refused',
  '23514',
  'belongs to another user'
);

insert into public.daily_intentions (
  user_id,
  intention_date,
  intention
)
select
  user_a_id,
  date '2026-07-10',
  'Clarifier ma niyya'
from pg_temp.test_ctx;

select pg_temp.expect_exception(
  $sql$
    insert into public.daily_intentions (
      user_id,
      intention_date,
      intention
    )
    select
      user_a_id,
      date '2026-07-10',
      'Deuxieme intention'
    from pg_temp.test_ctx
  $sql$,
  '13 daily intention uniqueness enforced',
  '23505'
);

insert into public.prayer_logs (
  user_id,
  prayer_date,
  prayer_name,
  status
)
select
  user_a_id,
  date '2026-07-10',
  'fajr',
  'completed'
from pg_temp.test_ctx;

select pg_temp.expect_exception(
  $sql$
    insert into public.prayer_logs (
      user_id,
      prayer_date,
      prayer_name,
      status
    )
    select
      user_a_id,
      date '2026-07-10',
      'fajr',
      'late'
    from pg_temp.test_ctx
  $sql$,
  '14 prayer uniqueness enforced',
  '23505'
);

insert into public.account_balances (
  user_id,
  account_name,
  balance,
  currency,
  balance_date,
  is_active
)
select
  user_a_id,
  'Compte courant',
  1000,
  'EUR',
  timestamptz '2026-07-10 08:00:00+00',
  true
from pg_temp.test_ctx;

insert into public.account_balances (
  user_id,
  account_name,
  balance,
  currency,
  balance_date,
  is_active
)
select
  user_a_id,
  'Compte courant',
  1200,
  'EUR',
  timestamptz '2026-07-10 09:00:00+00',
  true
from pg_temp.test_ctx;

select pg_temp.expect_true(
  (
    select count(*) = 1
    from public.account_balances as ab
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = ab.user_id
    where ab.account_name = 'Compte courant'
      and ab.currency = 'EUR'
  ),
  '15 account balance remains unique per account and currency'
);

select pg_temp.expect_numeric(
  (
    select ab.balance
    from public.account_balances as ab
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = ab.user_id
    where ab.account_name = 'Compte courant'
      and ab.currency = 'EUR'
  ),
  1200.00,
  '15b duplicate insert updates current balance row'
);

insert into public.finances (
  user_id,
  category_id,
  transaction_type,
  amount,
  currency,
  transaction_date,
  status,
  is_mandatory,
  is_reserved,
  description
)
select
  ctx.user_a_id,
  fc.id,
  'expense',
  200,
  'EUR',
  date '2026-07-11',
  'planned',
  true,
  true,
  'Depense protegee'
from pg_temp.test_ctx as ctx
cross join lateral (
  select id
  from public.finance_categories
  where slug = 'logement'
    and is_system = true
) as fc;

select pg_temp.expect_numeric(
  (
    select v.protected_outflows
    from public.vue_solde_reel_disponible as v
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = v.user_id
    where v.currency = 'EUR'
  ),
  200.00,
  '16 protected outflow counted only once'
);

select pg_temp.expect_numeric(
  (
    select v.real_available_balance
    from public.vue_solde_reel_disponible as v
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = v.user_id
    where v.currency = 'EUR'
  ),
  1000.00,
  '16b real available balance subtracts protected outflow once'
);

insert into public.budgets (
  user_id,
  category_id,
  period_start,
  period_end,
  planned_amount,
  currency
)
select
  ctx.user_a_id,
  fc.id,
  date '2026-07-01',
  date '2026-07-31',
  500,
  'EUR'
from pg_temp.test_ctx as ctx
join public.finance_categories as fc
  on fc.user_id = ctx.user_a_id
 and fc.slug = 'categorie-utilisateur-a';

insert into public.finances (
  user_id,
  category_id,
  transaction_type,
  amount,
  currency,
  transaction_date,
  status,
  description
)
select
  ctx.user_a_id,
  fc.id,
  'expense',
  120,
  'EUR',
  date '2026-07-12',
  'paid',
  'Paiement budget'
from pg_temp.test_ctx as ctx
join public.finance_categories as fc
  on fc.user_id = ctx.user_a_id
 and fc.slug = 'categorie-utilisateur-a';

insert into public.finances (
  user_id,
  category_id,
  transaction_type,
  amount,
  currency,
  transaction_date,
  status,
  description
)
select
  ctx.user_a_id,
  fc.id,
  'expense',
  80,
  'EUR',
  date '2026-07-13',
  'committed',
  'Engagement budget'
from pg_temp.test_ctx as ctx
join public.finance_categories as fc
  on fc.user_id = ctx.user_a_id
 and fc.slug = 'categorie-utilisateur-a';

select pg_temp.expect_numeric(
  (
    select v.remaining_amount
    from public.vue_budget_status as v
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = v.user_id
    join public.finance_categories as fc
      on fc.user_id = ctx.user_a_id
     and fc.slug = 'categorie-utilisateur-a'
     and fc.id = v.category_id
    where v.period_start = date '2026-07-01'
      and v.period_end = date '2026-07-31'
      and v.currency = 'EUR'
  ),
  300.00,
  '17 budget remaining amount calculated correctly'
);

select pg_temp.expect_numeric(
  (
    select v.spent_amount
    from public.vue_budget_status as v
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = v.user_id
    join public.finance_categories as fc
      on fc.user_id = ctx.user_a_id
     and fc.slug = 'categorie-utilisateur-a'
     and fc.id = v.category_id
    where v.period_start = date '2026-07-01'
      and v.period_end = date '2026-07-31'
      and v.currency = 'EUR'
  ),
  120.00,
  '17b budget spent amount calculated correctly'
);

select pg_temp.expect_numeric(
  (
    select v.committed_amount
    from public.vue_budget_status as v
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = v.user_id
    join public.finance_categories as fc
      on fc.user_id = ctx.user_a_id
     and fc.slug = 'categorie-utilisateur-a'
     and fc.id = v.category_id
    where v.period_start = date '2026-07-01'
      and v.period_end = date '2026-07-31'
      and v.currency = 'EUR'
  ),
  80.00,
  '17c budget committed amount calculated correctly'
);

insert into public.budgets (
  user_id,
  category_id,
  period_start,
  period_end,
  planned_amount,
  currency
)
select
  ctx.user_a_id,
  fc.id,
  date '2026-08-01',
  date '2026-08-31',
  0,
  'EUR'
from pg_temp.test_ctx as ctx
join public.finance_categories as fc
  on fc.user_id = ctx.user_a_id
 and fc.slug = 'categorie-utilisateur-a';

select pg_temp.expect_null(
  (
    select v.consumption_percentage
    from public.vue_budget_status as v
    join pg_temp.test_ctx as ctx
      on ctx.user_a_id = v.user_id
    join public.finance_categories as fc
      on fc.user_id = ctx.user_a_id
     and fc.slug = 'categorie-utilisateur-a'
     and fc.id = v.category_id
    where v.period_start = date '2026-08-01'
      and v.period_end = date '2026-08-31'
      and v.currency = 'EUR'
  ),
  '18 zero budget consumption percentage is null'
);

rollback;
