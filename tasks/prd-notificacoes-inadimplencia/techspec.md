# Tech Spec — Notificações do Módulo Inadimplência

## Resumo Executivo

Esta especificação descreve **como a implementação deverá ser feita** (pode precisar refatorar o que ja existe). A proposta é converter o atual esboço em memória de `notifications` em um subsistema **persistido + event-driven** dentro do módulo `src/modules/inadimplencia`, reaproveitando o stack já instalado (Express Router, `mssql` via `config/db.js`, `errorHandler`, `originGuard`).

O plano prevê criar a tabela `dbo.INAD_NOTIFICACOES` como fonte única da verdade, um `notificationService` que encapsule `persist-then-broadcast`, um `overdueScanner` com `setInterval` de 60s para o tipo `VENDA_ATRASADA` e um `sseHub` que substitua o `inadimplenciaNotificationRealtime.js` atual, padronizando os eventos `snapshot/new/update`. O `responsavelAssignmentService` deverá passar a disparar `VENDA_ATRIBUIDA` em vez de rebroadcastar snapshot, e os bugs críticos do `notificationsModel.js` serão corrigidos na mesma entrega.

A arquitetura proposta é deliberadamente simples (instância única, broadcast em memória) conforme restrições do PRD, mas com fronteiras claras (service → repository → hub) para permitir evoluir depois para Pub/Sub sem reescrever controllers.

## Arquitetura do Sistema

### Visão Geral dos Componentes

Componentes a serem **criados**:

- **`models/notificationsRepository.js`** — deverá encapsular o CRUD SQL sobre `dbo.INAD_NOTIFICACOES` (insert, list paginado, markRead, markAllRead, softDelete, findById, findByDedupeKey).
- **`services/notificationService.js`** — deverá orquestrar `persist-then-broadcast`: validar, inserir, ler de volta a linha e chamar `sseHub.emitNew(...)`. Expondo `createAssignmentNotification`, `createOverdueNotification`, `markAsRead`, `markAllAsRead`, `softDelete`, `getPaginated`, `getSnapshotForUser`. Em `createOverdueNotification`, deverá manter um **mutex in-memory por dedupe key** (`Set<string>` de chaves em voo `TIPO|USUARIO|NUM_VENDA|PROXIMA_ACAO_DIA`, com `PROXIMA_ACAO_DIA` no formato `YYYY-MM-DD` para casar com a semântica diária do banco) para serializar SELECT-before-INSERT concorrentes sobre a mesma chave; a entrada no set é criada antes do SELECT e removida no `finally`.
- **`services/overdueScanner.js`** — job in-process a ser executado a cada `NOTIFICATIONS_OVERDUE_SCAN_MS` (default 60000ms); deverá consultar a variação global de `findOverdueSalesByUsername` (sem `username`) e chamar `notificationService.createOverdueNotification` para cada `(user, venda, proximaAcao)` ainda não notificado. Reutilizará a query SQL existente, após correção dos bugs. Deverá ter **re-entrancy guard** (flag `isRunning`): se um tick ainda está em execução quando o próximo dispara, o próximo vira no-op (log em nível debug).
- **`services/sseHub.js`** — deverá gerenciar `Map<username, Set<res>>`, emitir eventos `inadimplencia-notifications.snapshot | .new | .update`, fazer heartbeat 15s e tratar `res.write` com `try/catch + removeListener` em falha.
- **DDL `dbo.INAD_NOTIFICACOES`** — script idempotente a ser gravado em `docs/db/notificacoes.sql` (referência; execução manual pelo DBA).

Componentes a serem **modificados**:

