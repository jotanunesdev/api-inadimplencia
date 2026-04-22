# PRD — Notificações do Módulo Inadimplência

## Visão Geral

O módulo `src/modules/inadimplencia` já expõe um esboço de notificações (`GET /notifications` e `GET /notifications/stream`) em construção, que hoje apenas deriva alertas de vendas atrasadas por consulta SQL, sem persistência, com bugs conhecidos e sem cobertura para o evento de atribuição de responsável.

Este PRD define a primeira versão **produtiva** do sistema de notificações do módulo, com:

- Persistência das notificações em SQL Server (histórico completo, controle de leitura).
- Dois tipos de evento nesta versão: **atribuição de venda a um responsável** e **venda atrasada** (Kanban `todo` com `PROXIMA_ACAO` vencida).
- Entrega em tempo real para o responsável via **SSE**, preservando os endpoints atuais de contrato.
- Correção dos bugs críticos que hoje impedem o funcionamento do endpoint.

Público-alvo: operadores de cobrança (responsáveis pelas vendas) e administradores que atribuem responsáveis. O valor está em diminuir o tempo de reação a vendas atribuídas e a ações vencidas, com base em uma fonte única e rastreável de alertas.

## Objetivos

- **Sucesso**
  - Toda atribuição de venda gera exatamente 1 notificação persistida ao novo responsável.
  - Toda transição para o estado "`todo` com `PROXIMA_ACAO` vencida" gera exatamente 1 notificação por `(NUM_VENDA, PROXIMA_ACAO, usuário)`.
  - Usuários conseguem listar, marcar como lida (individual e em massa) e remover notificações pela API.
- **Métricas**
  - Latência máxima de 5s entre o evento e a entrega via SSE para clientes conectados.
  - Taxa de erro de entrega (5xx) inferior a 1% em 7 dias.
  - Zero ocorrências do `TypeError` atual (`new Date.toISOString()`) após o deploy.
- **Negócio**
  - Reduzir o tempo médio entre atribuição e primeiro atendimento.
  - Dar visibilidade consolidada das vendas atrasadas sob a responsabilidade de cada operador.

## Histórias de Usuário

### Operador de Cobrança (responsável)

- Como operador, quero ser notificado em tempo real quando uma venda me é atribuída, para iniciar o atendimento imediatamente.
- Como operador, quero receber um alerta quando uma venda minha entrar em atraso (nova `PROXIMA_ACAO` vencida) para priorizar meu trabalho.
- Como operador, quero ver apenas minhas notificações não lidas no snapshot inicial, para focar no que falta tratar.
- Como operador, quero paginar o histórico de notificações, para consultar eventos antigos sem sobrecarregar a tela.
- Como operador, quero marcar uma notificação (ou todas) como lida para manter a caixa organizada.
- Como operador, quero remover uma notificação que não é mais relevante, sem perder o histórico de auditoria.

### Administrador

- Como admin, quero que o responsável designado seja notificado automaticamente ao atribuir uma venda (`POST/PUT /responsaveis`), sem ter de avisar manualmente.
- Como admin, quero que a notificação de atribuição não seja enviada ao admin nem ao responsável anterior.

## Funcionalidades Principais

### 1. Persistência em banco (tabela `NOTIFICACOES`)

Armazena todas as notificações emitidas, com controle de leitura e exclusão lógica.

**Requisitos Funcionais**

1. Deve existir uma tabela dedicada (nome de referência `dbo.NOTIFICACOES`) com, no mínimo: identificador único, `TIPO` (`VENDA_ATRIBUIDA` ou `VENDA_ATRASADA`), `USUARIO_DESTINATARIO`, `NUM_VENDA`, `PAYLOAD` (dados do evento), `LIDA` (boolean), `DT_CRIACAO`, `DT_LEITURA`, `DT_EXCLUSAO`.
2. Toda notificação deve ser persistida **antes** do broadcast SSE; falha de persistência não pode gerar entrega fantasma.
3. `LIDA` inicia em `false`; `DT_LEITURA` é preenchido no momento da marcação.
4. Exclusão é **soft delete** (preenche `DT_EXCLUSAO`); notificações excluídas não aparecem em listagens nem no SSE.
5. Não há expurgo automático nesta versão (histórico indefinido).

### 2. Notificação de atribuição de venda (`VENDA_ATRIBUIDA`)

Disparada quando a tabela `VENDA_RESPONSAVEL` passa a ter um novo responsável para uma venda.

**Requisitos Funcionais**

