# Configuração de um ambiente próprio

O projeto funciona localmente como demonstração sem banco. Para usar contas reais:

1. Crie um projeto próprio no Supabase.
2. Leia e execute `backend/schema.sql`, depois `backend/guardian-controls.sql`, em um banco novo. Revise os scripts antes da execução; não são um mecanismo automático de atualização de um banco existente.
3. Habilite o provedor Google no Supabase e configure as credenciais OAuth no servidor. Cadastre a URL de retorno `/auth/v1/callback` do seu próprio projeto no Google Cloud.
4. Em `dist/accounts-config.js`, preencha `supabaseUrl` e `publishableKey` com a URL e a chave **publicável** do seu projeto. Ative `googleEnabled`.
5. Configure a URL do site e os redirecionamentos permitidos no Supabase Auth para seu próprio domínio.
6. Entre no app e use `backend/authorize-owner.sql` com o UUID da sua própria conta para definir o administrador. A autorização é aplicada no banco.
7. Revise os fluxos de responsáveis, privacidade, contato e exclusão para sua implantação antes de receber alunos.

## Notificações — validação em andamento

Os arquivos `backend/push-notifications.sql`, `backend/push-schedule.sql` e `backend/dojo-push/index.ts` implementam lembretes opcionais. Substitua os marcadores `SEU_PROJETO_SUPABASE`, o domínio e o contato pelos seus dados antes de publicar o serviço.

A função valida o usuário por conta própria. O agendamento usa um segredo mantido no Vault do Supabase; as chaves VAPID ficam no servidor. Não envie esses valores para o navegador nem para o GitHub.

No iPhone, Web Push exige um dispositivo compatível, o app adicionado à Tela de Início e autorização explícita no aparelho. A entrega real precisa ser conferida; a presença do código não garante a chegada do aviso.

## Publicação

Sirva `dist/` em HTTPS. O `netlify.toml` já indica essa pasta. A cópia do repositório não altera automaticamente o site em produção.

O frontend usa a distribuição do SDK Supabase em `dist/supabase-sdk.js`. As licenças correspondentes estão em `licenses/`. Não há etapa obrigatória de compilação da interface.

Nunca publique `service_role`, `sb_secret`, segredos OAuth, chaves privadas VAPID, tokens de sessão, exportações do banco ou arquivos de alunos.