- **`controllers/notificationsController.js`** — deverá ser reescrito para expor as 5 rotas REST + SSE.
- **`routes/notificationsRoutes.js`** — deverá registrar as novas rotas.
- **`services/responsavelAssignmentService.js`** — deverá remover a chamada a `broadcastInadimplenciaSnapshot` e passar a chamar `notificationService.createAssignmentNotification` apenas quando `changed === true` e `nomeResponsavelAtual` existir, repassando `adminUserCode`. Delete/Remoção continuará sem notificar.
- **`models/notificationsModel.js`** — deverá corrigir `new Date.toISOString()` → `new Date().toISOString()`, tornar `findOverdueSalesByUsername` opcionalmente global (`username` nullable) e expor `findAllOverdue()` para o scanner. `getInadimplenciaNotificationSnapshot` será marcado como **deprecated** (substituído por `notificationService.getSnapshotForUser`).
- **`index.js`** — deverá inicializar `overdueScanner.start()` no bootstrap do módulo (com guard de `NODE_ENV !== 'test'`).
- **`controllers/responsavelController.js`** — sem alteração de contrato externo; apenas herdará o novo fluxo do service.
- **`swagger.js`** — sem alteração nesta entrega (documentação fora de escopo pelo PRD).

Relacionamentos / fluxo de dados:

```
[HTTP] responsavelController.create/update
   └─► responsavelAssignmentService.assignResponsavel
          ├─► responsavelModel.upsert            (tx conceitual: persist assignment)
          └─► notificationService.createAssignmentNotification
                 ├─► notificationsRepository.insert  (persist)
                 └─► sseHub.emitNew(username, row)    (broadcast)

[timer 60s] overdueScanner.tick
   └─► notificationsModel.findAllOverdue
          └─► for each row: notificationService.createOverdueNotification
                 ├─► repository.findByDedupeKey(user, numVenda, proximaAcao, tipo='VENDA_ATRASADA')  (SELECT-before-INSERT; compara por PROXIMA_ACAO_DIA = CAST(@proximaAcao AS date))
                 ├─► repository.insert
                 └─► sseHub.emitNew

[HTTP] GET /notifications/stream → sseHub.register
   ├─► snapshot inicial via notificationService.getSnapshotForUser (unread, não-excluídas, paginado default)
   └─► heartbeat 15s, cleanup em close/error
```

## Design de Implementação

### Interfaces Principais

```js
// services/notificationService.js
module.exports = {
  createAssignmentNotification({ numVenda, destinatario, adminUserCode, saleSnapshot }): Promise<NotificationDTO>,
  createOverdueNotification({ destinatario, saleSnapshot }): Promise<NotificationDTO | null>, // null se deduped
  markAsRead({ id, username }): Promise<NotificationDTO>,                // 404 → throws {statusCode:404}
  markAllAsRead({ username }): Promise<{ updated: number }>,
  softDelete({ id, username }): Promise<NotificationDTO>,                // 404/409 → throws
  getPaginated({ username, page, pageSize, lida }): Promise<ListEnvelope>,
  getSnapshotForUser(username): Promise<ListEnvelope>,                   // unread only, pageSize default
};

// services/sseHub.js
module.exports = {
  register(username, res): void,           // seta headers, addListener, envia snapshot, agenda heartbeat/close
  emitNew(username, notificationDTO): void,
  emitUpdate(username, notificationDTO): void,   // usado por markRead/markAll/softDelete
  listenerCount(username): number,
};

// services/overdueScanner.js
module.exports = {
  start(): void,   // idempotente
  stop(): void,
  tick(): Promise<void>,   // exportado para teste
};

// models/notificationsRepository.js
module.exports = {
  insert({ tipo, usuarioDestinatario, origemUsuario, numVenda, proximaAcao, payload }): Promise<Row>, // origemUsuario obrigatório para VENDA_ATRIBUIDA, null para VENDA_ATRASADA
  findById(id, username): Promise<Row|null>,
  findByDedupeKey({ tipo, usuarioDestinatario, numVenda, proximaAcao }): Promise<Row|null>, // proximaAcao: Date|ISO string; SQL compara por PROXIMA_ACAO_DIA = CAST(@proximaAcao AS date)
  listPaginated({ username, page, pageSize, lida }): Promise<{ rows, total, unreadCount }>,
  listUnread({ username, limit }): Promise<Row[]>,
  markRead(id, username): Promise<Row|null>,
  markAllRead(username): Promise<number>,
  softDelete(id, username): Promise<Row|null>,  // retorna null se not found, throws {statusCode:409} se LIDA=false
};
```

