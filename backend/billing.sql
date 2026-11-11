-- Migração adicional. Executar após schema.sql, guardian-controls.sql e automatic-access.sql.
-- Os clientes não escrevem pagamentos nem direitos de assinatura.
begin;
create table if not exists public.dojo_billing_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 environment text not null check(environment in ('sandbox','production')),
 price_cents integer not null check(price_cents>0),
 terms_version text not null,
 state text not null default 'creating' check(state in ('creating','pending','active','cancelled','expired')),
 checkout_id text unique,
 subscription_id text unique,
 renewal_cancelled boolean not null default false,
 created_at timestamptz not null default now(),
 closed_at timestamptz
);
create unique index if not exists dojo_one_billing_order on public.dojo_billing_orders(user_id,environment) where closed_at is null;
create table if not exists public.dojo_billing_payments (
 environment text not null,
 payment_id text not null,
 order_id uuid not null references public.dojo_billing_orders(id),
 amount_cents integer not null check(amount_cents>0),
 status text not null,
 revoked boolean not null,
 period_start timestamptz not null,
 period_end timestamptz not null check(period_end>period_start),
 observed_at timestamptz not null,
 primary key(environment,payment_id)
);
create table if not exists public.dojo_billing_events (
 environment text not null,
 event_id text not null,
 kind text not null,
 order_id uuid not null references public.dojo_billing_orders(id),
 received_at timestamptz not null default now(),
 primary key(environment,event_id)
);
alter table public.dojo_billing_orders enable row level security;
alter table public.dojo_billing_payments enable row level security;
alter table public.dojo_billing_events enable row level security;
revoke all on public.dojo_billing_orders,public.dojo_billing_payments,public.dojo_billing_events from public,anon,authenticated;
grant all on public.dojo_billing_orders,public.dojo_billing_payments,public.dojo_billing_events to service_role;

create or replace function public.dojo_billing_reserve(p_user uuid,p_environment text,p_price integer,p_terms text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.dojo_billing_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_environment,0));
 if not exists(select 1 from public.dojo_profiles where id=p_user and active)
 or exists(select 1 from public.dojo_privacy_requests where user_id=p_user and status in ('pending','processing'))
 or not (exists(select 1 from public.dojo_admins where user_id=p_user) or exists(select 1 from public.dojo_guardians where user_id=p_user and status in ('approved','authorized') and consent_version='2026-10-29.1')) then raise exception 'Conta não autorizada'; end if;
 select * into o from public.dojo_billing_orders where user_id=p_user and environment=p_environment and closed_at is null;
 if found then return jsonb_build_object('new',false,'order',to_jsonb(o)); end if;
 if exists(select 1 from public.dojo_billing_payments p join public.dojo_billing_orders b on b.id=p.order_id where b.user_id=p_user and b.environment=p_environment and not p.revoked and p.period_end>now() and p.status in ('CONFIRMED','RECEIVED')) then raise exception 'Período pago ainda vigente'; end if;
 insert into public.dojo_billing_orders(user_id,environment,price_cents,terms_version) values(p_user,p_environment,p_price,p_terms) returning * into o;
 return jsonb_build_object('new',true,'order',to_jsonb(o));
end; $$;

create or replace function public.dojo_billing_apply(p_order uuid,p_environment text,p_event text,p_kind text,p_subscription text,p_snapshot jsonb,p_observed timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare o public.dojo_billing_orders;
begin
 select * into o from public.dojo_billing_orders where id=p_order and environment=p_environment for update;
 if not found then raise exception 'Pedido desconhecido'; end if;
 if exists(select 1 from public.dojo_billing_events where environment=p_environment and event_id=p_event) then return; end if;
 if p_subscription is not null and o.subscription_id is not null and o.subscription_id<>p_subscription then raise exception 'Assinatura divergente'; end if;
 if p_subscription is not null then update public.dojo_billing_orders set subscription_id=p_subscription,state=case when renewal_cancelled then state else 'active' end where id=o.id; end if;
 if p_kind in ('SUBSCRIPTION_DELETED','SUBSCRIPTION_INACTIVATED','CANCELLED_BY_OWNER') then
  update public.dojo_billing_orders set renewal_cancelled=true,state='cancelled',closed_at=now() where id=o.id;
 elsif p_kind in ('CHECKOUT_CANCELED','CHECKOUT_EXPIRED') and o.subscription_id is null then
  update public.dojo_billing_orders set state=case when p_kind='CHECKOUT_EXPIRED' then 'expired' else 'cancelled' end,closed_at=now() where id=o.id;
 end if;
 if p_snapshot is not null then
  if (p_snapshot->>'amount')::integer<>o.price_cents or p_snapshot->>'subscription' is distinct from p_subscription then raise exception 'Pagamento divergente'; end if;
  if exists(select 1 from public.dojo_billing_payments where environment=p_environment and payment_id=p_snapshot->>'payment' and order_id<>o.id) then raise exception 'Pagamento já vinculado'; end if;
  insert into public.dojo_billing_payments(environment,payment_id,order_id,amount_cents,status,revoked,period_start,period_end,observed_at)
  values(p_environment,p_snapshot->>'payment',o.id,o.price_cents,p_snapshot->>'status',(p_snapshot->>'revoked')::boolean,(p_snapshot->>'start')::timestamptz,(p_snapshot->>'end')::timestamptz,p_observed)
  on conflict(environment,payment_id) do update set status=excluded.status,revoked=excluded.revoked,observed_at=excluded.observed_at
   where public.dojo_billing_payments.observed_at<=excluded.observed_at;
 end if;
 insert into public.dojo_billing_events(environment,event_id,kind,order_id) values(p_environment,p_event,left(p_kind,80),o.id);
end; $$;

create or replace function public.dojo_billing_status(p_user uuid,p_environment text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('serverNow',now(),'active',exists(select 1 from public.dojo_billing_payments p join public.dojo_billing_orders o on o.id=p.order_id where o.user_id=p_user and o.environment=p_environment and not p.revoked and p.status in ('CONFIRMED','RECEIVED') and p.period_start<=now() and p.period_end>now()),
 'periodEnd',(select max(p.period_end) from public.dojo_billing_payments p join public.dojo_billing_orders o on o.id=p.order_id where o.user_id=p_user and o.environment=p_environment and not p.revoked and p.status in ('CONFIRMED','RECEIVED') and p.period_start<=now() and p.period_end>now()),
 'order',(select jsonb_build_object('id',id,'state',state,'renewalCancelled',renewal_cancelled,'hasCheckout',checkout_id is not null,'hasSubscription',subscription_id is not null,'priceCents',price_cents) from public.dojo_billing_orders where user_id=p_user and environment=p_environment order by created_at desc limit 1),
 'payments',coalesce((select jsonb_agg(r) from (select p.amount_cents,p.status,p.revoked,p.period_start,p.period_end from public.dojo_billing_payments p join public.dojo_billing_orders o on o.id=p.order_id where o.user_id=p_user and o.environment=p_environment order by p.period_start desc limit 12) r),'[]'::jsonb));
$$;
revoke all on function public.dojo_billing_reserve(uuid,text,integer,text),public.dojo_billing_apply(uuid,text,text,text,text,jsonb,timestamptz),public.dojo_billing_status(uuid,text) from public,anon,authenticated;
grant execute on function public.dojo_billing_reserve(uuid,text,integer,text),public.dojo_billing_apply(uuid,text,text,text,text,jsonb,timestamptz),public.dojo_billing_status(uuid,text) to service_role;
commit;
