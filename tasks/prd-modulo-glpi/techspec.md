# Tech Spec — Módulo GLPI

## Resumo Executivo

Novo módulo HTTP read-only em `src/modules/glpi/` que expõe três endpoints `GET` (`/glpi/chamados`, `/glpi/inventario`, `/glpi/custos`) consumindo o banco **MySQL nativo do GLPI** via driver `mysql2/promise`. O módulo segue o padrão MVC já consolidado em `src/modules/inadimplencia/` (routes → controllers → models), reutiliza o helper `resolvePrefixedEnv('GLPI')` e o middleware de CORS de `src/shared/swaggerAccess.js`, possui `.env` próprio em `src/modules/glpi/.env` (prefixo `GLPI_`) e é montado em `src/app.js` como `/glpi`. Não há autenticação JWT — controle apenas via allowlist CORS.

A única dependência nova é **`mysql2`**, instalada porque o projeto hoje só fala SQL Server (`mssql`). Pool singleton com `connectionLimit=10` e `enableKeepAlive=true`. As três consultas oficiais entram quase intactas nos models, com ajustes apenas para receber filtros parametrizados (`?` placeholders) e remover concatenações de identificadores.

## Arquitetura do Sistema

### Visão Geral dos Componentes

Componentes a **criar**:

- **`src/modules/glpi/index.js`** — fábrica `createGlpiModule()` retornando `{ router, openapi }`. Aplica CORS escopado, monta as rotas e expõe Swagger.
- **`src/modules/glpi/server.js`** — bootstrap standalone (`tsx src/modules/glpi/server.js`) para rodar o módulo isolado em desenvolvimento.
- **`src/modules/glpi/config/env.js`** — carrega `.env` raiz + `src/modules/glpi/.env`, resolve `GLPI_*`, monta `{ DB_*, CORS_ORIGIN, CORS_ORIGINS, CORS_ALLOW_ALL, QUERY_TIMEOUT_MS, ENABLED, missingRequired, isConfigured }`.
- **`src/modules/glpi/config/db.js`** — pool singleton `mysql2/promise`, função `getPool()`; lança erro estruturado se `!env.isConfigured`.
- **`src/modules/glpi/routes/index.js`** — registra os três `GET` + `/health`.
- **`src/modules/glpi/controllers/chamadosController.js`** — parse de filtros via `utils/parseFilters.js`, delega ao model, formata resposta `{ data, count, filters }`.
- **`src/modules/glpi/controllers/inventarioController.js`** — idem.
- **`src/modules/glpi/controllers/custosController.js`** — idem.
- **`src/modules/glpi/models/chamadosModel.js`** — executa a query oficial de chamados com `pool.execute(sql, params)`; aplica filtros opcionais via cláusulas `AND` adicionadas ao `WHERE` externo.
- **`src/modules/glpi/models/inventarioModel.js`** — UNION ALL das três fontes; quando `tipo_origem` é informado, executa apenas o sub-SELECT correspondente; adiciona coluna literal `origem`.
- **`src/modules/glpi/models/custosModel.js`** — query oficial de custos com filtros de período e `grupo` (LIKE).
- **`src/modules/glpi/utils/parseFilters.js`** — normaliza/valida `data_inicio`, `data_fim` (`YYYY-MM-DD`), `status`, `tipo`, `grupo`, `tipo_origem`. Lança `AppError(400, ...)` em caso inválido.
- **`src/modules/glpi/utils/asyncHandler.js`** — wrapper padrão.
- **`src/modules/glpi/utils/AppError.js`** — classe de erro com `statusCode` e `code`.
- **`src/modules/glpi/middlewares/ensureConfigured.js`** — bloqueia chamadas com 503 quando `!env.isConfigured` ou `GLPI_ENABLED=false`.
- **`src/modules/glpi/docs/openapi.js`** — OpenAPI 3 estático com os três endpoints.
- **`src/modules/glpi/.env.example`** — template de variáveis.
- **`src/modules/glpi/__tests__/parseFilters.test.js`** — testes Vitest dos validadores.
- **`src/modules/glpi/README.md`** — exemplos `curl` e descrição dos filtros.

Componentes a **modificar**:

