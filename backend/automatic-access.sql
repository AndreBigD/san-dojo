-- Atualização de acesso: executar após guardian-controls.sql e push-notifications.sql.
-- A autorização é declarada pelo responsável; não é uma conferência de identidade.
begin;

alter table public.dojo_guardians drop constraint if exists dojo_guardians_status_check;
alter table public.dojo_guardians add constraint dojo_guardians_status_check
 check(status in ('pending','approved','authorized','rejected','withdrawn'));

create or replace function public.dojo_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dojo_profiles p where p.id=auth.uid() and p.active
 and (public.dojo_is_admin() or (
  exists(select 1 from public.dojo_guardians g where g.user_id=p.id
   and g.status in ('approved','authorized') and g.consent_version='2026-10-29.1')
  and not exists(select 1 from public.dojo_privacy_requests r
   where r.user_id=p.id and r.status in ('pending','processing')))));
$$;

create or replace function public.dojo_request_guardian(
 p_name text,p_relationship text,p_alias text,p_version text,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
 if auth.uid() is null or public.dojo_is_admin() or not exists(
  select 1 from public.dojo_profiles where id=auth.uid() and active
 ) then raise exception 'Acesso não permitido'; end if;
 if p_confirm is distinct from true or p_version is distinct from '2026-10-29.1'
 then raise exception 'Leia e confirme a autorização atual'; end if;
 if exists(select 1 from public.dojo_privacy_requests
  where user_id=auth.uid() and status in ('pending','processing'))
 then raise exception 'Há um pedido de exclusão em andamento'; end if;
 insert into public.dojo_guardians(user_id,guardian_name,relationship,learner_alias,status,consent_version)
 values(auth.uid(),btrim(p_name),p_relationship,btrim(p_alias),'authorized',p_version)
 on conflict(user_id) do update set guardian_name=excluded.guardian_name,
 relationship=excluded.relationship,learner_alias=excluded.learner_alias,
 status='authorized',consent_version=excluded.consent_version,
 revision=public.dojo_guardians.revision+1,requested_at=now(),
 reviewed_at=null,reviewed_by=null,verification_method=null,verification_note=''
 returning revision into v_revision;
 insert into public.dojo_guardian_events(user_id,actor_id,action,consent_version,revision)
 values(auth.uid(),auth.uid(),'authorized',p_version,v_revision);
end;
$$;

create or replace function public.dojo_push_cancel_on_privacy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (tg_table_name='dojo_guardians' and new.status not in ('approved','authorized'))
 or (tg_table_name='dojo_privacy_requests' and new.status in ('pending','processing')) then
  delete from public.dojo_push_subscriptions where user_id=new.user_id;
 end if;
 return new;
end;
$$;

create or replace function public.dojo_push_take_batch(p_now timestamptz default now())
returns table(id uuid,endpoint text,p256dh text,auth_key text)
language sql security definer set search_path='' as $$
 with eligible as (
  select s.id from public.dojo_push_subscriptions s
  join public.dojo_profiles p on p.id=s.user_id
  where p.active and (exists(select 1 from public.dojo_admins a where a.user_id=s.user_id) or (
   exists(select 1 from public.dojo_guardians g where g.user_id=s.user_id
    and g.status in ('approved','authorized') and g.consent_version='2026-10-29.1')
   and not exists(select 1 from public.dojo_privacy_requests r
    where r.user_id=s.user_id and r.status in ('pending','processing'))))
  and s.last_attempt_day is distinct from (p_now at time zone 'America/Sao_Paulo')::date
  and (extract(hour from p_now at time zone 'America/Sao_Paulo')*60
   +extract(minute from p_now at time zone 'America/Sao_Paulo'))
   between s.minute_of_day and s.minute_of_day+29
  and not exists(select 1 from public.dojo_progress d where d.user_id=s.user_id
   and coalesce(d.data->'days','[]'::jsonb) ? to_char(p_now at time zone 'America/Sao_Paulo','YYYY-MM-DD'))
  order by s.id limit 50 for update of s skip locked
 ),claimed as (
  update public.dojo_push_subscriptions s set last_attempt_day=(p_now at time zone 'America/Sao_Paulo')::date
  from eligible e where s.id=e.id returning s.id,s.endpoint,s.p256dh,s.auth_key
 ) select * from claimed;
$$;

-- Libera solicitações já autorizadas pelo responsável, sem forjar uma aprovação do sensei.
with released as (
 update public.dojo_guardians g set status='authorized',reviewed_at=null,reviewed_by=null,
 verification_method=null,verification_note=''
 where g.status='pending' and g.consent_version='2026-10-29.1'
 and exists(select 1 from public.dojo_profiles p where p.id=g.user_id and p.active)
 and not exists(select 1 from public.dojo_privacy_requests r
  where r.user_id=g.user_id and r.status in ('pending','processing'))
 returning g.user_id,g.consent_version,g.revision
)
insert into public.dojo_guardian_events(user_id,actor_id,action,consent_version,revision)
 select user_id,null,'automatic_access_enabled',consent_version,revision from released;

commit;
