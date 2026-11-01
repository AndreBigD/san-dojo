-- Etapa 2: migração adicional; não executar schema.sql novamente.
begin;
create table if not exists public.dojo_guardians (
 user_id uuid primary key references auth.users(id) on delete cascade,
 guardian_name text not null check(length(guardian_name) between 3 and 80),
 relationship text not null check(relationship in ('mae','pai','responsavel_legal')),
 learner_alias text not null check(length(learner_alias) between 2 and 40),
 status text not null check(status in ('pending','approved','rejected','withdrawn')),
 consent_version text not null,
 revision integer not null default 1,
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 verification_method text check(verification_method in ('presencial','contato_conhecido')),
 verification_note text not null default '' check(length(verification_note)<=300)
);
create table if not exists public.dojo_privacy_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('pending','processing','cancelled')),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.dojo_guardian_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,
 consent_version text,
 revision integer,
 created_at timestamptz not null default now()
);
alter table public.dojo_guardians enable row level security;
alter table public.dojo_privacy_requests enable row level security;
alter table public.dojo_guardian_events enable row level security;
revoke all on public.dojo_guardians,public.dojo_privacy_requests,public.dojo_guardian_events from public,anon,authenticated;
grant select on public.dojo_guardians,public.dojo_privacy_requests,public.dojo_guardian_events to authenticated;
drop policy if exists dojo_guardian_read on public.dojo_guardians;
create policy dojo_guardian_read on public.dojo_guardians for select to authenticated using(user_id=auth.uid() or public.dojo_is_admin());
drop policy if exists dojo_privacy_read on public.dojo_privacy_requests;
create policy dojo_privacy_read on public.dojo_privacy_requests for select to authenticated using(user_id=auth.uid() or public.dojo_is_admin());
drop policy if exists dojo_guardian_event_read on public.dojo_guardian_events;
create policy dojo_guardian_event_read on public.dojo_guardian_events for select to authenticated using(user_id=auth.uid() or public.dojo_is_admin());

create or replace function public.dojo_is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dojo_profiles p where p.id=auth.uid() and p.active
 and (public.dojo_is_admin() or (
 exists(select 1 from public.dojo_guardians g where g.user_id=p.id and g.status='approved' and g.consent_version='2026-10-29.1')
 and not exists(select 1 from public.dojo_privacy_requests r where r.user_id=p.id and r.status in ('pending','processing')))));
$$;