- **`src/app.js`** — `require('./modules/glpi')`, instanciar `createGlpiModule()`, montar em `/glpi`, expor `/docs-json/glpi`.
- **`src/docs/unifiedOpenapi.js`** — adicionar `buildGlpiOpenapi` e incluir no `buildUnifiedOpenapi`.
- **`package.json`** — adicionar `"mysql2": "^3.11.0"` em `dependencies`; adicionar scripts `"dev:glpi"` e `"start:glpi"`.
- **`.gitignore`** — garantir que `src/modules/glpi/.env` está coberto por `**/.env`.

### Fluxo de dados

```
Cliente HTTP → CORS escopado (/glpi/*) → Express Router
            → ensureConfigured → controller → parseFilters
            → model.<consulta>(filters) → mysql2 pool.execute(sql, params)
            → recordset → controller monta { data, count, filters } → JSON
```

## Design de Implementação

### Interfaces Principais

```javascript
// config/env.js
exports.env = {
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
  CORS_ORIGIN, CORS_ORIGINS, CORS_ALLOW_ALL,
  QUERY_TIMEOUT_MS, ENABLED,
  isConfigured, missingRequired,
};

// config/db.js
async function getPool(): Promise<mysql.Pool>;

// models/chamadosModel.js
async function listChamados(filters: {
  dataInicio?: string,           // 'YYYY-MM-DD'
  dataFim?: string,
  status?: string[],             // ['Novo','Atribuido',...]
  tipo?: 'Incidente'|'Requisicao',
}): Promise<Row[]>;

// models/inventarioModel.js
async function listInventario(filters: {
  dataInicio?, dataFim?,
  tipoOrigem?: 'computer'|'network'|'line',
}): Promise<Row[]>;

// models/custosModel.js
async function listCustos(filters: {
  dataInicio?, dataFim?,
  grupo?: string,                // substring; default: DW|DECODIFICAR|ESSOLUCAO (regra fixa do SQL)
}): Promise<Row[]>;
```

### Modelos de Dados (resposta JSON)

`/glpi/chamados` retorna o conjunto de colunas da consulta oficial (`id`, `tipo`, `titulo`, `data_abertura`, `data_fechamento`, `status`, `solicitante`, `descricao_categoria`, `grupo_equipe`, `grupo_empresa`, `nome_tecnico`, `time_to_resolve`, `time_to_own`, `localizacao`, `cidade`, `etiqueta`, …).

`/glpi/inventario` retorna `{ id, ativo, serial, comment, localizacao, cidade, estado, tipo, lotado_para, status, date_creation, date_mod, last_inventory_update, etiqueta, custo, origem }` (`origem ∈ {Computer, NetworkEquipment, Line}`).

`/glpi/custos` retorna `{ id, tickets_id, grupo, titulo, comment, data_atendimento, custo_total }`.

Wrapper de resposta: `{ data: Row[], count: number, filters: { ...filtrosAplicados } }`.

### Endpoints de API

- `GET /glpi/health` → `{ status, configured, missingRequired, timestamp }` (200 ou 503).
- `GET /glpi/chamados?data_inicio=&data_fim=&status=&tipo=` → 200 `{ data, count, filters }`.
- `GET /glpi/inventario?data_inicio=&data_fim=&tipo_origem=` → 200 `{ data, count, filters }`.
- `GET /glpi/custos?data_inicio=&data_fim=&grupo=` → 200 `{ data, count, filters }`.

Erros: 400 (`{ error, code: 'INVALID_FILTER' }`), 503 (`{ error, code: 'GLPI_NOT_CONFIGURED' | 'DB_UNAVAILABLE' }`), 500 genérico.

### Estratégia de filtros (SQL)

Consultas oficiais permanecem como **subquery base** (já validada). Filtros opcionais são aplicados **na query externa**:

```sql
-- chamados (recorte)
SELECT * FROM ( <SQL OFICIAL DE CHAMADOS> ) t
WHERE 1=1
  /* opcionais, anexados via concat de strings constantes (não input do usuário) */
  AND (? IS NULL OR t.data_abertura >= ?)
  AND (? IS NULL OR t.data_abertura <  DATE_ADD(?, INTERVAL 1 DAY))
  AND (? IS NULL OR t.status   = ?)
  AND (? IS NULL OR t.tipo     = ?)
ORDER BY t.id;
```