### Modelos de Dados

**Tabela `dbo.INAD_NOTIFICACOES`** (DDL de referência):

```sql
CREATE TABLE dbo.INAD_NOTIFICACOES (
  ID                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_NOTIFICACOES_ID DEFAULT (NEWSEQUENTIALID()),
  TIPO                  VARCHAR(32)      NOT NULL,  -- 'VENDA_ATRIBUIDA' | 'VENDA_ATRASADA'
  USUARIO_DESTINATARIO  VARCHAR(255)     NOT NULL,
  ORIGEM_USUARIO        VARCHAR(255)     NULL,       -- quem disparou: username do admin (VENDA_ATRIBUIDA) ou NULL (VENDA_ATRASADA = sistema)
  NUM_VENDA             INT              NOT NULL,
  PROXIMA_ACAO          DATETIME         NULL,       -- tipo alinhado com demais tabelas do sistema (KANBAN_STATUS, OCORRENCIAS, etc.)
  PROXIMA_ACAO_DIA      AS CAST(PROXIMA_ACAO AS date) PERSISTED, -- chave efetiva de dedupe (granularidade diária)
  PAYLOAD               NVARCHAR(MAX)    NOT NULL,   -- JSON string
  LIDA                  BIT              NOT NULL CONSTRAINT DF_NOTIFICACOES_LIDA DEFAULT (0),
  DT_CRIACAO            DATETIME2(3)     NOT NULL CONSTRAINT DF_NOTIFICACOES_DT DEFAULT (SYSUTCDATETIME()),
  DT_LEITURA            DATETIME2(3)     NULL,
  DT_EXCLUSAO           DATETIME2(3)     NULL,
  CONSTRAINT PK_NOTIFICACOES PRIMARY KEY NONCLUSTERED (ID),
  CONSTRAINT CK_NOTIFICACOES_TIPO CHECK (TIPO IN ('VENDA_ATRIBUIDA','VENDA_ATRASADA')),
  CONSTRAINT CK_NOTIFICACOES_ORIGEM CHECK (
    (TIPO = 'VENDA_ATRIBUIDA' AND ORIGEM_USUARIO IS NOT NULL)
    OR
    (TIPO = 'VENDA_ATRASADA'  AND ORIGEM_USUARIO IS NULL)
  )
);
CREATE CLUSTERED INDEX IX_NOTIFICACOES_DT ON dbo.INAD_NOTIFICACOES (DT_CRIACAO DESC);
CREATE INDEX IX_NOTIFICACOES_DEST ON dbo.INAD_NOTIFICACOES (USUARIO_DESTINATARIO, LIDA, DT_EXCLUSAO) INCLUDE (TIPO, NUM_VENDA, DT_CRIACAO);
CREATE INDEX IX_NOTIFICACOES_DEDUPE ON dbo.INAD_NOTIFICACOES (TIPO, USUARIO_DESTINATARIO, NUM_VENDA, PROXIMA_ACAO_DIA);
```

