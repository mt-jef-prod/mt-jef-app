create or replace function public.seed_mt_jef_demo(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from auth.users as u
    where u.id = target_user_id
  ) then
    raise exception 'Target user % does not exist in auth.users.', target_user_id
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.family_members as fm
    where fm.user_id = target_user_id
      and fm.first_name = 'Coryan'
      and fm.birth_date = date '1998-08-28'
      and fm.relationship = 'child'
  ) then
    insert into public.family_members (
      user_id,
      first_name,
      birth_date,
      relationship
    )
    values (
      target_user_id,
      'Coryan',
      date '1998-08-28',
      'child'
    );
  end if;

  if not exists (
    select 1
    from public.family_members as fm
    where fm.user_id = target_user_id
      and fm.first_name = 'Meissa'
      and fm.birth_date = date '2010-01-26'
      and fm.relationship = 'child'
  ) then
    insert into public.family_members (
      user_id,
      first_name,
      birth_date,
      relationship
    )
    values (
      target_user_id,
      'Meissa',
      date '2010-01-26',
      'child'
    );
  end if;

  if not exists (
    select 1
    from public.family_members as fm
    where fm.user_id = target_user_id
      and fm.first_name = 'Yommala-Aïssata'
      and fm.birth_date = date '2016-04-30'
      and fm.relationship = 'child'
  ) then
    insert into public.family_members (
      user_id,
      first_name,
      birth_date,
      relationship
    )
    values (
      target_user_id,
      'Yommala-Aïssata',
      date '2016-04-30',
      'child'
    );
  end if;

  if not exists (
    select 1
    from public.family_members as fm
    where fm.user_id = target_user_id
      and fm.first_name = 'Chayan'
      and fm.birth_date = date '2018-09-19'
      and fm.relationship = 'child'
  ) then
    insert into public.family_members (
      user_id,
      first_name,
      birth_date,
      relationship
    )
    values (
      target_user_id,
      'Chayan',
      date '2018-09-19',
      'child'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'VAE'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'VAE',
      'preparation',
      'unknown_to_estimate'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'Maison Sénégal retraite'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'Maison Sénégal retraite',
      'idea',
      'unknown_to_estimate'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'Educoncret'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'Educoncret',
      'idea',
      'unknown_to_estimate'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'Logix Forma'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'Logix Forma',
      'idea',
      'unknown_to_estimate'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'Langues'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'Langues',
      'preparation',
      'unknown_to_estimate'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'Santé'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'Santé',
      'preparation',
      'unknown_to_estimate'
    );
  end if;

  if not exists (
    select 1
    from public.projects as p
    where p.user_id = target_user_id
      and p.title = 'Démarches importantes'
  ) then
    insert into public.projects (
      user_id,
      title,
      status,
      cost_estimation_status
    )
    values (
      target_user_id,
      'Démarches importantes',
      'preparation',
      'unknown_to_estimate'
    );
  end if;
end;
$$;

comment on function public.seed_mt_jef_demo(uuid)
is 'Development-only utility seed for local/admin use. Not intended for client exposure.';

revoke execute on function public.seed_mt_jef_demo(uuid) from public, anon, authenticated;
grant execute on function public.seed_mt_jef_demo(uuid) to service_role;
