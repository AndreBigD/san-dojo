# Kyokushin Coins e avatar do aluno

Atualização preparada em 11 de novembro de 2026, aguardando publicação no Netlify. A prévia interativa fica em `dist/player-preview.html`, sem conexão com contas reais.

## Recompensas e loja

- 10 KC por fase aprovada com recompensa de XP disponível, uma vez por fase e por dia de Brasília.
- Tentativa abaixo da nota mínima, abandono ou revisão já recompensada no dia não concede KC.
- 25 KC compram 5 energias. A compra só fica disponível quando cabem as 5 energias dentro do limite de 25; não há cobrança parcial nem desperdício.
- 40 KC ativam +10 XP nas próximas três aprovações com recompensa disponível. Revisões sem recompensa e tentativas não aprovadas conservam os usos restantes. Um novo pacote não pode ser comprado enquanto houver usos ativos.
- O XP adicional entra no total e na semana real de conclusão da atividade. A exigência de fases aprovadas para avançar continua a mesma.
- A troca tem confirmação mostrando custo e saldo resultante. Cliques repetidos na confirmação não duplicam o débito. Contas sem autorização de estudo não compram.
- KC não têm valor monetário, compra em dinheiro, saque, transferência nem vínculo com anúncios.

A carteira começa em zero para contas antigas: não inventa recompensas retroativas. Saldo, usos restantes, identificadores das recompensas e até 40 movimentos recentes integram o mesmo progresso privado da conta, sincronizado pelo Supabase. Não há nova tabela ou chave para configurar.

### Limite da arquitetura atual

Assim como o restante do progresso do projeto, KC são calculadas no aplicativo e guardadas no documento de progresso que o próprio usuário pode atualizar pelas regras já existentes. Isso atende a moedas educativas sem valor real, mas não é uma contabilidade resistente à manipulação do cliente. Antes de vender moedas, permitir transferências, prêmios externos ou qualquer valor real, é necessário migrar saldo, créditos e compras para transações validadas por um servidor.

O salvamento entre aparelhos continua com a sincronização existente por documento, sem mesclagem transacional de sessões concorrentes. Não há promessa de atomicidade entre aparelhos desconectados ou sessões simultâneas.

## Avatar simples

- Tipo de personagem masculino ou feminino.
- Seis cabelos: curto, liso, cacheado, raspado, rabo de cavalo e coque.
- Cinco cores de cabelo, cinco tons de pele e três expressões.
- As 13 opções de faixa real do San Dojo, incluindo preta com um único risco dourado.
- Prévia antes de salvar e botão para cancelar; alterações não são persistidas durante a edição.
- Avatar no perfil e na miniatura do cabeçalho. O sensei continua como personagem das comemorações e dos dias de prática.

A faixa real é uma informação escolhida pelo aluno/responsável; não é verificada pelo aplicativo e não altera a faixa ilustrativa conquistada nas atividades. KC e XP também não alteram essa informação. Reiniciar o progresso zera XP, KC, bônus e fases, preservando o avatar, a faixa real informada e a biblioteca.

O desenho é construído com SVG e opções limitadas, sem fotos, câmera ou serviço externo de IA. As escolhas são guardadas com a própria conta, sem perfil público. A política de privacidade foi atualizada.

## Validação

62 testes aprovados. Incluem migração, repetição por fase/dia, débito, limite de energia, esgotamento e conservação de bônus, cliques repetidos, acesso pausado, campos inválidos, todas as combinações de tipo/cabelo/faixa, um único risco dourado, prévia antes de salvar e independência da graduação real e ilustrativa. O manipulador real de conclusão foi testado para crédito simultâneo de KC e XP adicional no total e na semana.

Os seis exemplos de avatar foram renderizados a partir do SVG real e conferidos visualmente. A verificação das telas interativas no navegador e no iPhone real está pendente: o controle do navegador integrado não iniciou nesta sessão. A prévia HTML independente permite experimentar a edição e a loja sem salvar nada numa conta. Ela tem 50 KC fictícias e um botão explicitamente marcado para simular uma aprovação.

## Publicação

Publique a pasta `dist` ou o ZIP completo preparado no projeto Netlify existente `sandojokarate`. A atualização inclui também o sensei musculoso dos 14 dias e a comemoração “Mais forte” com esse mesmo modelo. Não é necessário configurar uma API de imagens.