Observações:
- ID **UUID** (por decisão do usuário); `NEWSEQUENTIALID()` para melhor localidade no índice clustered `DT_CRIACAO DESC`.
- `PROXIMA_ACAO` é **`DATETIME`** para manter consistência com `dbo.KANBAN_STATUS`, `dbo.OCORRENCIAS` e demais tabelas do sistema, evitando conversão implícita em joins/queries que cruzem essas tabelas.
- **Dedupe por dia**: a chave lógica é `(TIPO, USUARIO_DESTINATARIO, NUM_VENDA, PROXIMA_ACAO_DIA)`. A coluna computada persistida `PROXIMA_ACAO_DIA` garante que dois `DATETIME` distintos no mesmo dia (ex.: `2025-10-01 08:00` e `2025-10-01 17:30`) colidam no SELECT-before-INSERT. O repositório deve comparar por `PROXIMA_ACAO_DIA = CAST(@proximaAcao AS date)` em `findByDedupeKey`.
- Dedupe é feita por SELECT no repositório (sem unique index), portanto `IX_NOTIFICACOES_DEDUPE` é apenas para performance.
- `USUARIO_DESTINATARIO` e `ORIGEM_USUARIO` armazenados normalizados (trim+lowercase) para simplificar predicados.
- **`ORIGEM_USUARIO`**: identifica o disparador da notificação. Para `VENDA_ATRIBUIDA` guarda o `adminUserCode` (quem atribuiu a venda); para `VENDA_ATRASADA` fica `NULL` (notificação do próprio sistema). A `CHECK CK_NOTIFICACOES_ORIGEM` garante essa coerência no banco — evita bug de UI do tipo `"null atribuiu a venda a você"`. Fonte única da verdade: **não duplicar** `adminUserCode` dentro do `PAYLOAD`.
- Sem índice em `ORIGEM_USUARIO` nesta entrega; adicionar índice filtrado (`WHERE ORIGEM_USUARIO IS NOT NULL`) se surgir filtro por origem com volume.
- **Binding**: o driver `mssql` retorna `DATETIME` como `Date` JS (UTC). O repositório deve repassar esse `Date` direto em `sql.DateTime` — **não** parsear como string nem reconstruir via `new Date(str)`, para evitar drift de timezone ao converter em `PROXIMA_ACAO_DIA`.

**DTO de resposta (`NotificationDTO`)** — camelCase, estável para o cliente existente:

```json
{
  "id": "uuid",
  "tipo": "VENDA_ATRIBUIDA|VENDA_ATRASADA",
  "type": "assignment|sale_overdue",
  "numVenda": 12345,
  "cliente": "...", "cpfCnpj": "...", "empreendimento": "...",
  "valorInadimplente": 0, "responsavel": "...",
  "proximaAcao": "2025-10-01T13:45:00.000Z",
  "status": "todo",
  "adminUserCode": "...",  // mapeado de ORIGEM_USUARIO; null em VENDA_ATRASADA
  "lida": false,
  "createdAt": "...", "readAt": null, "deletedAt": null
}
```

Nota: `proximaAcao` reflete o `DATETIME` original de `KANBAN_STATUS.PROXIMA_ACAO` (com hora). A dedupe, porém, é por **dia** (`PROXIMA_ACAO_DIA`), independentemente da hora armazenada.

`ListEnvelope`: `{ page, pageSize, total, unreadCount, notifications: NotificationDTO[] }`.

### Endpoints de API

Todas as rotas montadas em `router.use('/notifications', notificationsRoutes)`:

- `GET    /notifications?username&page&pageSize&lida` — lista paginada.
- `GET    /notifications/stream?username` — SSE (snapshot inicial + eventos).
- `PUT    /notifications/:id/read?username` — marca como lida; `username` query obrigatório para autorização por posse.
- `PUT    /notifications/read-all?username` — marca todas; retorna `{ updated }`.
- `DELETE /notifications/:id?username` — soft delete; `409` se `LIDA=false`.

Formato de erro: mesma forma do `errorHandler` (`{ error: message }`), status via `err.statusCode`.

## Pontos de Integração

- **`dbo.VENDA_RESPONSAVEL`** e **`DW.fat_analise_inadimplencia_v4`** — deverão ser consultadas pelo scanner e por `notificationService.createAssignmentNotification` para montar o `saleSnapshot` (cliente, cpfCnpj, empreendimento, valorInadimplente). A ideia é reaproveitar o SELECT já existente em `notificationsModel.js` (removendo o predicado `WHERE username` quando invocado pelo scanner).
- **`dbo.KANBAN_STATUS`** — será usado pela mesma CTE `UltimoKanban` para filtrar `todo + PROXIMA_ACAO < hoje`.
- **`originGuard` + CORS** do módulo — deverão ser mantidos (rotas continuam sob o router raiz do módulo).
- **Sem integrações externas novas** (SMTP, Redis, fila): fora de escopo pelo PRD.