Valores são passados sempre via placeholders `?`. Para multi-valor (`status=Novo,Fechado`) usa-se `FIND_IN_SET(t.status, ?)` recebendo a string CSV. **Nunca** concatena valor do usuário no SQL.

Para `inventario`, quando `tipo_origem` for informado, somente o `SELECT` correspondente é executado (sem UNION), economizando I/O. Coluna `origem` é literal (`SELECT 'Computer' AS origem, ...`).

Para `custos`, o filtro `grupo` é aplicado como `AND BASE.GRUPO LIKE CONCAT('%', ?, '%')` mantendo a allowlist fixa do SQL original (`DW|DECODIFICAR|ESSOLUCAO`).

### Configuração `.env`

`src/modules/glpi/.env.example` (versionado):

```
GLPI_ENABLED=true
GLPI_DB_HOST=localhost
GLPI_DB_PORT=3306
GLPI_DB_USER=glpi_readonly
GLPI_DB_PASSWORD=
GLPI_DB_NAME=glpi
GLPI_QUERY_TIMEOUT_MS=30000
GLPI_CORS_ORIGIN=https://portal.jotanunes.com.br,https://bi.jotanunes.com.br
```

`src/modules/glpi/.env` (não versionado): cópia que o usuário preenche.

`config/env.js` carrega `.env` raiz primeiro e depois `src/modules/glpi/.env` (segundo `dotenv.config({ override: false })` — variáveis específicas vencem). Em seguida `resolvePrefixedEnv('GLPI')` extrai apenas as próprias.

### Pool de conexão

```javascript
mysql.createPool({
  host, port, user, password, database,
  connectionLimit: 10,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,             // datas como string ISO simplifica JSON
  timezone: 'Z',
});
```

Cada `pool.execute(sql, params, { timeout: env.QUERY_TIMEOUT_MS })` aplica timeout por consulta. Erros do mysql2 (`ER_BAD_FIELD_ERROR`, `ECONNREFUSED`, `ETIMEDOUT`) são mapeados para `AppError(503, 'Banco GLPI indisponivel.', 'DB_UNAVAILABLE')` no controller.

## Pontos de Integração

- **MySQL do GLPI**: usuário **somente leitura** dedicado, com permissão `SELECT` nas tabelas usadas (`glpi_tickets`, `glpi_tickets_users`, `glpi_users`, `glpi_itilcategories`, `glpi_locations`, `glpi_plugin_tag_*`, `glpi_computers`, `glpi_networkequipments`, `glpi_lines`, `glpi_computertypes`, `glpi_networkequipmenttypes`, `glpi_linetypes`, `glpi_states`, `glpi_infocoms`, `glpi_ticketcosts`, `glpi_groups`, `glpi_groups_tickets`).
- **CORS**: `createCorsOptionsDelegate(env)` + middleware `isRequestAllowed` (mesmo `src/shared/swaggerAccess.js` já usado por `estoque-online`/`m365`).
- **Swagger**: `/docs-json/glpi` exposto em `src/app.js`; entrada nova no array `urls` do swagger-ui.

## Abordagem de Testes

### Testes Unitários (vitest)

`src/modules/glpi/__tests__/parseFilters.test.js`:

- Casos válidos: combinações de `data_inicio`/`data_fim`, listas em `status`, `tipo` aceito.
- Casos inválidos: `data_inicio` malformada (esperar `AppError 400`), `data_fim < data_inicio`, `status` desconhecido, `tipo_origem` fora da enumeração.
- Default: sem filtros → retorna objeto vazio.

Sem mock de banco: services não são testados nessa entrega (decisão do produto).

### Testes de Integração / E2E

Fora de escopo nesta entrega. Validação manual via `curl` documentada no `README.md`.

## Sequenciamento de Desenvolvimento

1. **Adicionar `mysql2`** ao `package.json` e `npm install`.
2. **Esqueleto de pastas** + `.env.example` + `config/env.js` + `config/db.js` (com health check).
3. **Utils** (`asyncHandler`, `AppError`, `parseFilters`) e teste vitest.
4. **Models** das três consultas, validados manualmente com `curl` em desenvolvimento.
5. **Controllers + routes + middleware `ensureConfigured`**.
6. **`index.js`** (fábrica) + bootstrap `server.js` standalone.
7. **OpenAPI** (`docs/openapi.js`).
8. **Wire-up em `src/app.js` e `src/docs/unifiedOpenapi.js`**.
9. **README** com exemplos.
10. **Smoke test** dos três endpoints com banco real.

