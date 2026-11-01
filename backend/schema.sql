-- Execute no SQL Editor de um projeto Supabase dedicado ao San Dojo.
-- A chave de serviço e as credenciais Google/Apple nunca vão para o HTML.
begin;

create table public.dojo_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Aluno' check (length(display_name) between 1 and 80),
 email text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.dojo_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 only_owner boolean not null default true unique check (only_owner)
);
create table public.dojo_materials (
 target_id text primary key check (target_id ~ '^[a-z0-9-]{1,100}$'),
 title text not null check (length(title) between 1 and 80),
 description text not null default '' check (length(description) <= 300),
 youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
 video_path text check (video_path ~ '^materials/[a-z0-9-]+/[a-f0-9-]+\.(mp4|webm)$'),
 image_path text check (image_path ~ '^materials/[a-z0-9-]+/[a-f0-9-]+\.(png|jpg|webp)$'),
 updated_at timestamptz not null default now(),
 check (youtube_id is null or video_path is null),
 check (youtube_id is not null or video_path is not null or image_path is not null)
);
create table public.dojo_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2000000),
 updated_at timestamptz not null default now()
);
create table public.dojo_approvals (
 user_id uuid not null references auth.users(id) on delete cascade,
 target_id text not null check (target_id ~ '^(dojo|bases|kihon|ido|kata|integracao|grade-([0-9]|1[0-2]))$'),
 note text not null default '' check (length(note) <= 300),
 approved_at timestamptz not null default now(),
 primary key (user_id,target_id)
);

alter table public.dojo_profiles enable row level security;
alter table public.dojo_admins enable row level security;
alter table public.dojo_materials enable row level security;
alter table public.dojo_progress enable row level security;
alter table public.dojo_approvals enable row level security;

create function public.dojo_is_admin() returns boolean language sql stable security definer
 set search_path = '' as $$
 select exists(select 1 from public.dojo_admins where user_id = auth.uid());
$$;
create function public.dojo_is_active() returns boolean language sql stable security definer
 set search_path = '' as $$
 select exists(select 1 from public.dojo_profiles where id = auth.uid() and active);
$$;
revoke all on function public.dojo_is_admin() from public, anon;
revoke all on function public.dojo_is_active() from public, anon;
grant execute on function public.dojo_is_admin(), public.dojo_is_active() to authenticated;

create function public.dojo_register_profile() returns trigger language plpgsql security definer
 set search_path = '' as $$
begin
 insert into public.dojo_profiles(id,display_name,email)
 values (new.id,coalesce(nullif(left(new.raw_user_meta_data->>'full_name',80),''),'Aluno'),new.email);
 return new;
end;
$$;
revoke all on function public.dojo_register_profile() from public, anon, authenticated;
create trigger dojo_new_account after insert on auth.users for each row execute function public.dojo_register_profile();
insert into public.dojo_profiles(id,display_name,email)
 select id,coalesce(nullif(left(raw_user_meta_data->>'full_name',80),''),'Aluno'),email from auth.users
 on conflict (id) do nothing;

revoke all on public.dojo_profiles,public.dojo_admins,public.dojo_materials,public.dojo_progress,public.dojo_approvals from anon,authenticated;
grant select on public.dojo_profiles,public.dojo_admins to authenticated;
grant update(active) on public.dojo_profiles to authenticated;
grant select,insert,update,delete on public.dojo_materials,public.dojo_approvals to authenticated;
grant select,insert,update,delete on public.dojo_progress to authenticated;

create policy dojo_profile_read on public.dojo_profiles for select to authenticated using (id=auth.uid() or public.dojo_is_admin());
create policy dojo_profile_suspend on public.dojo_profiles for update to authenticated
 using (public.dojo_is_admin() and id<>auth.uid()) with check (public.dojo_is_admin() and id<>auth.uid());
create policy dojo_owner_read on public.dojo_admins for select to authenticated using (user_id=auth.uid());
-- Não há política de escrita em dojo_admins: nenhum aluno pode se promover.
create policy dojo_material_read on public.dojo_materials for select to authenticated using (public.dojo_is_active());
create policy dojo_material_insert on public.dojo_materials for insert to authenticated with check (public.dojo_is_admin());
create policy dojo_material_update on public.dojo_materials for update to authenticated using (public.dojo_is_admin()) with check (public.dojo_is_admin());
create policy dojo_material_delete on public.dojo_materials for delete to authenticated using (public.dojo_is_admin());
create policy dojo_progress_read on public.dojo_progress for select to authenticated using ((user_id=auth.uid() and public.dojo_is_active()) or public.dojo_is_admin());
create policy dojo_progress_insert on public.dojo_progress for insert to authenticated with check (user_id=auth.uid() and public.dojo_is_active());
create policy dojo_progress_update on public.dojo_progress for update to authenticated using (user_id=auth.uid() and public.dojo_is_active()) with check (user_id=auth.uid() and public.dojo_is_active());
create policy dojo_progress_delete on public.dojo_progress for delete to authenticated using (user_id=auth.uid() and public.dojo_is_active());
create policy dojo_approval_read on public.dojo_approvals for select to authenticated using ((user_id=auth.uid() and public.dojo_is_active()) or public.dojo_is_admin());
create policy dojo_approval_insert on public.dojo_approvals for insert to authenticated with check (public.dojo_is_admin());
create policy dojo_approval_update on public.dojo_approvals for update to authenticated using (public.dojo_is_admin()) with check (public.dojo_is_admin());
create policy dojo_approval_delete on public.dojo_approvals for delete to authenticated using (public.dojo_is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('dojo-exercises','dojo-exercises',false,262144000,array['video/mp4','video/webm','image/png','image/jpeg','image/webp']);
create policy dojo_file_read on storage.objects for select to authenticated
 using (bucket_id='dojo-exercises' and public.dojo_is_active() and (
  public.dojo_is_admin() or exists (
   select 1 from public.dojo_materials m where m.video_path=storage.objects.name or m.image_path=storage.objects.name
  )
 ));
create policy dojo_file_insert on storage.objects for insert to authenticated
 with check (bucket_id='dojo-exercises' and public.dojo_is_admin());
create policy dojo_file_update on storage.objects for update to authenticated
 using (bucket_id='dojo-exercises' and public.dojo_is_admin())
 with check (bucket_id='dojo-exercises' and public.dojo_is_admin());
create policy dojo_file_delete on storage.objects for delete to authenticated
 using (bucket_id='dojo-exercises' and public.dojo_is_admin());
commit;