Tratamento de falhas previsto:
- Falha no INSERT deverá propagar para `errorHandler`; broadcast não deve ocorrer (persist-then-broadcast).
- Falha em `res.write` no hub deverá ser capturada (`try/catch`), removendo o listener e fechando `res` se necessário, sem derrubar o loop.
- Falha em `scanner.tick` deverá ser logada via `console.error` e o próximo tick tenta novamente.

## Abordagem de Testes

### Testes Unidade

Componentes críticos a serem cobertos (Jest + `mssql` mockado por módulo via `jest.mock('../config/db')`):

- `notificationsRepository`: validar SQL text + binding de parâmetros (`sql.VarChar/Int/DateTime/UniqueIdentifier`), normalização de username, paginação (`OFFSET ... FETCH NEXT`).
- `notificationService`:
  - `createAssignmentNotification` deve chamar `insert` e depois `sseHub.emitNew` nesta ordem; se `insert` falhar, o hub não deve ser chamado.
  - `createOverdueNotification` deve retornar `null` quando `findByDedupeKey` encontrar registro vigente.
  - `markAsRead`/`softDelete` devem lançar `{statusCode:404}` para ids de outro usuário; `softDelete` deve lançar `409` quando `LIDA=false`.
- `sseHub`: `register` deve setar headers, enviar snapshot, agendar heartbeat e fazer cleanup em `close`; `emitNew` deve ignorar usuários sem listeners; falha em `res.write` não deve derrubar os demais.
- `overdueScanner.tick`: dado um recordset mockado, deve disparar `createOverdueNotification` uma vez por linha e não enfileirar novas chamadas quando o dedupe retornar `null`.

Cenários de regressão a cobrir:
- Snapshot não deve lançar `TypeError` (validar `new Date().toISOString()`).
- `"Joao"` e `"joao"` devem retornar o mesmo resultado (case-insensitive consistente entre normalização e SQL).

### Testes de Integração

Opcionais nesta entrega (sem banco em CI). Quando houver ambiente de homologação, sugerem-se:
- Ciclo completo assignment → persistência → SSE (`eventsource` client) recebendo `.new`.
- Validar que o soft delete não remove o item do histórico paginado.
- Validar o dedupe real de `VENDA_ATRASADA` por `PROXIMA_ACAO`.

### Testes E2E

Fora de escopo (sem front-end neste repo).

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. Criar a DDL de `dbo.INAD_NOTIFICACOES` em `docs/db/notificacoes.sql` (pré-requisito de qualquer insert).
2. Implementar `notificationsRepository` + testes unit (base para todo o resto).
3. Implementar `notificationService` + testes (orquestração persist-then-broadcast, com `sseHub` ainda mockado).
4. Implementar `sseHub` (substituto de `inadimplenciaNotificationRealtime.js`); avaliar manter o arquivo legado re-exportando do hub por compat durante 1 deploy.
5. Reescrever `notificationsController` e `routes/notificationsRoutes` com as 5 rotas REST + stream.
6. Aplicar correções em `notificationsModel.js` e migrar `getSnapshotForUser` para o service.
7. Implementar `overdueScanner` e fazer o wiring em `index.js` (start/stop).
8. Atualizar `responsavelAssignmentService` para chamar o service e remover o broadcast de snapshot.
9. Smoke manual + testes de integração opcionais.

### Dependências Técnicas

- Execução do DDL em SQL Server antes do deploy (acionar DBA).
- Variável opcional `NOTIFICATIONS_OVERDUE_SCAN_MS` em `config/env.js` (default 60000; validar >= 15000).
- `mssql` já presente no `package.json`; sem novas libs.

