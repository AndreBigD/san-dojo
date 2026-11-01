-- Executar após instalar push-notifications.sql e publicar dojo-push.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Segredo exclusivo do agendamento, gerado no banco e guardado no Vault.
do $$begin
 if not exists(select 1 from vault.secrets where name='dojo_push_job_secret') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'dojo_push_job_secret','Autenticação exclusiva dos lembretes San Dojo');
 end if;
end;$$;
create or replace function public.dojo_push_job_authorized(p_secret text) returns boolean language sql stable security definer set search_path='' as $$
 select length(p_secret)=64 and exists(select 1 from vault.decrypted_secrets where name='dojo_push_job_secret' and decrypted_secret=p_secret);
$$;
revoke all on function public.dojo_push_job_authorized(text) from public,anon,authenticated;
grant execute on function public.dojo_push_job_authorized(text) to service_role;
select cron.schedule('san-dojo-lembretes','*/15 * * * *', $job$
 select net.http_post(
  url:='https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/dojo-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-dojo-job-secret',(select decrypted_secret from vault.decrypted_secrets where name='dojo_push_job_secret')),
  body:='{"action":"send"}'::jsonb,timeout_milliseconds:=50000
 );
$job$);
commit;
-- Para pausar sem excluir configurações: select cron.unschedule('san-dojo-lembretes');
