# San Dojo Plus com Asaas

Implementação preparada em 11/11/2026. Produto confirmado por André: **R$ 11,99 por mês, energia ilimitada para uma conta de aluno**. Não há venda de KC nesta etapa. Cobranças reais estão desativadas. Não há uma assinatura de produção criada nem homologação externa concluída.

## Fluxo entregue

- Minha conta → San Dojo Plus: preço, renovação mensal, consentimento do responsável, contratação no Asaas, situação, últimas cobranças e cancelamento.
- Checkout hospedado no Asaas, `CREDIT_CARD` + `RECURRENT` + `MONTHLY`. O app não coleta cartão, CPF ou dados do pagador.
- Cadastro automático da assinatura pelo Checkout. O servidor associa a primeira cobrança à conta por `subscription.checkoutSession`, conferido na API do Asaas. Cobranças seguintes usam a mesma assinatura.
- Apenas cobranças confirmadas/recebidas, no valor esperado e ligadas à assinatura correta, concedem um período. Callback do navegador e `CHECKOUT_PAID` isolados não concedem acesso.
- Mês de vencimento com término no mesmo dia do mês seguinte, ajustado ao último dia quando necessário. Limites às 00h de Brasília. Sem crédito de dias adicionais a cada repetição de evento.
- Cancelar interrompe a recorrência e preserva períodos já pagos. Estorno, contestação ou reembolso parcial suspendem o benefício da cobrança afetada; ajustes excepcionais exigem atendimento.
- Pagamentos e eventos ficam em tabelas próprias, não editáveis por aluno nem pelo administrador através da API pública. A carteira gratuita de KC permanece independente.
- Sandbox isolado da produção e limitado à conta administradora.

## Arquivos do servidor

`backend/billing.sql` é uma migração adicional: não reaplicar `schema.sql`. Requer as tabelas de contas, responsáveis e acesso automático existentes.

Funções: `dojo-billing` e `dojo-asaas-webhook`. Compartilham os arquivos de `dojo-billing/`. Copiar as pastas para `supabase/functions/`, mantendo os caminhos. Mesclar `backend/billing-config.toml` no `supabase/config.toml`, sem substituir a configuração de notificações.

As duas funções são publicadas com verificação de JWT do gateway desativada. `dojo-billing` valida explicitamente o token do usuário com `auth.getUser`. `dojo-asaas-webhook` exige o segredo do header `asaas-access-token`. Não remover essas validações.

O RPC de reserva impede duas contratações abertas da mesma conta. Se a criação no Asaas sofrer timeout, a reserva fica bloqueada até conferir no painel do Asaas pelo `externalReference` do pedido. Não apagar o pedido e repetir automaticamente: isso poderia criar duas recorrências. Confirmar o checkout existente ou cancelá-lo no Asaas antes de fechar a reserva manualmente.

## Homologação no Sandbox

1. Criar conta em <https://sandbox.asaas.com/>. Ela é independente da conta de produção. Usar dados de teste e os cartões fictícios indicados pelo Asaas.
2. Gerar a chave de API **do Sandbox** no Asaas. Não enviar a chave pelo chat e não colocá-la em `accounts-config.js`.
3. Aplicar `billing.sql` no SQL Editor do Supabase do San Dojo.
4. Em Edge Functions → Secrets, configurar:
   - `ASAAS_MODE=sandbox`
   - `ASAAS_CHECKOUT_ENABLED=true`
   - `ASAAS_API_KEY` com a chave de testes
   - `ASAAS_WEBHOOK_TOKEN` com um segredo aleatório próprio, de pelo menos 32 caracteres e até 255, sem espaços. Não usar a chave de API como esse segredo.
   - `SAN_DOJO_SITE_URL=https://sandojokarate.com.br/`
