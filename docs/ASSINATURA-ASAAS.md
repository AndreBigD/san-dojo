# San Dojo Plus com Asaas

Implementação preparada em 11/11/2026. Produto confirmado por André: **R$ 11,99 por mês, energia ilimitada para uma conta de aluno**. Não há venda de KC nesta etapa. Cobranças reais estão desativadas. Não há uma assinatura de produção criada nem homologação externa concluída.

## Fluxo entregue

- Minha conta → San Dojo Plus: preço, renovação mensal, consentimento do responsável, contratação no Asaas, situação, últimas cobranças e cancelamento.
- Checkout hospedado no Asaas, `CREDIT_CARD` + `RECURRENT` + `MONTHLY`. O app não coleta cartão, CPF ou dados do pagador.
- Cadastro automático da assinatura pelo Checkout. O servidor associa a primeira cobrança à conta pelo `checkoutSession` informado na cobrança ou na assinatura, conferido na API do Asaas. Cobranças seguintes podem usar o vínculo da assinatura já salvo. Identificadores conflitantes são recusados.
- Apenas cobranças confirmadas/recebidas, no valor esperado e ligadas à assinatura correta, concedem um período. Callback do navegador e `CHECKOUT_PAID` isolados não concedem acesso.
- Mês de vencimento com término no mesmo dia do mês seguinte, ajustado ao último dia quando necessário. Limites às 00h de Brasília. Sem crédito de dias adicionais a cada repetição de evento.
- Cancelar interrompe a recorrência e preserva períodos já pagos. Estorno, contestação ou reembolso parcial suspendem o benefício da cobrança afetada; ajustes excepcionais exigem atendimento.
- Pagamentos e eventos ficam em tabelas próprias, não editáveis por aluno nem pelo administrador através da API pública. A carteira gratuita de KC permanece independente.
- Sandbox isolado da produção e limitado à conta administradora.
- Recuperação de confirmação ausente: ao atualizar uma conta sem período ativo, o servidor consulta cobranças da contratação existente no Asaas, sem criar outra assinatura. Apenas dados verificados são gravados no mesmo registro de pagamentos.

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

Além dos testes locais, conferir no Sandbox real: entrega dos webhooks, estorno, renovações, valores e tarifas da conta. Em 11/11, André concluiu o Checkout Sandbox e confirmou por capturas do app a ativação até 11/12/2026, o pagamento de R$ 11,99 no histórico e o cancelamento da renovação preservando o período pago. A versão `2026-11-11.4` foi publicada e validou a recuperação pela assinatura. Após solicitar estorno, o usuário ainda viu energia ilimitada; o estado definitivo do estorno na API e a entrega do webhook não foram confirmados. A versão `2026-11-11.5`, preparada e testada localmente, acrescenta reconsulta de pagamentos ativos. A homologação continua em andamento, sem liberar cobranças reais.

Revisar os termos preparados, o atendimento de reembolsos, os dados comerciais exigidos pelo Asaas e o processo de retenção/exclusão dos registros financeiros. A migração impede apagar diretamente uma conta que ainda tenha pedidos financeiros: cancelar a recorrência e avaliar anonimização/retenção antes da exclusão. Isso não deve deixar uma cobrança ativa após pedido de encerramento.

Após homologação e autorização para ativação: configurar credenciais e webhook **de produção**, trocar `ASAAS_MODE=production`, definir `paymentsEnvironment:'production'` e `paymentsAdminOnly:false` no app e manter o mesmo preço. Nunca reutilizar o token de webhook do Sandbox em produção. Alterar textos de “em preparação” nos termos e na privacidade quando a integração estiver ativa. Só então anunciar a assinatura.

Para pausar novas vendas, usar `ASAAS_CHECKOUT_ENABLED=false`. Manter as funções, credenciais de produção, webhooks e `paymentsEnabled:true` funcionando para assinantes consultarem e cancelarem. Não desativar toda a integração com clientes ativos.

## Verificação e limites

Diagnóstico do ambiente: `GET /functions/v1/dojo-billing/health` retorna versão, ambiente carregado e indicadores de presença das configurações. Não retorna valores de chaves ou tokens, contas, pagamentos ou dados do Asaas. Não exige login porque os dados retornados são apenas de disponibilidade. Os indicadores de presença não comprovam validade da chave nem correspondência do token com o Asaas. O caminho principal e as operações financeiras continuam autenticados.

Se o app informar que o ambiente é diferente do esperado, consultar esse diagnóstico para distinguir `disabled`, `sandbox` e `production`. A versão preparada atual é `2026-11-11.5`; a versão `2026-11-11.4` foi confirmada online em Sandbox. A atualização reinicializa o código e carrega os Secrets atuais. `modeNeedsFormatting:true` indica que o valor de ambiente tem diferenças de espaços ou maiúsculas em relação a `sandbox`; o valor bruto nunca é exibido.

