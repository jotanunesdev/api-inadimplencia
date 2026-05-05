---
trigger: model_decision
description: Usar sempre que precisar tomar decisão arquitetural ou técnica no módulo inadimplencia da api-inadimplencia
---

# Regra: consultar `src/modules/inadimplencia/docs/techspec-codebase.md`

SEMPRE que for planejar mudanças, adicionar rota, alterar SQL, mexer em CORS, integrar Fluig/RM ou mudar contrato HTTP no módulo **inadimplencia**, leia antes:

- `c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md`

Esse documento é a fonte da verdade sobre stack, padrões, tabelas, rotas e gotchas do módulo.

## Pontos não-negociáveis (resumo que NÃO substitui o doc)

- **Stack**: Node.js (CommonJS via `tsx`) + Express 4 + `mssql` 10 + Swagger UI + dotenv. Prefixo env: `INAD_`. PM2 via `ecosystem.config.js`.
- **Bootstrap**: `server.js` usa `standaloneApp` que monta `createInadimplenciaModule()` em `/inadimplencia` **e** `legacyApp` na raiz (rotas duplicadas — por design). O `app.js` raiz do repositório monta apenas a forma prefixada.
- **Padrão arquitetural**: MVC em camadas — `routes/ → controllers/ → models/` + `services/` para integrações externas. **Controllers não executam SQL.** Models parametrizam 100% das queries com `.input(name, sql.Type, value)`.
- **Rotas (prefixo `/inadimplencia`)**: `/health`, `/` (inadimplência), `/proximas-acoes` (somente leitura; mutations via `/ocorrencias`), `/ocorrencias`, `/atendimentos`, `/usuarios`, `/responsaveis`, `/kanban-status`, `/dashboard/*` (25+ endpoints), `/relatorios/ficha-financeira`.
- **Contrato de resposta**: sucesso `{ data }`, criação `201 { data }`, sem corpo `204`, erro `{ error: string }` + status HTTP. Para erros de domínio, defina `err.statusCode` e use `next(err)`; o `middlewares/errorHandler.js` respeita o status.
- **Payload**: aceitar camelCase **e** UPPER_SNAKE_CASE (`numVenda`/`NUM_VENDA_FK`, `nomeUsuario`/`NOME_USUARIO_FK`, ...). Frontend envia ambos.
- **Banco**: SQL Server, tabelas principais: `DW.fat_analise_inadimplencia_v4` (fato), `dbo.OCORRENCIAS`, `dbo.ATENDIMENTOS`, `dbo.USUARIO`, `dbo.VENDA_RESPONSAVEL`, `dbo.KANBAN_STATUS`. Filtro global de inadimplência: `buildInadimplenteCondition(alias)` → `UPPER(LTRIM(RTRIM(COALESCE(INADIMPLENTE,''))))='SIM'`.
- **Abstrações obrigatórias**:
  - Pool singleton (`config/db.js:getPool`).
  - `resolvePrefixedEnv('INAD')` (`src/shared/moduleEnv.js`) para ler env.
  - `createCorsOptionsDelegate` + `isRequestAllowed` (`src/shared/swaggerAccess.js`) para CORS/origin guard. Requests sem `Origin` passam; Swagger sempre passa.
  - `OUTER APPLY` padrão para `ultima_acao.PROXIMA_ACAO`.
  - `MERGE` para upserts (`responsavelModel`, `kanbanStatusModel`).
  - Protocolo de atendimento (`AAAAMMDD#####`) gerado em transação **SERIALIZABLE** com `UPDLOCK, HOLDLOCK` (`atendimentosModel.generateProtocol`).
  - Snapshot JSON da venda em `DADOS_VENDA`; ao ler, `attachSnapshot` expõe `VENDA_SNAPSHOT`.
  - Validação reflexiva de FK em `ocorrenciasModel.getNumVendaReference()` antes de insert/update; `err.number===547` vira `409 NUM_VENDA_REFERENCE_NOT_FOUND`.
- **Integrações externas**:
  - **Fluig** (`services/fluigDataset.js`): login em `j_security_check` com cookie cacheado 10 min, retry em 401/403. `fetchDataset(name, { fields, order, constraints })`. Constraints MUST/MUST_NOT/SHOULD.
  - **RM Ficha Financeira** (`services/rmReportService.js`): 3 passos (parâmetros → fallback por metadata ou coligada alternada → execução). Cliente chama `GET /relatorios/ficha-financeira?numVenda=...`; POST para start assíncrono ainda não implementado (responder 404/405 mantém fallback do frontend).
- **Segurança**:
  - Sem JWT/Session neste módulo. Confiança via CORS + origem Fluig. `INAD_CORS_ORIGIN` aceita lista CSV ou `*`.
  - Sempre parametrizar SQL. Concatenação só para identificadores (`quoteIdentifier`).
  - Nunca logar credenciais, cookies Fluig ou XML do RM fora do modo `INAD_RM_DEBUG=true`.
