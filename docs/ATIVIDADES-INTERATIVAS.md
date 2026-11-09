# Atividades interativas — atualização publicada

Preparada em 8 e publicada em 9 de novembro de 2026, após a ativação do plano Personal no Netlify.

## O que muda

- Primeiras duas faixas: uma atividade de associação por fase de Kihon e Ido geiko. O aluno escolhe nome e significado e pode reconstruir os pares antes de verificar o conjunto.
- Faixas avançadas: desafios de descrição, classificação, comparação e transição aparecem em cartões com campos individuais. É possível voltar e rever as respostas. A verificação continua comparando a sequência completa, sem alternativas ou pistas adicionais.
- O mascote acompanha a preparação das respostas; números e barra mostram preenchimento, sem indicar acerto antecipado.
- As opções japonesas da associação usam a preferência de leitura já existente. Significados em português não são lidos pelo novo jogo.
- Mantidos dificuldade, nota de primeira tentativa, meta de 95% da faixa preta, XP e energia. Atrasar a verificação até preencher os cartões não concede acertos.
- Botões acessíveis por teclado, campos de 16 pixels e opção de movimento reduzido respeitada.

## Validação

49 testes automatizados aprovados, incluindo eventos de associação, correção de pares, respostas em etapas, verificação pelo manipulador real da atividade, bloqueio após acerto e preservação da nota de primeira tentativa. A validação usa dados sintéticos e uma superfície DOM isolada, sem contas reais.

Os cartões avançados foram conferidos pela interface publicada em largura de celular: preenchimento, avanço e conservação da resposta, sem confirmar a questão antes de todos os passos. A associação tem eventos e correção cobertos pelos testes. A conferência no iPhone real continua sendo feita pelo usuário. A prévia HTML independente permite experimentar sem entrar em conta ou alterar progresso.

Execute `npm test` para repetir as verificações. Novos testes em `test-interactive.cjs`; implementação em `dist/interactive-activities.js` e `dist/interactive-activities.css`.