## Monitoramento e Observabilidade

- Logs via `console.error` (padrão do projeto + `errorHandler`):
  - `[notificationService] insert failed` (com `tipo`, `numVenda`, `username`).
  - `[sseHub] write failed, dropping listener` (com `username`, `listenerCount`).
  - `[overdueScanner] tick error` (com `durationMs`).
- Contadores em memória expostos apenas via log periódico do scanner (`processed`, `created`, `deduped`). Sem Prometheus/Grafana (fora de escopo PRD).
- Heartbeat SSE 15s já é observável pela ausência de reconexões nos logs do proxy.

## Considerações Técnicas

### Decisões Principais

- **UUID (`NEWSEQUENTIALID`) como PK** — escolha do usuário; facilita geração client-side quando necessário e evita colisão de IDs caso o sistema evolua para Pub/Sub multi-instância.
- **Persist-then-broadcast síncrono** — atende ao requisito "falha de persistência não pode gerar entrega fantasma" sem exigir outbox/tx distribuída. `responsavelModel.upsert` e o insert da notificação não rodarão na mesma transação; se a notificação falhar após o assignment, haverá assignment sem notificação — o scanner não cobre `VENDA_ATRIBUIDA`, então o risco é aceito e apenas logado (ver §Riscos).
- **Coluna `ORIGEM_USUARIO` como first-class** — o disparador da notificação (admin em `VENDA_ATRIBUIDA`, `NULL` em `VENDA_ATRASADA`) é promovido de campo dentro do `PAYLOAD` para coluna dedicada. Motivação: habilitar formatação direta na UI (`"{ORIGEM} atribuiu uma venda a você"`), auditoria e filtros futuros sem parsear JSON, além de permitir uma `CHECK` constraint que formaliza a regra "`VENDA_ATRIBUIDA` sempre tem origem; `VENDA_ATRASADA` nunca tem". Decisão de manter **`NULL`** em vez de sentinel `'SISTEMA'` para evitar colisão com um eventual usuário homônimo e preservar semântica de ausência.
- **SELECT-before-INSERT para dedupe** — escolha do usuário; mais simples que UNIQUE INDEX filtrado. Risco de race em duplo tick tratado no §Riscos.
- **Scanner in-process com `setInterval` + re-entrancy guard** — processo único conforme PRD; `start()` idempotente e flag `isRunning` para tornar ticks sobrepostos no-op. Opção considerada e rejeitada: throttle/debounce — não protegem contra execuções paralelas já em andamento, apenas limitam frequência de agendamento.
- **Mutex in-memory por dedupe key no service** — combinado com o guard do scanner, cobre também concorrência entre caminhos distintos (scanner + HTTP) dentro da mesma instância sem exigir índice no banco.
- **`sseHub` próprio vs biblioteca** — avaliadas `express-sse` e `better-sse`. Proposta de manter implementação própria porque: (a) já existe um esboço em `inadimplenciaNotificationRealtime.js`, (b) o contrato de 3 eventos é trivial, (c) evita dependência extra e preserva o header `X-Accel-Buffering: no`. O `Map<username,Set<res>>` atual deverá ser reaproveitado.
- **Reuso de SQL existente** — `findOverdueSalesByUsername` deverá virar `findAllOverdue({ username? })` em vez de reescrever a query.

### Riscos Conhecidos