6. Quando `POST /responsaveis` criar uma atribuição, gerar 1 notificação para o `nomeUsuario` informado.
7. Quando `PUT /responsaveis/:numVenda` alterar o responsável, gerar 1 notificação para o **novo** responsável. O responsável anterior e o `adminUserCode` **não** recebem notificação.
8. Quando `DELETE /responsaveis/:numVenda` remover a atribuição, **não** gerar notificação.
9. O payload persistido deve conter: `numVenda`, `cliente`, `cpfCnpj`, `empreendimento`, `valorInadimplente`, `responsavel`, `dtAtribuicao` e `adminUserCode` (para auditoria de quem efetuou a atribuição).
10. Se a persistência da atribuição em `VENDA_RESPONSAVEL` falhar, nenhuma notificação deve ser gerada.

### 3. Notificação de venda atrasada (`VENDA_ATRASADA`)

Gerada a partir da mesma regra de negócio da consulta atual (`notificationsModel.js`): venda em `fat_analise_inadimplencia_v4`, com responsável atribuído e último registro de `KANBAN_STATUS` com `STATUS = 'todo'` e `CAST(PROXIMA_ACAO AS date) < CAST(GETDATE() AS date)`.

**Requisitos Funcionais**

11. A detecção de vendas atrasadas deve reaproveitar a consulta já existente (após correção dos bugs listados na Seção 5).
12. A deduplicação deve ser por tupla `(USUARIO_DESTINATARIO, NUM_VENDA, PROXIMA_ACAO)`: uma nova notificação só é gerada quando a `PROXIMA_ACAO` vigente é diferente da última já notificada para o mesmo usuário/venda. A chave inclui o destinatário, portanto **troca de responsável** em uma venda que permaneça atrasada gera nova notificação para o novo responsável.
13. O sistema deve varrer as vendas atrasadas em intervalo regular (não superior a 60s) para detectar novas ocorrências, persistindo e emitindo SSE para os clientes conectados do responsável.
14. O payload persistido deve conter: `numVenda`, `cliente`, `cpfCnpj`, `empreendimento`, `valorInadimplente`, `responsavel`, `proximaAcao`, `statusKanban`.
15. Uma venda que deixa de estar atrasada (mudança de `STATUS`, nova `PROXIMA_ACAO` futura, troca de responsável) não deve disparar novas notificações de `VENDA_ATRASADA` até voltar a se qualificar pela regra.

### 4. API REST unificada sob `/notifications`

Todas as rotas do recurso ficam sob o prefixo `/notifications` (em inglês), substituindo distinção PT/EN atual.

**Requisitos Funcionais**

16. `GET /notifications?username=<user>&page=<n>&pageSize=<n>&lida=<bool>` — lista paginada (padrão `page=1`, `pageSize=20`), ordenada por `DT_CRIACAO` desc, com não-lidas priorizadas; responde `400` se `username` ausente.
17. A resposta do `GET /notifications` inclui metadados de paginação (`page`, `pageSize`, `total`, `unreadCount`) e o array `notifications`.
18. `PUT /notifications/:id/read` — marca uma notificação específica como lida; `404` se não pertencer ao usuário ou não existir; idempotente.
19. `PUT /notifications/read-all?username=<user>` — marca todas as notificações não lidas do usuário como lidas; retorna a quantidade afetada.
20. `DELETE /notifications/:id` — **exclusão apenas visual** (soft delete via `DT_EXCLUSAO`); o registro nunca é removido fisicamente do banco. Permitido somente para notificações com `LIDA = true`; tentar excluir uma notificação ainda não lida responde `409 Conflict`. Idempotente para itens já excluídos.
21. Todas as rotas mantêm o padrão de erro e CORS do módulo (`errorHandler`, `originGuard`).

### 5. Stream SSE em tempo real

**Requisitos Funcionais**

22. `GET /notifications/stream?username=<user>` permanece como endpoint SSE, com os mesmos headers atuais (`text/event-stream`, `no-cache, no-transform`, `keep-alive`, `X-Accel-Buffering: no`).
23. Ao conectar, o cliente recebe um snapshot inicial somente com notificações **não lidas e não excluídas**, no evento `inadimplencia-notifications.snapshot`, com o mesmo envelope do `GET /notifications` (paginado com `pageSize` padrão).
24. Quando uma nova notificação persistida for destinada a um `username` com clientes conectados, o servidor deve emitir um evento `inadimplencia-notifications.new` com o objeto individual da notificação em até 5s.
25. Deve existir heartbeat SSE a cada 15s (`: ping`).
26. Marcar como lida/excluir deve emitir evento `inadimplencia-notifications.update` para os clientes conectados do usuário, refletindo o novo estado.