### Dependências Técnicas

- `mysql2 ^3.11`. Sem outras dependências novas.
- Disponibilidade do MySQL do GLPI a partir do host onde a API roda (host/porta liberados em firewall).
- Usuário MySQL com `SELECT` nas tabelas listadas.

## Monitoramento e Observabilidade

- **Logs estruturados** (console JSON) em cada model: `{ module: 'glpi', endpoint, durationMs, rowCount }`. Erros com `code` e mensagem do mysql2 (sem stack em prod).
- **`/glpi/health`** com `configured`, `missingRequired` e ping leve no pool (`SELECT 1`).
- Sem métricas Prometheus nesta entrega (não há infra correspondente no projeto). Logs são suficientes.

## Considerações Técnicas

### Decisões Principais

- **Driver `mysql2`** vs ORM (Sequelize/Drizzle): consultas são SQL nativo complexo já validado pela operação; ORM agregaria complexidade sem ganho. Usar driver puro com pool e prepared statements.
- **MVC tipo `inadimplencia`** vs TS (estoque-online): pedido explícito do produto. Mantém familiaridade do time.
- **Subquery + filtros externos** vs reescrever a SQL: preserva a lógica original (`CASE` complexos, joins) e isola filtros como cláusulas opcionais com placeholders, eliminando risco de SQL injection.
- **Sem cache**: volume atual cabe em <5 s. Avaliar Redis em iteração futura se p95 degradar.
- **`.env` próprio do módulo**: isola credenciais GLPI das demais (alinhado a `estoque-online`).
- **Multi-empresa via campo `grupo_empresa`**: PRD definiu não criar rotas por empresa; consumidor filtra.

### Riscos Conhecidos

- **Performance** das consultas em volumes altos (>100k tickets). Mitigação: índices em `glpi_tickets.date`, `glpi_tickets.is_deleted`, `glpi_tickets_users(tickets_id, type)`. Documentar no README pedindo confirmação ao DBA do GLPI.
- **Dependência de tabelas plugin** (`glpi_plugin_tag_*`): se o plugin Tag não estiver instalado, queries falham com `ER_NO_SUCH_TABLE`. Mitigação: detectar em `health` e retornar `tagPluginAvailable: false`. (Backlog — implementar se ocorrer.)
- **Datas como string** (`dateStrings: true`): consumidor recebe `'YYYY-MM-DD HH:MM:SS'`. Documentar no OpenAPI.
- **Consultas longas**: timeout de 30 s no `pool.execute` evita conexões presas; ajustável via `GLPI_QUERY_TIMEOUT_MS`.

### Conformidade com Padrões

- **`.windsurf/rules/techspec-codebase.md`**: regra é específica do módulo `inadimplencia`; **não se aplica** ao módulo GLPI. Mantemos alinhamento conceitual: pool singleton, `resolvePrefixedEnv`, CORS via `swaggerAccess`, contrato de erro `{ error }`, models executam SQL, controllers finos, parametrização total via placeholders.
- **Stack do projeto**: CommonJS + Express 4 + dotenv + Swagger UI — todos respeitados.
- **Sem JWT/session** (decisão explícita do produto, espelha módulos existentes que confiam em CORS).

### Arquivos relevantes e dependentes

- `c:\api-inadimplencia\src\app.js` (modificar — registrar módulo).
- `c:\api-inadimplencia\src\docs\unifiedOpenapi.js` (modificar — adicionar buildGlpiOpenapi).
- `c:\api-inadimplencia\src\shared\swaggerAccess.js` (consumir — sem alterar).
- `c:\api-inadimplencia\src\shared\moduleEnv.js` (consumir — sem alterar).
- `c:\api-inadimplencia\src\modules\estoque-online\` (referência de padrão para `.env` do módulo).
- `c:\api-inadimplencia\src\modules\inadimplencia\` (referência de padrão MVC JS).
- `c:\api-inadimplencia\package.json`, `package-lock.json` (modificar — `mysql2`).
- `c:\api-inadimplencia\.gitignore` (verificar cobertura de `src/modules/*/.env`).
- `c:\api-inadimplencia\tasks\prd-modulo-glpi\prd.md` (fonte de requisitos).