- **Assignment persistido sem notificação**: se o INSERT de notificação falhar após `responsavelModel.upsert`, o usuário-destino não receberá alerta imediato. Mitigação proposta: log de erro + retry manual; se a venda atrasar, o scanner cobrirá em até 60s como `VENDA_ATRASADA` (cobertura parcial).
- **Race no dedupe (SELECT-before-INSERT)**: dois ticks simultâneos (ou scanner + caminho HTTP) poderiam duplicar. Mitigações padrão desta entrega:
  1. `start()` idempotente no scanner (evita múltiplos timers em hot-reload).
  2. **Re-entrancy guard** no `overdueScanner.tick`: flag `isRunning` faz o tick seguinte virar no-op enquanto o anterior não termina — cobre o caso "tick demora mais que o intervalo".
  3. **Mutex in-memory por dedupe key** no `notificationService.createOverdueNotification`: serializa SELECT-before-INSERT concorrentes sobre a mesma `(tipo,user,venda,PROXIMA_ACAO_DIA)` dentro do processo. A key é normalizada para `YYYY-MM-DD` para casar exatamente com a comparação feita no banco.
  Observação: throttle/debounce não resolvem esse race (limitam frequência de chamadas, não execuções concorrentes já em andamento). Evolução futura: adicionar UNIQUE INDEX filtrado no banco quando houver multi-instância.
- **SSE sob proxy**: alguns proxies quebram a conexão sem bytes periódicos; heartbeat 15s + `X-Accel-Buffering: no` mitigam.
- **Dependência do fuso do SQL Server**: a query do scanner usa `CAST(kb.PROXIMA_ACAO AS date) < CAST(GETDATE() AS date)` e a computed `PROXIMA_ACAO_DIA` também usa `CAST(... AS date)` sem conversão explícita a UTC. Ambos os lados operam no fuso do servidor SQL, mantendo a consistência interna; migrações futuras para multi-região deverão padronizar para UTC (`SYSUTCDATETIME()` / `AT TIME ZONE`).
- **Crescimento indefinido de `INAD_NOTIFICACOES`** (sem expurgo — fora de escopo): índice clustered por `DT_CRIACAO DESC` deverá manter as queries paginadas performáticas; política de retenção fica para entrega futura.
- **`PAYLOAD` NVARCHAR(MAX)**: sem validação de tamanho; risco baixo dado o conteúdo fixo.

### Conformidade com Padrões

O repositório não contém `.windsurf/rules` visível. Padrões a serem seguidos por inspeção do módulo `inadimplencia`:

- Camadas `controllers → services → models`; os novos arquivos deverão seguir essa separação.
- SQL **sempre parametrizado** via `request().input(...)` (padrão de `responsavelModel.js`); deverá ser mantido no `notificationsRepository`.
- Erros deverão ser propagados com `err.statusCode` para o `errorHandler`.
- CORS/originGuard continuarão aplicados apenas no router raiz do módulo; rotas novas não devem duplicar.
- Nomes de tabelas devem ficar em constantes no topo do arquivo, como nos models atuais.

Desvios previstos: nenhum relevante.

### Arquivos relevantes e dependentes

- `src/modules/inadimplencia/index.js` — a modificar (wiring do scanner).
- `src/modules/inadimplencia/routes/notificationsRoutes.js` — a atualizar com as novas rotas.
- `src/modules/inadimplencia/controllers/notificationsController.js` — a reescrever.
- `src/modules/inadimplencia/services/notificationService.js` — **a criar**.
- `src/modules/inadimplencia/services/sseHub.js` — **a criar** (substituirá `inadimplenciaNotificationRealtime.js`).
- `src/modules/inadimplencia/services/overdueScanner.js` — **a criar**.
- `src/modules/inadimplencia/services/responsavelAssignmentService.js` — a modificar.
- `src/modules/inadimplencia/models/notificationsRepository.js` — **a criar**.
- `src/modules/inadimplencia/models/notificationsModel.js` — a corrigir (bugfix) e expor `findAllOverdue`.
- `src/modules/inadimplencia/models/responsavelModel.js` — sem alteração, apenas referência.
- `src/modules/inadimplencia/config/db.js` — reuso; `config/env.js` deverá passar a aceitar `NOTIFICATIONS_OVERDUE_SCAN_MS`.
- `src/modules/inadimplencia/middlewares/errorHandler.js` — reuso.
- `docs/db/notificacoes.sql` — **a criar** (DDL de referência).
- `tasks/prd-notificacoes-inadimplencia/prd.md` — origem dos requisitos.
