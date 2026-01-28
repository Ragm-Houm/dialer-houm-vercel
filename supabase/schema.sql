-- Executives table (reemplaza la hoja "Ejecutivos")
create table if not exists public.executives (
  ejecutivo_email text primary key,
  telefono_ejecutivo_e164 text,
  caller_id_asignado text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leads table (reemplaza las hojas por pais, ej: CO_Base)
create table if not exists public.leads (
  id bigserial primary key,
  lead_id_interno text,
  nombre text,
  telefono_e164 text,
  pipedrive_deal_id bigint,
  pais text not null,
  estado text,
  intentos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_pais_estado_idx on public.leads (pais, estado);
create index if not exists leads_pipedrive_deal_id_idx on public.leads (pipedrive_deal_id);

-- Estado temporal por deal/campana para review de telefonos
create table if not exists public.phone_review (
  id bigserial primary key,
  country text not null,
  pipeline_id integer not null,
  stage_id integer not null,
  deal_id bigint not null,
  person_id bigint,
  reviewed_by text,
  deal_title text,
  person_name text,
  stage_name text,
  candidates jsonb not null default '[]'::jsonb,
  selected_primary text,
  selected_secondary text,
  notes text,
  stats jsonb not null default '{}'::jsonb,
  skipped boolean not null default false,
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, pipeline_id, stage_id)
);

create index if not exists phone_review_campaign_idx on public.phone_review (country, pipeline_id, stage_id);

-- Eventos operativos para metricas y auditoria
create table if not exists public.review_events (
  id bigserial primary key,
  event_type text not null,
  country text not null,
  pipeline_id integer not null,
  stage_id integer not null,
  deal_id bigint not null,
  reviewed_by text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists review_events_campaign_idx on public.review_events (country, pipeline_id, stage_id, created_at desc);

-- Estado agregado por campana para evitar reprocesos y ver colas
create table if not exists public.review_campaign_state (
  id bigserial primary key,
  country text not null,
  pipeline_id integer not null,
  stage_id integer not null,
  queue_total integer not null default 0,
  queue_pending integer not null default 0,
  reviewed_total integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (country, pipeline_id, stage_id)
);

alter table if exists public.phone_review
  add column if not exists reviewed_by text;

alter table if exists public.phone_review
  add column if not exists notes text;

alter table if exists public.phone_review
  add column if not exists stats jsonb not null default '{}'::jsonb;

alter table if exists public.review_events
  add column if not exists reviewed_by text;

-- Usuarios con roles para permisos en la app
create table if not exists public.users (
  email text primary key,
  role text not null default 'ejecutivo',
  country text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check check (role in ('admin', 'supervisor', 'ejecutivo'))
);

-- Cola por campana para evitar que dos ejecutivos llamen el mismo deal
create table if not exists public.campaign_deals (
  id bigserial primary key,
  campaign_key text not null,
  country text not null,
  pipeline_id integer not null,
  stage_id integer not null,
  deal_id bigint not null,
  deal_title text,
  stage_name text,
  phone_primary text,
  phone_secondary text,
  has_valid_phone boolean not null default false,
  sort_time timestamptz,
  next_attempt_at timestamptz,
  status text not null default 'pending',
  assigned_to text,
  assigned_at timestamptz,
  lock_expires_at timestamptz,
  completed_at timestamptz,
  last_outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, pipeline_id, stage_id)
);

create index if not exists campaign_deals_campaign_idx
  on public.campaign_deals (campaign_key, status, lock_expires_at, sort_time);

create index if not exists campaign_deals_assigned_idx
  on public.campaign_deals (assigned_to, campaign_key, status);

alter table if exists public.users
  add column if not exists role text not null default 'ejecutivo';

alter table if exists public.users
  add column if not exists country text;

alter table if exists public.users
  add column if not exists activo boolean not null default true;

alter table if exists public.campaign_deals
  add column if not exists campaign_key text;

alter table if exists public.campaign_deals
  add column if not exists sort_time timestamptz;

alter table if exists public.campaign_deals
  add column if not exists status text not null default 'pending';

alter table if exists public.campaign_deals
  add column if not exists lock_expires_at timestamptz;

alter table if exists public.campaign_deals
  add column if not exists completed_at timestamptz;

alter table if exists public.campaign_deals
  add column if not exists last_outcome text;

alter table if exists public.campaign_deals
  add column if not exists stage_name text;

alter table if exists public.campaign_deals
  add column if not exists phone_primary text;

alter table if exists public.campaign_deals
  add column if not exists phone_secondary text;

alter table if exists public.campaign_deals
  add column if not exists has_valid_phone boolean not null default false;

create table if not exists public.campaigns (
  id bigserial primary key,
  campaign_key text not null unique,
  name text not null,
  country text not null,
  pipeline_id integer not null,
  stage_id integer not null,
  stage_name text,
  age_filter text,
  close_at timestamptz,
  close_tz text,
  no_time_limit boolean not null default false,
  allow_all_execs boolean not null default true,
  allowed_execs text[],
  status text not null default 'active',
  created_by text,
  total_leads integer not null default 0,
  valid_leads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_country_status_idx
  on public.campaigns (country, status, created_at desc);

-- Sesiones de campaña por ejecutivo (tiempo en campaña)
create table if not exists public.campaign_sessions (
  id bigserial primary key,
  campaign_key text not null,
  user_email text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0,
  call_seconds integer not null default 0,
  idle_seconds integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_sessions_campaign_idx
  on public.campaign_sessions (campaign_key, user_email, created_at desc);

-- Eventos operativos por campaña/lead
create table if not exists public.campaign_events (
  id bigserial primary key,
  campaign_key text not null,
  deal_id bigint,
  user_email text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists campaign_events_campaign_idx
  on public.campaign_events (campaign_key, created_at desc);
create index if not exists campaign_events_deal_idx
  on public.campaign_events (deal_id, created_at desc);

alter table if exists public.campaign_deals
  add column if not exists attempts integer not null default 0;

alter table if exists public.campaign_deals
  add column if not exists gestions integer not null default 0;

alter table if exists public.campaign_deals
  add column if not exists next_attempt_at timestamptz;

alter table if exists public.campaign_deals
  add column if not exists last_attempt_at timestamptz;

alter table if exists public.campaign_deals
  add column if not exists last_gestion_at timestamptz;

-- Incremento atomico de intentos
create or replace function public.increment_campaign_attempt(
  p_campaign_key text,
  p_deal_id bigint,
  p_user_email text
)
returns void
language plpgsql
as $$
begin
  update public.campaign_deals
  set attempts = coalesce(attempts, 0) + 1,
      last_attempt_at = now(),
      assigned_to = p_user_email,
      updated_at = now()
  where campaign_key = p_campaign_key
    and deal_id = p_deal_id;
end;
$$;

-- Incremento atomico de gestiones completas
create or replace function public.increment_campaign_gestion(
  p_campaign_key text,
  p_deal_id bigint,
  p_user_email text
)
returns void
language plpgsql
as $$
begin
  update public.campaign_deals
  set gestions = coalesce(gestions, 0) + 1,
      last_gestion_at = now(),
      assigned_to = p_user_email,
      updated_at = now()
  where campaign_key = p_campaign_key
    and deal_id = p_deal_id;
end;
$$;

alter table if exists public.campaigns
  add column if not exists close_at timestamptz;

alter table if exists public.campaigns
  add column if not exists close_tz text;

alter table if exists public.campaigns
  add column if not exists no_time_limit boolean not null default false;

alter table if exists public.campaigns
  add column if not exists allow_all_execs boolean not null default true;

alter table if exists public.campaigns
  add column if not exists allowed_execs text[];

create table if not exists public.call_outcomes (
  id bigserial primary key,
  key text not null unique,
  label text not null,
  activo boolean not null default true,
  outcome_type text not null default 'final',
  metric_bucket text not null default 'otro',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_outcomes_active_idx
  on public.call_outcomes (activo, sort_order);

alter table if exists public.call_outcomes
  add column if not exists outcome_type text not null default 'final';

alter table if exists public.call_outcomes
  add column if not exists metric_bucket text not null default 'otro';

insert into public.call_outcomes (key, label, activo, sort_order)
values
  ('no_contesta', 'No contesta', true, 1),
  ('interesado', 'Interesado', true, 2),
  ('fotos_agendadas', 'Fotos agendadas', true, 3),
  ('propiedad_publicada', 'Propiedad publicada', true, 4),
  ('propiedad_reservada', 'Propiedad reservada', true, 5),
  ('propiedad_arrendada', 'Propiedad arrendada', true, 6),
  ('informacion_falsa', 'Informacion falsa', true, 7),
  ('le_parece_caro', 'Le parece caro', true, 8),
  ('intentos_max', 'Intentos maximos', true, 9),
  ('disponibilidad_futura', 'Disponibilidad futura', true, 10)
on conflict (key) do nothing;

update public.call_outcomes
set outcome_type = case
  when key in ('no_contesta', 'disponibilidad_futura') then 'intermediate'
  else 'final'
end,
metric_bucket = case
  when key in ('interesado') then 'interesado'
  when key in ('fotos_agendadas') then 'agendado'
  when key in ('propiedad_publicada') then 'publicada'
  when key in ('propiedad_reservada') then 'reservada'
  when key in ('propiedad_arrendada') then 'arrendada'
  when key in ('informacion_falsa') then 'falso'
  when key in ('le_parece_caro') then 'caro'
  when key in ('intentos_max') then 'perdido'
  when key in ('no_contesta') then 'no_contesta'
  when key in ('disponibilidad_futura') then 'futuro'
  else 'otro'
end
where key in (
  'no_contesta',
  'interesado',
  'fotos_agendadas',
  'propiedad_publicada',
  'propiedad_reservada',
  'propiedad_arrendada',
  'informacion_falsa',
  'le_parece_caro',
  'intentos_max',
  'disponibilidad_futura'
);

-- Claim atomico del siguiente deal disponible en una campana
create or replace function public.claim_next_deal(
  p_campaign_key text,
  p_user_email text,
  p_lock_minutes integer default 10,
  p_max_attempts integer default 3,
  p_min_hours_between_attempts integer default 24,
  p_max_gestions integer default 5
)
returns setof public.campaign_deals
language plpgsql
as $$
declare
  v_row public.campaign_deals%rowtype;
begin
  select *
  into v_row
  from public.campaign_deals
  where campaign_key = p_campaign_key
    and coalesce(status, 'pending') <> 'done'
    and (has_valid_phone = true or has_valid_phone is null)
    and (
      assigned_to = p_user_email
      or (
        (lock_expires_at is null or lock_expires_at < now())
        and coalesce(attempts, 0) < greatest(p_max_attempts, 1)
        and coalesce(gestions, 0) < greatest(p_max_gestions, 1)
        and (next_attempt_at is null or next_attempt_at < now())
        and (
          last_attempt_at is null
          or last_attempt_at < now() - make_interval(hours => greatest(p_min_hours_between_attempts, 0))
        )
      )
    )
  order by coalesce(attempts, 0) asc, last_attempt_at asc nulls first, sort_time asc nulls last, id asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.campaign_deals
  set assigned_to = p_user_email,
      assigned_at = now(),
      lock_expires_at = now() + make_interval(mins => greatest(p_lock_minutes, 1)),
      status = 'locked',
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return next v_row;
end;
$$;

-- Liberar lock cuando se salta o se avanza manualmente
create or replace function public.release_deal_lock(
  p_campaign_key text,
  p_deal_id bigint,
  p_user_email text
)
returns void
language plpgsql
as $$
begin
  update public.campaign_deals
  set status = 'pending',
      lock_expires_at = now() - interval '1 second',
      updated_at = now()
  where campaign_key = p_campaign_key
    and deal_id = p_deal_id
    and assigned_to = p_user_email
    and status = 'locked';
end;
$$;
