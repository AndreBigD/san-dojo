-- Migração adicional. Não execute schema.sql novamente.
begin;
create schema if not exists dojo_private;
revoke all on schema dojo_private from public,anon,authenticated;
create table if not exists dojo_private.push_keys(
 singleton boolean primary key default true check(singleton),
 keys jsonb not null,public_key text not null,created_at timestamptz not null default now()
);
create table if not exists public.dojo_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 30 and 2048),
 p256dh text not null check(p256dh~'^[A-Za-z0-9_-]{87}$'),
 auth_key text not null check(auth_key~'^[A-Za-z0-9_-]{22}$'),
 minute_of_day integer not null check(minute_of_day between 0 and 1425 and minute_of_day%15=0),
 consent_version text not null default '2026-10-30.1' check(consent_version='2026-10-30.1'),
 consent_at timestamptz not null default now(),
 last_attempt_day date,last_sent_day date,last_test_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.dojo_push_subscriptions enable row level security;
alter table dojo_private.push_keys enable row level security;
revoke all on public.dojo_push_subscriptions,dojo_private.push_keys from public,anon,authenticated;

create or replace function public.dojo_push_endpoint_allowed(p_endpoint text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_endpoint~'^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/[^[:space:]#]+$',false);
$$;
revoke all on function public.dojo_push_endpoint_allowed(text) from public,anon,authenticated;

create or replace function public.dojo_push_subscribe(p_endpoint text,p_p256dh text,p_auth text,p_minute integer,p_confirm boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.dojo_is_active() then raise exception 'Acesso não autorizado';end if;
 if p_confirm is distinct from true then raise exception 'O responsável deve autorizar os lembretes';end if;
 if not public.dojo_push_endpoint_allowed(p_endpoint) then raise exception 'Serviço de notificações não reconhecido';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.dojo_push_subscriptions where endpoint=p_endpoint and user_id<>auth.uid()) then raise exception 'Reative as notificações deste aparelho';end if;
 if (select count(*) from public.dojo_push_subscriptions where user_id=auth.uid())>=5 and not exists(select 1 from public.dojo_push_subscriptions where endpoint=p_endpoint and user_id=auth.uid()) then raise exception 'Limite de cinco aparelhos. Desative os anteriores na sua conta';end if;
 insert into public.dojo_push_subscriptions(user_id,endpoint,p256dh,auth_key,minute_of_day) values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_minute)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,minute_of_day=excluded.minute_of_day,consent_at=now(),updated_at=now()
 where public.dojo_push_subscriptions.user_id=auth.uid() returning id into v_id;
 return v_id;
end;$$;
create or replace function public.dojo_push_status(p_endpoint text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('enabled',true,'minute',minute_of_day,'consent_at',consent_at) from public.dojo_push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint),'{}'::jsonb);
$$;
create or replace function public.dojo_push_disable(p_endpoint text default null) returns void language sql security definer set search_path='' as $$
 delete from public.dojo_push_subscriptions where user_id=auth.uid() and (p_endpoint is null or endpoint=p_endpoint);
$$;
revoke all on function public.dojo_push_subscribe(text,text,text,integer,boolean),public.dojo_push_status(text),public.dojo_push_disable(text) from public,anon;
grant execute on function public.dojo_push_subscribe(text,text,text,integer,boolean),public.dojo_push_status(text),public.dojo_push_disable(text) to authenticated;