- **Swagger**: atualizar `swagger.js` a cada nova rota para manter o `/docs-json/inadimplencia`.
- **Status kanban**: normalizar para `todo | inProgress | done` (aliases PT-BR aceitos). `PERFIL` ∈ `{admin, operador}`. `COR_HEX` ∈ `/^#[0-9a-fA-F]{6}$/`. `NUM_VENDA_FK` é `Int` seguro (`Number.isSafeInteger`).

Se algum item aparentar conflito com o código atual, reabra o `techspec-codebase.md` e valide a seção correspondente (Rotas, Engines, Gotchas, Mapa de Navegação). Atualize o doc quando a decisão arquitetural mudar.

---
trigger: model_decision
description: Usar sempre que precisar tomar decisão arquitetural ou técnica no projeto api-inadimplencia
---

# Regra Arquitetural — api-inadimplencia (Módulo inadimplencia)

> Documento completo em: `documentos/techspec-codebase.md`

## Stack
- **Runtime**: Node.js + Express.js 4.x, CommonJS (.js), runner `tsx`
- **Banco**: SQL Server via `mssql` (pool gerenciado em `config/db.js`)
- **Transporte real-time**: Server-Sent Events (SSE) — não WebSocket
- **Testes**: Jest com mocks manuais via `jest.fn()` (sem `jest.mock` automático)
- **Processo**: PM2 (`ecosystem.config.js`) em produção

## Arquitetura Canônica
Fluxo obrigatório: `routes/ → controllers/ → services/ → models/ (repository) → SQL Server`

Nunca pular camadas. Controllers não contêm lógica de negócio. Models não chamam services.

## Padrões Obrigatórios

### Notificações
- **Persist-then-Broadcast**: sempre gravar no banco ANTES de emitir SSE via `sseHub`
- **Dedupe VENDA_ATRASADA**: chave = `TIPO|username_normalizado|NUM_VENDA|PROXIMA_ACAO_DIA`
- **Mutex in-process**: `dedupeMutex` (Set) serializa concurrent SELECT-before-INSERT no mesmo worker
- **Soft-delete**: nunca DELETE físico — usar `DT_EXCLUSAO = SYSUTCDATETIME()`. Deleção exige `LIDA = 1`
- **Scanner**: `overdueScanner` usa re-entrancy guard (`isRunning`) e não inicia em `NODE_ENV=test`
- **Arquivo legado** `inadimplenciaNotificationRealtime.js`: NÃO usar em novas features — substituído por `sseHub.js`

### Erros
- Criar com `buildError(message, statusCode)` — adiciona `err.statusCode` ao Error
- Controllers sempre passam via `next(err)`, nunca tratam direto
- `errorHandler.js` centraliza: resposta `{ error: message }` com status HTTP
- Falhas de notificação em `responsavelAssignmentService` são capturadas e logadas — não propagam

### DTOs e Normalização
- `mapRowToDTO(row)` no service converte colunas `UPPER_SNAKE` → DTO `camelCase`
- `PAYLOAD` é JSON string no banco — parseado na leitura
- `normalizeUsername(v)` = `.trim().toLowerCase()` — aplicar SEMPRE antes de comparar ou gravar username

### Configuração
- Vars de ambiente via `config/env.js` com prefixo `INAD_*`
- `INAD_NOTIFICATIONS_OVERDUE_SCAN_MS`: intervalo do scanner (mínimo 15000ms, padrão 60000ms)

## Tabela Principal: `dbo.INAD_NOTIFICACOES`
Colunas-chave: `ID` (GUID), `TIPO`, `USUARIO_DESTINATARIO`, `ORIGEM_USUARIO`, `NUM_VENDA`, `PROXIMA_ACAO`, `PAYLOAD` (JSON), `LIDA` (bit), `DT_CRIACAO`, `DT_LEITURA`, `DT_EXCLUSAO`

Tipos válidos: `'VENDA_ATRASADA'` (sistema) | `'VENDA_ATRIBUIDA'` (admin)

## Gotchas Críticos
1. **Mutex não funciona em múltiplos workers PM2** — proteção de duplicata depende do `findByDedupeKey` no banco
2. **SSE requer** `X-Accel-Buffering: no` para funcionar atrás de Nginx
3. **`softDelete` HTTP 409** quando notificação não está lida — comportamento de produto intencional
4. **Bugs conhecidos documentados** em `src/modules/inadimplencia/tasks/bugs-notifications.md` (5 bugs, incluindo SQL quebrado em `listUnread` — Alta severidade)

## Mapa de Arquivos-Chave
| Arquivo | Responsabilidade |
|---|---|
| `services/notificationService.js` | Regras de negócio, DTOs, dedupe |
| `services/overdueScanner.js` | Scanner periódico de vendas atrasadas |
| `services/sseHub.js` | Gestão de conexões SSE |
| `services/responsavelAssignmentService.js` | Atribuição + disparo de VENDA_ATRIBUIDA |
| `models/notificationsRepository.js` | CRUD na tabela INAD_NOTIFICACOES |
| `models/notificationsModel.js` | Query de vendas inadimplentes no DW |
| `config/env.js` | Resolução de variáveis de ambiente |
| `index.js` | Bootstrap do módulo + start do scanner |