### 6. Correções críticas do estado atual

**Requisitos Funcionais**

27. Corrigir o `TypeError` causado por `new Date.toISOString()` em `models/notificationsModel.js` (deve ser `new Date().toISOString()`) para destravar o snapshot.
28. Corrigir a comparação de `username` para ser consistentemente case-insensitive entre a normalização no código e o predicado SQL, garantindo que `"Joao"` e `"joao"` resultem na mesma lista.
29. Os demais bugs listados no README do módulo (chave do `Map`, polling por cliente, Swagger, comentários desatualizados, tratamento de `res.write`) ficam **fora do escopo** desta entrega e permanecem no backlog.

## Experiência do Usuário

### Fluxo do operador

1. Ao abrir o sistema, o front-end conecta-se ao SSE com seu `username`.
2. Recebe o snapshot inicial apenas com notificações **não lidas**.
3. Durante a sessão, novas notificações (atribuição ou atraso) chegam em tempo real e atualizam o contador no header.
4. O operador pode clicar em uma notificação para marcar como lida, usar "marcar todas como lidas" ou remover itens irrelevantes.
5. Ao abrir o histórico completo, usa paginação para navegar por itens antigos, com filtro por `lida`.

### Interface (referência para o front-end)

- Badge com contador de não lidas no cabeçalho.
- Painel/dropdown com scroll, ícones distintos por `TIPO`, mensagem contextual (cliente, venda, empreendimento, valor, data da próxima ação quando aplicável).
- Ações por item: **marcar como lida**, **excluir**. Ação global: **marcar todas como lidas**.

### Acessibilidade

- Novas notificações anunciadas por `aria-live="polite"`.
- Contraste adequado entre badge e fundo.
- Todas as ações operáveis por teclado e com rótulos acessíveis.

## Restrições Técnicas de Alto Nível

- **Banco**: SQL Server já usado pelo módulo (sem nova infraestrutura).
- **Processo**: instância única; broadcast em memória (`Map<username, Set<res>>`). Sem Redis/Pub-Sub nesta versão.
- **Autenticação**: não há. `username` continua vindo por query string e corresponde diretamente (1:1) à coluna `NOME_USUARIO_FK` em `VENDA_RESPONSAVEL`/`KANBAN_STATUS`; a segurança de acesso é responsabilidade de camadas externas/rede.
- **Compatibilidade**: URLs ficam sob `/notifications` (EN). O contrato do payload pode ser ajustado internamente, desde que o cliente atual do snapshot continue recebendo os campos hoje consumidos (`id`, `tipo`/`type`, `numVenda`, `cliente`, `cpfCnpj`, `empreendimento`, `responsavel`, `proximaAcao`, `status`, `valorInadimplente`, `createdAt`, `lida`).
- **Performance**: snapshot inicial < 2s para até 100 notificações não lidas; endpoint de listagem paginado para controlar volume.
- **Escalabilidade**: meta de até 100 conexões SSE simultâneas por instância.
- **Observabilidade**: logs de erro mantidos via `errorHandler` existente; falhas de `res.write` não devem derrubar o loop de broadcast.

## Fora de Escopo

- Notificações por e-mail, SMS ou push (apenas SSE + API REST).
- Outros tipos de evento (nova ocorrência, mudança de status Kanban, timeouts de `inProgress`, etc.).
- Notificações para o admin que atribuiu ou para o responsável anterior.
- Autenticação/autorização do endpoint.
- Propagação entre múltiplas instâncias (Redis Pub/Sub, tabela de eventos, etc.).
- Preferências de notificação por usuário e categorias/silenciamento.
- Expurgo automático e políticas de retenção.
- Correção dos bugs não críticos listados no README (permanecem no backlog).
- Documentação Swagger completa das novas rotas (será coberta em tarefa separada de documentação).

## Questões em Aberto

Nenhuma questão em aberto no momento. Premissas consolidadas:

- `username` das requisições é **1:1** com `NOME_USUARIO_FK`.
- `adminUserCode` faz parte do payload de `VENDA_ATRIBUIDA` para auditoria.
- Troca de responsável em venda atrasada **gera** nova notificação para o novo responsável.
- `DELETE` é apenas visual (soft delete) e permitido somente para notificações já lidas.
- Sem métricas dedicadas (Prometheus/health específico) nesta versão.