-- Somente a função de servidor consegue ler ou inicializar as chaves VAPID.
create or replace function public.dojo_push_get_keys() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('keys',keys,'public_key',public_key) from dojo_private.push_keys where singleton;
$$;
create or replace function public.dojo_push_init_keys(p_keys jsonb,p_public text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_keys->'privateKey'->>'d' is null or p_public!~'^[A-Za-z0-9_-]{87}$' then raise exception 'Configuração inválida';end if;
 insert into dojo_private.push_keys(keys,public_key) values(p_keys,p_public) on conflict(singleton) do nothing;
 return public.dojo_push_get_keys();
end;$$;
create or replace function public.dojo_push_take_batch(p_now timestamptz default now())
returns table(id uuid,endpoint text,p256dh text,auth_key text) language sql security definer set search_path='' as $$
 with eligible as (
  select s.id from public.dojo_push_subscriptions s join public.dojo_profiles p on p.id=s.user_id
  where p.active and (exists(select 1 from public.dojo_admins a where a.user_id=s.user_id) or (
   exists(select 1 from public.dojo_guardians g where g.user_id=s.user_id and g.status='approved' and g.consent_version='2026-10-29.1')
   and not exists(select 1 from public.dojo_privacy_requests r where r.user_id=s.user_id and r.status in('pending','processing'))))
  and s.last_attempt_day is distinct from (p_now at time zone 'America/Sao_Paulo')::date
  and (extract(hour from p_now at time zone 'America/Sao_Paulo')*60+extract(minute from p_now at time zone 'America/Sao_Paulo')) between s.minute_of_day and s.minute_of_day+29
  and not exists(select 1 from public.dojo_progress d where d.user_id=s.user_id and coalesce(d.data->'days','[]'::jsonb) ? to_char(p_now at time zone 'America/Sao_Paulo','YYYY-MM-DD'))
  order by s.id limit 50 for update of s skip locked
 ),claimed as (
  update public.dojo_push_subscriptions s set last_attempt_day=(p_now at time zone 'America/Sao_Paulo')::date
  from eligible e where s.id=e.id returning s.id,s.endpoint,s.p256dh,s.auth_key
 ) select * from claimed;
$$;
create or replace function public.dojo_push_result(p_id uuid,p_gone boolean,p_sent boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_gone then delete from public.dojo_push_subscriptions where id=p_id;
 elsif p_sent then update public.dojo_push_subscriptions set last_sent_day=last_attempt_day where id=p_id;end if;
end;$$;
revoke all on function public.dojo_push_get_keys(),public.dojo_push_init_keys(jsonb,text),public.dojo_push_take_batch(timestamptz),public.dojo_push_result(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.dojo_push_get_keys(),public.dojo_push_init_keys(jsonb,text),public.dojo_push_take_batch(timestamptz),public.dojo_push_result(uuid,boolean,boolean) to service_role;

create or replace function public.dojo_push_test_target(p_user uuid,p_endpoint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 update public.dojo_push_subscriptions set last_test_at=now() where user_id=p_user and endpoint=p_endpoint
 and (last_test_at is null or last_test_at<now()-interval '1 minute')
 returning jsonb_build_object('endpoint',endpoint,'p256dh',p256dh,'auth_key',auth_key) into v_result;
 return v_result;
end;$$;
revoke all on function public.dojo_push_test_target(uuid,text) from public,anon,authenticated;
grant execute on function public.dojo_push_test_target(uuid,text) to service_role;

-- Retirada de autorização ou pedido de exclusão também cancela os lembretes.
create or replace function public.dojo_push_cancel_on_privacy() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_table_name='dojo_guardians' and new.status<>'approved') or (tg_table_name='dojo_privacy_requests' and new.status in('pending','processing')) then
  delete from public.dojo_push_subscriptions where user_id=new.user_id;
 end if;return new;
end;$$;
revoke all on function public.dojo_push_cancel_on_privacy() from public,anon,authenticated;
drop trigger if exists dojo_push_guardian_cancel on public.dojo_guardians;
create trigger dojo_push_guardian_cancel after insert or update of status on public.dojo_guardians for each row execute function public.dojo_push_cancel_on_privacy();
drop trigger if exists dojo_push_erasure_cancel on public.dojo_privacy_requests;
create trigger dojo_push_erasure_cancel after insert or update of status on public.dojo_privacy_requests for each row execute function public.dojo_push_cancel_on_privacy();
commit;