Na versão `2026-11-11.3`, `action:status` recupera uma confirmação ausente somente quando não existe direito ativo. O pedido é escolhido no banco e relido com os filtros da conta autenticada e do ambiente; identificadores, valores e flags enviados pelo navegador não definem esse vínculo. O servidor faz apenas GETs: lista `/payments` com filtro `checkoutSession` ou assinatura já vinculada e vencimentos entre 32 dias atrás e hoje, depois busca os recursos completos de pagamento e assinatura. A lista filtrada pelo checkout também comprova o vínculo quando os recursos individuais omitem esse campo. Campos de checkout conflitantes, assinatura diferente, cliente diferente, preço, ciclo ou meio de pagamento incorretos impedem a gravação.

A recuperação exige uma lista completa com até dez cobranças nessa janela; não processa um resultado truncado. Ela reutiliza a rotina transacional existente: reconsultar não cria outro pagamento nem estende o período. Um cache de promessas por instância limita novas tentativas por pedido ou conta a uma por minuto; não é um limite global persistente. O webhook continua sendo o mecanismo principal. O navegador recebe apenas estado e mensagens seguras. Falhas geram nos logs uma categoria fixa, sem resposta bruta, chave ou dados do pagador.

Desde `2026-11-11.4`, uma consulta vazia de cobranças por checkout, em pedido ainda sem assinatura vinculada, tenta localizar a assinatura na API. A busca percorre até três páginas de cem assinaturas, incluindo removidas, e exige que a listagem esteja completa e tenha um único ID com `checkoutSession` idêntico ao pedido. Depois busca o recurso completo, reconfirma vínculo, ciclo e preço e só então consulta cobranças pelo ID da assinatura. Nome do pagador e valor isolados nunca servem como vínculo. Nenhum dado de outros pagadores é retornado ou persistido. Resultado ambíguo, truncado ou sem vínculo não libera energia. Uma assinatura verificada sem cobrança do período pode ser vinculada para permitir consulta e cancelamento, mas não concede benefício.

Desde `2026-11-11.5`, um status ativo também pode ser conferido diretamente no Asaas. Em produção, o clique em Atualizar situação envia `reconcile:true`; consultas de fundo continuam lendo o banco. No Sandbox exclusivo do administrador, essa conferência também ocorre sem a flag, para atender a versão do site já publicada. A rotina seleciona somente pagamentos não revogados do período atual da conta autenticada e ambiente correto, com limite de dez, e faz GET pelo ID já registrado. Confere ID, pedido, assinatura, valor, forma de pagamento e eventual checkout. Os limites do período são preservados do registro existente. Falha de verificação desativa a resposta de benefício sem alterar os pagamentos no banco.

Pagamentos já gravados podem ser revalidados pelo webhook sem consultar a assinatura removida no cancelamento. O recurso de pagamento obtido na API e o vínculo imutável com o registro existente são a base da conferência; essa via não cria um pagamento nem amplia seu período. Pagamentos novos continuam exigindo a verificação completa da assinatura. O caso cancelamento → assinatura indisponível na API → estorno, com e sem webhook, é testado em PostgreSQL via PGlite. Publicar ambas as funções atualizadas para esse fluxo. A correção de Sandbox não exige republicar o site, mas o frontend com a flag de consulta explícita deve ser publicado antes de ativar produção.

Os testes locais abrangem regras do provedor, handlers HTTP, consumo de energia, UI e PostgreSQL via PGlite. Executar `npm install` na cópia pública e `npm test`; `@electric-sql/pglite` é dependência apenas de desenvolvimento.

Não há números de cartão, chaves privadas ou dados reais de pagamentos nos arquivos. O registro do webhook guarda identificador/tipo e pedido, sem persistir o payload completo com dados pessoais. Eventos duplicados não duplicam registros; snapshots antigos não sobrescrevem o estado observado mais recentemente.

O direito Plus é consultado no servidor e mantido só em memória, por até cinco minutos, vinculado à conta, sem ler flags premium salvas no progresso. Sem conexão para renovar a consulta, volta à energia gratuita. A energia e a execução das atividades ainda são mecânicas de um app cliente: uma pessoa que altere o JavaScript local pode contornar a interface, mas não criar pagamentos ou direitos no banco. Esta etapa não converte a carteira de KC em um sistema de dinheiro real.

Monitorar os logs e as filas do Asaas: notificações externas podem atrasar ou parar. O código inclui recuperação de confirmação e conferência explícita de pagamentos ativos, mas não inclui conciliação diária automática. A existência do token nos Secrets não comprova que ele corresponde ao configurado no Asaas; a causa da falta de confirmação do teste ainda depende da conferência dos logs privados. Para divergências, conferir a cobrança no Asaas e reprocessar pelo servidor; não liberar assinaturas editando o progresso do aluno.

## Fontes oficiais consultadas

- <https://docs.asaas.com/docs/checkout-com-assinatura-recorrente>
- <https://docs.asaas.com/reference/criar-novo-checkout>
- <https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente>
- <https://docs.asaas.com/docs/about-webhooks>
- <https://docs.asaas.com/reference/recuperar-uma-unica-cobranca>
- <https://docs.asaas.com/reference/listar-cobrancas>
- <https://docs.asaas.com/reference/listar-assinaturas>
- <https://docs.asaas.com/reference/recuperar-uma-unica-assinatura>
- <https://docs.asaas.com/reference/remover-assinatura>
- <https://docs.asaas.com/docs/sandbox>
