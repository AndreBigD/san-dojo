-- Execute somente no SQL Editor do seu projeto, depois de entrar no app com sua conta.
-- Copie o User UID da SUA conta em Authentication > Users. Não escolha o primeiro aluno.
-- Não execute com o texto de exemplo: substitua pelo UUID real da sua conta.
insert into public.dojo_admins(user_id)
values ('COLE_AQUI_O_USER_UID_DA_SUA_CONTA'::uuid);

-- A tabela admite um único administrador e não pode ser editada pelos alunos.