5. Publicar as duas funções com a estrutura indicada. Os segredos `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente do Supabase; nunca copiar a chave de serviço para o app.
6. No Asaas Sandbox, cadastrar webhook para `https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/dojo-asaas-webhook`, com o mesmo token de autenticação, fila sequencial e e-mail de alerta do responsável. Selecionar:
   - `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`
   - `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED`
   - `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`
   - `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`
7. Publicar o pacote de testes no projeto **existente** `sandojokarate` do Netlify. O pacote usa `paymentsEnabled:true`, `paymentsEnvironment:'sandbox'` e `paymentsAdminOnly:true`: somente o administrador consulta a integração, e a tela recusa status e checkout de produção. Não usar uma nova publicação genérica que crie outro site.
8. Entrar como administrador. Conferir o rótulo **AMBIENTE DE TESTE**. Testar contratação, pagamento pendente, confirmação, notificação duplicada, mensalidade seguinte, cancelamento, estorno, falha de conexão e retorno ao plano gratuito após vencer.

## Critérios antes de cobrar de verdade

Além dos testes locais, conferir no Sandbox real: formato do checkout e da cobrança, criação da assinatura, preenchimento de `checkoutSession`, entrega dos webhooks, URL do checkout, cancelamento no Asaas, valores e tarifas da conta. Ainda não foi possível executar esses testes com uma conta Asaas conectada.

Revisar os termos preparados, o atendimento de reembolsos, os dados comerciais exigidos pelo Asaas e o processo de retenção/exclusão dos registros financeiros. A migração impede apagar diretamente uma conta que ainda tenha pedidos financeiros: cancelar a recorrência e avaliar anonimização/retenção antes da exclusão. Isso não deve deixar uma cobrança ativa após pedido de encerramento.

Após homologação e autorização para ativação: configurar credenciais e webhook **de produção**, trocar `ASAAS_MODE=production`, definir `paymentsEnvironment:'production'` e `paymentsAdminOnly:false` no app e manter o mesmo preço. Nunca reutilizar o token de webhook do Sandbox em produção. Alterar textos de “em preparação” nos termos e na privacidade quando a integração estiver ativa. Só então anunciar a assinatura.

Para pausar novas vendas, usar `ASAAS_CHECKOUT_ENABLED=false`. Manter as funções, credenciais de produção, webhooks e `paymentsEnabled:true` funcionando para assinantes consultarem e cancelarem. Não desativar toda a integração com clientes ativos.

## Verificação e limites

Os testes locais abrangem regras do provedor, handlers HTTP, consumo de energia, UI e PostgreSQL via PGlite. Executar `npm install` na cópia pública e `npm test`; `@electric-sql/pglite` é dependência apenas de desenvolvimento.

Não há números de cartão, chaves privadas ou dados reais de pagamentos nos arquivos. O registro do webhook guarda identificador/tipo e pedido, sem persistir o payload completo com dados pessoais. Eventos duplicados não duplicam registros; snapshots antigos não sobrescrevem o estado observado mais recentemente.

O direito Plus é consultado no servidor e mantido só em memória, por até cinco minutos, vinculado à conta, sem ler flags premium salvas no progresso. Sem conexão para renovar a consulta, volta à energia gratuita. A energia e a execução das atividades ainda são mecânicas de um app cliente: uma pessoa que altere o JavaScript local pode contornar a interface, mas não criar pagamentos ou direitos no banco. Esta etapa não converte a carteira de KC em um sistema de dinheiro real.

Monitorar os logs e as filas do Asaas: notificações externas podem atrasar ou parar. O código não inclui conciliação diária automática. Para divergências, conferir a cobrança no Asaas e reprocessar pelo servidor; não liberar assinaturas editando o progresso do aluno.

## Fontes oficiais consultadas

- <https://docs.asaas.com/docs/checkout-com-assinatura-recorrente>
- <https://docs.asaas.com/reference/criar-novo-checkout>
- <https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente>
- <https://docs.asaas.com/docs/about-webhooks>
- <https://docs.asaas.com/reference/recuperar-uma-unica-cobranca>
- <https://docs.asaas.com/reference/recuperar-uma-unica-assinatura>
- <https://docs.asaas.com/reference/remover-assinatura>
- <https://docs.asaas.com/docs/sandbox>
