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