create or replace function public.dojo_request_guardian(p_name text,p_relationship text,p_alias text,p_version text,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
 if auth.uid() is null or public.dojo_is_admin() or not exists(select 1 from public.dojo_profiles where id=auth.uid() and active) then raise exception 'Acesso não permitido'; end if;
 if p_confirm is distinct from true or p_version is distinct from '2026-10-29.1' then raise exception 'Leia e confirme a autorização atual'; end if;
 if exists(select 1 from public.dojo_privacy_requests where user_id=auth.uid() and status in ('pending','processing')) then raise exception 'Há um pedido de exclusão em andamento'; end if;
 insert into public.dojo_guardians(user_id,guardian_name,relationship,learner_alias,status,consent_version)
 values(auth.uid(),btrim(p_name),p_relationship,btrim(p_alias),'pending',p_version)
 on conflict(user_id) do update set guardian_name=excluded.guardian_name,relationship=excluded.relationship,learner_alias=excluded.learner_alias,
 status='pending',consent_version=excluded.consent_version,revision=public.dojo_guardians.revision+1,requested_at=now(),reviewed_at=null,reviewed_by=null,verification_method=null,verification_note=''
 returning revision into v_revision;
 insert into public.dojo_guardian_events(user_id,actor_id,action,consent_version,revision) values(auth.uid(),auth.uid(),'requested',p_version,v_revision);
end;
$$;
create or replace function public.dojo_review_guardian(p_user uuid,p_revision integer,p_approve boolean,p_method text,p_note text,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare g public.dojo_guardians;
begin
 if not public.dojo_is_admin() or not exists(select 1 from public.dojo_profiles where id=auth.uid() and active) then raise exception 'Somente administrador'; end if;
 select * into g from public.dojo_guardians where user_id=p_user for update;
 if not found or g.status<>'pending' or g.revision<>p_revision then raise exception 'Solicitação mudou. Atualize a lista'; end if;
 if p_confirm is distinct from true or p_approve is null or p_method is null or p_method not in ('presencial','contato_conhecido') or length(btrim(p_note)) not between 8 and 300 then raise exception 'Registre a conferência com o responsável'; end if;
 if exists(select 1 from public.dojo_privacy_requests where user_id=p_user and status in ('pending','processing')) then raise exception 'Exclusão solicitada. Não liberar acesso'; end if;
 update public.dojo_guardians set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid(),verification_method=p_method,verification_note=btrim(p_note) where user_id=p_user;
 insert into public.dojo_guardian_events(user_id,actor_id,action,consent_version,revision) values(p_user,auth.uid(),case when p_approve then 'approved' else 'rejected' end,g.consent_version,g.revision);
end;
$$;
create or replace function public.dojo_withdraw_guardian() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.dojo_is_admin() then raise exception 'Acesso não permitido'; end if;
 update public.dojo_guardians set status='withdrawn',revision=revision+1,reviewed_at=null,reviewed_by=null,verification_method=null,verification_note='' where user_id=auth.uid();
 insert into public.dojo_guardian_events(user_id,actor_id,action) values(auth.uid(),auth.uid(),'withdrawn');
end;
$$;
create or replace function public.dojo_request_erasure(p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.dojo_is_admin() or p_confirm is distinct from true then raise exception 'Confirme o pedido. Administrador: use o contato de privacidade'; end if;
 insert into public.dojo_privacy_requests(user_id,status) values(auth.uid(),'pending')
 on conflict(user_id) do update set status=case when public.dojo_privacy_requests.status='processing' then 'processing' else 'pending' end,requested_at=case when public.dojo_privacy_requests.status in ('pending','processing') then public.dojo_privacy_requests.requested_at else now() end,updated_at=now();
 update public.dojo_guardians set status='withdrawn',revision=revision+1 where user_id=auth.uid();
 insert into public.dojo_guardian_events(user_id,actor_id,action) values(auth.uid(),auth.uid(),'erasure_requested');
end;
$$;
create or replace function public.dojo_cancel_erasure() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.dojo_is_admin() then raise exception 'Acesso não permitido'; end if;
 update public.dojo_privacy_requests set status='cancelled',updated_at=now() where user_id=auth.uid() and status in ('pending','processing');
 insert into public.dojo_guardian_events(user_id,actor_id,action) values(auth.uid(),auth.uid(),'erasure_cancelled');
end;
$$;
create or replace function public.dojo_process_erasure(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.dojo_is_admin() or not exists(select 1 from public.dojo_profiles where id=auth.uid() and active) then raise exception 'Somente administrador'; end if;
 update public.dojo_privacy_requests set status='processing',updated_at=now() where user_id=p_user and status='pending';
 insert into public.dojo_guardian_events(user_id,actor_id,action) values(p_user,auth.uid(),'erasure_processing');
end;
$$;
revoke all on function public.dojo_request_guardian(text,text,text,text,boolean),public.dojo_review_guardian(uuid,integer,boolean,text,text,boolean),public.dojo_withdraw_guardian(),public.dojo_request_erasure(boolean),public.dojo_cancel_erasure(),public.dojo_process_erasure(uuid) from public,anon,authenticated;
grant execute on function public.dojo_request_guardian(text,text,text,text,boolean),public.dojo_review_guardian(uuid,integer,boolean,text,text,boolean),public.dojo_withdraw_guardian(),public.dojo_request_erasure(boolean),public.dojo_cancel_erasure(),public.dojo_process_erasure(uuid) to authenticated;
commit;
