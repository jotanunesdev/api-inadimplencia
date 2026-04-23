# Tech Spec: api-inadimplencia · módulo `inadimplencia`

> Serviço Express (Node.js) que expõe a API de Inadimplência consumida pelo frontend `jnc_inadimplencia`. Faz leitura do Data Warehouse SQL Server (tabelas `DW.fat_analise_inadimplencia_v4`, `dbo.OCORRENCIAS`, `dbo.ATENDIMENTOS`, `dbo.USUARIO`, `dbo.VENDA_RESPONSAVEL`, `dbo.KANBAN_STATUS`) e integração com datasets do TOTVS Fluig para obter a Ficha Financeira do RM.

---

## 1. Visão Geral

- **Produto**: módulo `inadimplencia` dentro do monorepo `api-inadimplencia`, composto por vários módulos independentes (auth, treinamento, rm, estoque-online, m365, fluig, pm2, entrada-nota-fiscal, inadimplencia). Cada módulo pode subir sozinho (`dev:inadimplencia`) ou ser montado pelo `app.js` raiz que agrega todos em um único Express + Swagger.
- **Papel**: backend de leitura/escrita da carteira inadimplente. Produz KPIs e séries temporais para o dashboard, controla ciclo de atendimento (criação de `PROTOCOLO`), registra ocorrências com `PROXIMA_ACAO`, atualiza posição do kanban, mantém responsáveis e usuários, e atua como _broker_ do relatório _Ficha Financeira_ do TOTVS RM via Fluig.
- **Clientes**: frontend `jnc_inadimplencia` (React) e, eventualmente, consumidores internos via Swagger (`/docs`).

### 1.1. Como sobe

| Comando | Ação |
| --- | --- |
| `npm run dev:inadimplencia` | `tsx watch src/modules/inadimplencia/server.js` — sobe **somente** este módulo em `PORT` (default `3001`, override via env `INAD_PORT`). |
| `npm run start:inadimplencia` | Idem, sem watch. |
| `npm run dev` | Sobe **todos** os módulos em `src/app.js`, expondo `/inadimplencia/*`, `/treinamento/*`, `/rm/*`, ... e o Swagger unificado em `/docs`. |
| PM2 | `ecosystem.config.js` registra `name: "inadimplencia"` apontando para `server.js`. |

### 1.2. Composição

- **`index.js`** (factory `createInadimplenciaModule()`): retorna `{ router, openapi }`. Usado pelo `app.js` raiz. Aplica CORS + _origin guard_, health-check e _sub-routers_ (`/inadimplencia`, `/proximas-acoes`, `/ocorrencias`, `/usuarios`, `/responsaveis`, `/dashboard`, `/kanban-status`, `/atendimentos`, `/relatorios`). Finaliza com 404 handler + `errorHandler`.
- **`standaloneApp.js`**: cria um `express()` completo, monta `createInadimplenciaModule()` sob `/inadimplencia` **e** o `legacyApp` na raiz. Usado por `server.js`.
- **`legacyApp.js`**: versão “achatada” sem prefixo `/inadimplencia`, com Swagger UI em `/docs` e JSON em `/docs-json`. Coexiste com o módulo novo durante a migração para o `app.js` unificado.
- **`server.js`**: bootstrap `createStandaloneApp().listen(PORT)`.

> **Efeito colateral**: no modo standalone o mesmo conjunto de rotas é servido **duas vezes** (em `/inadimplencia/*` e em `/*`). Útil para clientes antigos; novos clientes devem usar o prefixo. No modo unificado só existe a forma prefixada.

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js (CommonJS, `"type": "commonjs"`) executado via **`tsx`** — permite .js/.ts sem compilação explícita. |
| Framework Web | Express 4.19 |
| Banco | SQL Server (Microsoft), driver `mssql` 10 (connection pooling via `getPool`) |
| Auth/Segurança | `cors` 2.8 (delegate baseado em origem), _origin guard_ custom (`shared/swaggerAccess.js`) |
| Documentação | `swagger-ui-express` + OpenAPI 3.0 escrito à mão em `swagger.js` |
| Integração Fluig | `fetch` (nativo 18+) / `node-fetch` fallback, autenticação via `j_security_check` com cookie cacheado |
| Parsing | `fast-xml-parser`, regex (para XML do RM) |
| Config | `dotenv` (carrega `.env` raiz e `.env` do módulo em cascata); prefixo `INAD_` |
| Processo | PM2 via `ecosystem.config.js` |
| Lint/Test | Vitest (monorepo) — o módulo não possui testes automatizados próprios hoje |

### 2.1. Dependências relevantes do `package.json` raiz

- `axios`, `mssql`, `cors`, `swagger-ui-express`, `node-fetch`, `dotenv`, `express` — diretamente usadas aqui.
- `jsonwebtoken`, `bcryptjs`, `ldapjs`, `multer`, `sharp`, `docxtemplater` — pertencem a outros módulos.

---

## 3. Arquitetura e Padrões

### 3.1. Padrão dominante: **MVC em camadas (Routes → Controllers → Models)** com serviços auxiliares

```
src/modules/inadimplencia/
├── index.js                ← factory do módulo (Router Express + OpenAPI)
├── legacyApp.js            ← app standalone herdado (sem prefixo)
├── standaloneApp.js        ← compõe index + legacy
├── server.js               ← ponto de entrada do processo
├── ecosystem.config.js     ← PM2
├── swagger.js              ← OpenAPI 3.0 spec escrito à mão
├── config/
│   ├── env.js              ← resolução de env com prefixo INAD_ + CORS
│   └── db.js               ← pool mssql singleton
├── middlewares/
│   └── errorHandler.js     ← tratador global de erros (status+JSON)
├── routes/                 ← um arquivo por recurso, Express Router
│   ├── inadimplenciaRoutes.js
│   ├── proximaAcaoRoutes.js
│   ├── ocorrenciasRoutes.js
│   ├── usuarioRoutes.js
│   ├── responsavelRoutes.js
│   ├── dashboardRoutes.js
│   ├── kanbanStatusRoutes.js
│   ├── atendimentosRoutes.js
│   └── relatoriosRoutes.js
├── controllers/            ← validação + mapeamento de req/res, SEM SQL
│   └── *Controller.js
├── models/                 ← SQL Server (queries parametrizadas) e regras de domínio
│   └── *Model.js
├── services/               ← integrações externas isoladas
│   ├── fluigDataset.js     ← sessão + fetchDataset do Fluig
│   └── rmReportService.js  ← fluxo Ficha Financeira (RM via Fluig)
└── docs/
    └── sql/                ← scripts de migração/diagnóstico (FK Ocorrências)
```

Regras práticas adotadas:

- **Controllers**: validação de entrada (tipo, obrigatoriedade, GUID), parsing (`parseNumVenda`, `parseDate`), normalização (`normalizeStatus`, `normalizePerfil`, `normalizeHex`) e orquestração. Respondem sempre em JSON. Aceitam campos em múltiplos formatos (camelCase e UPPER_SNAKE).
- **Models**: ponto único de SQL. Utilizam `pool.request().input(name, sql.Type, value).query(...)` — parametrização estrita via `mssql` para evitar SQLi. Retornam `recordset` ou registros normalizados.
- **Services**: integrações HTTP externas. Isolam sessão Fluig, retry 401 e parsing XML.
- **Middlewares**: por ora só o `errorHandler`. Não há autenticação por token aqui — o módulo depende de _origin guard_ + CORS.

### 3.2. Tabelas e domínio

| Tabela | Função | Principais colunas usadas |
| --- | --- | --- |
| `DW.fat_analise_inadimplencia_v4` | Fato principal de inadimplência. Usa `INADIMPLENTE='SIM'` como filtro padrão. | `CLIENTE`, `CPF_CNPJ`, `NUM_VENDA`, `EMPREENDIMENTO`, `BLOCO`, `UNIDADE`, `QTD_PARCELAS_INADIMPLENTES`, `STATUS_REPASSE`, `SCORE`, `SUGESTAO`, `VENCIMENTO_MAIS_ANTIGO`, `VALOR_TOTAL_EM_ABERTO` (saldo), `VALOR_INADIMPLENTE`, `VALOR_NAO_CONTRATUAL_INAD`, `VALOR_POUPANCA_INAD` |
| `dbo.OCORRENCIAS` | Histórico de contatos/ações da cobrança. | `ID` (UUID), `NUM_VENDA_FK`, `NOME_USUARIO_FK`, `PROTOCOLO`, `DESCRICAO`, `STATUS_OCORRENCIA`, `DT_OCORRENCIA`, `HORA_OCORRENCIA`, `PROXIMA_ACAO` (DateTime) |
| `dbo.ATENDIMENTOS` | Abertura formal de atendimento (gera `PROTOCOLO AAAAMMDD#####`). | `PROTOCOLO`, `NUM_VENDA_FK`, `CPF_CNPJ`, `CLIENTE`, `EMPREENDIMENTO`, `DADOS_VENDA` (JSON snapshot), `CRIADO_EM` |
| `dbo.USUARIO` | Usuários operacionais (sincronizados com Fluig no primeiro acesso). | `NOME`, `USER_CODE`, `PERFIL` (`admin`/`operador`), `CPF_USUARIO`, `SETOR`, `CARGO`, `ATIVO`, `COR_HEX` |
| `dbo.VENDA_RESPONSAVEL` | Quem atende/é dono da venda. | `NUM_VENDA_FK`, `NOME_USUARIO_FK`, `DT_ATRIBUICAO` |
| `dbo.KANBAN_STATUS` | Posição no kanban diário. | `NUM_VENDA_FK`, `PROXIMA_ACAO`, `STATUS` (`todo`/`inProgress`/`done`), `STATUS_DATA`, `NOME_USUARIO_FK`, `DT_ATUALIZACAO` |
| `DW.fat_associados_num_venda` | Associados/fiadores da venda (cônjuge, cessionário, fiador). Criada em 2026-04-22. | `ID_ASSOCIADO`, `ID_RESERVA`, `ID_PESSOA`, `NOME`, `DOCUMENTO`, `DATA_CADASTRO`, `RENDA_FAMILIAR`, `TIPO_ASSOCIACAO`, `NUM_VENDA`, `ENDERECO` |
| `DW.vw_fiadores_por_venda` | View que expõe associados apenas de vendas inadimplentes (INNER JOIN com `fat_analise_inadimplencia_v4`). Consumida pelo endpoint `/fiadores/*`. Índice `IX_fat_associados_num_venda__NUM_VENDA` acelera lookups. | Mesmas colunas de `fat_associados_num_venda` |

Relacionamento central: `dbo.OCORRENCIAS.NUM_VENDA_FK` → `DW.fat_analise_inadimplencia_v4.NUM_VENDA` (validado em runtime via `sys.foreign_keys`; ver `models/ocorrenciasModel.js:47-87`).

Relacionamento N:1 por `NUM_VENDA`: `DW.fat_associados_num_venda` → `DW.fat_analise_inadimplencia_v4`. Índice `IX_fat_associados_num_venda__NUM_VENDA` acelera o lookup (criado junto com a view; script versionado em `docs/sql/2026-04-22-fiadores-fat-associados.sql`).

### 3.3. Engines e Abstrações Core

- **Pool MSSQL singleton** (`@/c:/api-inadimplencia/src/modules/inadimplencia/config/db.js`): `getPool()` inicializa uma `Promise` única de conexão com `max=10, min=0, idle=30s`. Usado por todos os models. Quebra se faltar `DB_USER/PASSWORD/SERVER/DATABASE`.
- **Env com prefixo (`@/c:/api-inadimplencia/src/shared/moduleEnv.js`)**: `resolvePrefixedEnv('INAD')` copia todas as variáveis `INAD_*` em um objeto sem o prefixo. Permite compartilhar `process.env` entre módulos sem colisão (cada módulo tem seu prefixo: `INAD_`, `TREIN_`, etc.).
- **CORS / Origin Guard** (`@/c:/api-inadimplencia/src/shared/swaggerAccess.js`): delegate dinâmico que (i) permite qualquer request sem `Origin` (ex.: curl), (ii) permite tudo sob `/docs*` (Swagger UI), (iii) bloqueia outras origens não listadas em `CORS_ORIGIN` (suporta `*`).
- **`last PROXIMA_ACAO` via `OUTER APPLY`**: padrão SQL repetido em `inadimplenciaModel` e `dashboardModel`. Resolve “última próxima ação” por venda ordenando `DT_OCORRENCIA DESC, HORA_OCORRENCIA DESC, PROXIMA_ACAO DESC` e pegando `TOP 1`.
- **Protocolo atômico (`atendimentosModel.generateProtocol`)**: gera `AAAAMMDD#####` dentro de uma **transação SERIALIZABLE** com hint `UPDLOCK, HOLDLOCK` para evitar colisão de sequência. O número máximo do dia é lido e incrementado.
- **Snapshot de venda (`atendimentosModel`)**: a venda é serializada em JSON (`DADOS_VENDA NVARCHAR(MAX)`) no momento da abertura do atendimento; `attachSnapshot` recompõe `VENDA_SNAPSHOT` no read. Estratégia deliberada para congelar os valores financeiros no instante do atendimento.
- **Upsert SQL via `MERGE`**: padrão consistente em `kanbanStatusModel` e `responsavelModel` (chave composta `NUM_VENDA_FK [+ PROXIMA_ACAO]`).
- **Foreign Key guard reflexivo**: `ocorrenciasModel.getNumVendaReference()` descobre em tempo de execução qual tabela é referenciada por `OCORRENCIAS.NUM_VENDA_FK` (consultando `sys.foreign_keys`). Valida existência **antes** de inserir; se a FK constraint dispara (`err.number === 547`), mapeia para erro `409` amigável (`buildNumVendaReferenceError`).
- **Sessão Fluig cacheada (`services/fluigDataset.js`)**: faz `POST /portal/j_security_check`, captura o cookie `set-cookie` e mantém em memória por 10 min. `fetchDataset(name, {fields, order, constraints})` monta a URL do endpoint `/dataset/api/v2/dataset-handle/search`, suporta constraints `MUST/MUST_NOT/SHOULD` e faz _retry_ em 401/403 renovando a sessão.
- **Ficha Financeira (`services/rmReportService.js`)**: pipeline de 3 passos:
  1. Busca XML de parâmetros via dataset `ds_paramsRel` (coligada+reportId).
  2. Fallback automático: se o relatório não for localizado, consulta `ds_paiFilho_controleDeAcessoRMreportsFluig` para descobrir `reportId/reportColigada` reais; se ainda falhar, tenta coligada alternada (0↔1).
  3. Aplica valores dos parâmetros (`COLIGADA`, `NUMVENDA`) via regex no XML e dispara o dataset `dsIntegraFacilRM` com constraints `OPC=6, REPORT, COLIGADA, PARAMETER, FILE=Report.pdf, FILTRO=''`. Retorna URL do PDF.

---

## 4. Design de Código e Convenções

### 4.1. Nomenclatura

- **Arquivos**: camelCase (`inadimplenciaController.js`, `kanbanStatusModel.js`).
- **Exports**: `module.exports = { ... }` com funções nomeadas. Controllers sempre retornam `(req, res, next)` async e propagam erros com `next(err)`.
- **Recursos (rotas)**: plural em kebab-case (`/proximas-acoes`, `/kanban-status`). Exceção `/inadimplencia` (singular, histórico).
- **Tabelas**: UPPER_SNAKE (`NUM_VENDA_FK`, `STATUS_OCORRENCIA`).
- **Status kanban**: normalizados para `todo | inProgress | done` (camelCase no banco), com aliases PT-BR aceitos (`a fazer`, `em andamento`, `concluído`).
- **PERFIL**: apenas `admin` ou `operador`.
- **COR_HEX**: aceita com/sem `#`, validada contra `/^#([0-9a-fA-F]{6})$/`.
- **Identificadores**: `ID` de ocorrência é `UniqueIdentifier` (UUID v1-5 com variante 8/9/a/b), validado por regex antes de consultar.

### 4.2. Contrato de resposta

- **Sucesso listagem/detalhe**: `200 { data: ... }`. Algumas rotas retornam `{ data, exists: true }` quando fazem upsert idempotente (`usuarioController.create`).
- **Sucesso criação**: `201 { data: ... }`.
- **Sucesso sem corpo**: `204` (deleções).
- **Erro**: `{ error: string }` com status HTTP adequado. Definidos manualmente nos controllers; para erros lançados com `err.statusCode`, `errorHandler` respeita o código.
- **404 genérico** (rota não encontrada): `router.use((_, res) => res.status(404).json({ error: 'Endpoint nao encontrado' }))`.
- **5xx**: `errorHandler` loga no console e responde `{ error: err.message || 'Erro interno do servidor.' }`.

### 4.3. Tratamento de Erros (padrões)

1. `try/catch` em controllers chamando `next(err)` em caminhos inesperados.
2. Validações manuais retornam `res.status(4xx).json({ error })` diretamente, sem passar pelo handler.
3. Erros de domínio (ex.: `NUM_VENDA_REFERENCE_NOT_FOUND`) são enriquecidos com `err.statusCode=409` e `err.code` no model e propagados via `next(err)`.
4. Erros de integração Fluig/RM viram `Error('Relatorio nao localizado...')` com mensagens específicas — sem stack traces expostas ao cliente.

### 4.4. Segurança e CORS

- **Nenhum JWT/Session**: confiança baseada em origem + rede interna. `INAD_CORS_ORIGIN` aceita lista separada por vírgula, ou `*` para liberar geral.
- **Origin Guard**: `originGuard` (em `index.js`/`legacyApp.js`) retorna `403 { error: 'Origem nao permitida.' }` para origens fora da lista, exceto Swagger. Aplicado antes das rotas.
- **OPTIONS preflight**: tratado via `router.options('*', cors(corsOptions))`.
- **SQL Injection**: sempre parametrizar (`.input(name, sql.Type, value)`). Concatenação só aparece em nomes qualificados (`quoteIdentifier`).
- **Segredos**: `.env` módulo (`src/modules/inadimplencia/.env`) NUNCA comitado (está no `.gitignore`). `.env.example` também está ignorado.

---

## 5. Integrações Externas

| Sistema | Objetivo | Protocolo | Ponto de entrada |
| --- | --- | --- | --- |
| SQL Server (data warehouse JotaNunes) | Fonte de todas as leituras analíticas e transacionais | TDS (`mssql`) | `@/c:/api-inadimplencia/src/modules/inadimplencia/config/db.js` |
| TOTVS Fluig | Autenticação + execução de datasets (ponte para RM) | HTTP/JSON + cookie `j_security_check` | `@/c:/api-inadimplencia/src/modules/inadimplencia/services/fluigDataset.js` |
| TOTVS RM | Geração de relatório Ficha Financeira (PDF) | HTTP indireto (via datasets `ds_paramsRel`, `dsIntegraFacilRM`, `ds_paiFilho_controleDeAcessoRMreportsFluig`) | `@/c:/api-inadimplencia/src/modules/inadimplencia/services/rmReportService.js` |
| Frontend `jnc_inadimplencia` | Consumidor das rotas REST | HTTP/JSON | CORS habilitado |

### 5.1. Variáveis de ambiente relevantes

Carregadas em cascata: primeiro `c:/api-inadimplencia/.env`, depois `src/modules/inadimplencia/.env` (override). Todas prefixadas `INAD_` na origem e expostas sem prefixo no objeto `env`.

| Variável | Origem | Uso |
| --- | --- | --- |
| `INAD_PORT` | env | Porta do `server.js` (default 3001). |
| `INAD_CORS_ORIGIN` | env | Lista de origens aceitas (vírgula-separada). Default `*`. |
| `INAD_DB_USER`, `INAD_DB_PASSWORD`, `INAD_DB_SERVER`, `INAD_DB_DATABASE` | env | Conexão MSSQL. |
| `INAD_DB_PORT`, `INAD_DB_ENCRYPT`, `INAD_DB_TRUST_CERT` | env | Conexão MSSQL (opcional). |
| `INAD_FLUIG_URL`, `INAD_FLUIG_USER`, `INAD_FLUIG_PASSWORD` | env | Login Fluig. |
| `INAD_FLUIG_ALLOW_INSECURE` | env | `true` desliga verificação TLS (dev). |
| `INAD_RM_REPORT_ID`, `INAD_RM_REPORT_CODE`, `INAD_RM_REPORT_NAME` | env | Identificação da Ficha Financeira. |
| `INAD_RM_REPORT_COLIGADA`, `INAD_RM_PARAM_COLIGADA`, `INAD_RM_COLIGADA` | env | Coligadas usadas no relatório. |
| `INAD_RM_DEBUG` | env | `true` ativa logs detalhados do `rmReportService`. |

---

## 6. Rotas (catálogo)

Prefixo do módulo: **`/inadimplencia`** (quando montado via `app.js`) ou **`/`** (modo standalone legacy). Os exemplos abaixo usam o formato unificado.

### 6.1. `/inadimplencia/health` — health check

- `GET /health` → `{ status: 'ok' }`.

### 6.2. `/inadimplencia` (fato de inadimplência)

- `GET /` → lista todas as inadimplências com última `PROXIMA_ACAO`.
- `GET /cpf/:cpf` → filtra por CPF/CNPJ (aceita apenas dígitos).
- `GET /num-venda/:numVenda`
- `GET /responsavel/:nome` → inclui `RESPONSAVEL`, `RESPONSAVEL_COR_HEX` (via `VENDA_RESPONSAVEL` + `USUARIO`).
- `GET /cliente/:nomeCliente` → LIKE `%nome%`.

### 6.3. `/inadimplencia/proximas-acoes`

- `GET /` → distinct por `NUM_VENDA_FK` da última `PROXIMA_ACAO` de vendas com `INADIMPLENTE='SIM'`.
- `GET /:numVenda` → última ação daquela venda.
- `POST|PUT|DELETE` → `400 { error: 'Registro de PROXIMA_ACAO deve ser feito via /ocorrencias. Endpoint somente leitura.' }`. Mutations acontecem em `/ocorrencias`.

### 6.4. `/inadimplencia/ocorrencias`

- `GET /` → todas; datas/horas normalizadas em `formatarResposta`.
- `GET /num-venda/:numVenda`, `GET /protocolo/:protocolo`, `GET /:id` (GUID).
- `POST /` → valida `NUM_VENDA_FK` (existe em `DW.fat_analise_inadimplencia_v4`), `NOME_USUARIO_FK`, `DESCRICAO`, `STATUS_OCORRENCIA`, `DT_OCORRENCIA` (`YYYY-MM-DD`), `HORA_OCORRENCIA` (`HH:MM[:SS]`), opcional `PROXIMA_ACAO` (datetime) e `PROTOCOLO`. Aceita payload em camelCase ou UPPER_SNAKE. Retorna `201 { data }`.
- `PUT /:id` → mesmas regras.
- `DELETE /:id` → `204`.

### 6.5. `/inadimplencia/atendimentos`

- `GET /cpf/:cpf`, `/num-venda/:numVenda`, `/protocolo/:protocolo`, `/cliente/:nomeCliente`.
- `POST /` → cria atendimento com `PROTOCOLO` único do dia + snapshot JSON da venda + nome do responsável atual. Retorna `201 { data }`.

### 6.6. `/inadimplencia/usuarios`

- `GET /?userCode=xxx` (opcional) → lookup por `USER_CODE`.
- `GET /` → lista.
- `GET /:nome`, `PUT /:nome`, `DELETE /:nome`.
- `POST /` → **upsert idempotente** usado pelo frontend (`useGetUser` dispara isso no boot). Se já existe por `USER_CODE` ou por `NOME`, responde `200 { data, exists: true }` (eventualmente com update de `PERFIL`/`NOME`). Caso contrário cria (`201`). Default de `PERFIL`: `wffluig` → `admin`, demais → `operador`.

### 6.7. `/inadimplencia/responsaveis`

- `GET /`, `GET /:numVenda`, `POST /`, `PUT /:numVenda`, `DELETE /:numVenda` (upsert via MERGE).

### 6.8. `/inadimplencia/kanban-status`

- `GET /` → lista de posições.
- `POST /` → upsert pela chave (`NUM_VENDA_FK`, `PROXIMA_ACAO`). Aceita `status` em vários aliases (PT-BR/EN). `STATUS_DATA` é `YYYY-MM-DD`.

### 6.9. `/inadimplencia/dashboard` (25+ endpoints)

Todos retornam `{ data }`. Os principais:

- `GET /kpis` → totais (vendas, clientes, saldo, inadimplente, %).
- `GET /vendas-por-responsavel`, `/responsaveis`.
- `GET /inadimplencia-por-empreendimento`, `/clientes-por-empreendimento`.
- `GET /status-repasse`, `/blocos`, `/unidades`, `/usuarios-ativos`.
- `GET /ocorrencias-por-usuario`, `/ocorrencias-por-venda?limit=`, `/ocorrencias-por-dia`, `/ocorrencias-por-hora`, `/ocorrencias-por-dia-hora`, `/ocorrencias` (todas).
- `GET /proximas-acoes-por-dia`, `/acoes-definidas`, `/atendentes-proxima-acao`.
- `GET /aging`, `/aging-detalhes?faixa=0-30|31-90|91-180|180+`.
- `GET /parcelas-inadimplentes`, `/parcelas-detalhes?qtd=N|nao|null`.
- `GET /score-saldo`, `/score-saldo-detalhes?score=`.
- `GET /saldo-por-mes-vencimento`, `/perfil-risco-empreendimento`.

**Filtro de período (dataInicio/dataFim)**: 9 endpoints de ocorrências/atendimentos aceitam `?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` via querystring:
- `GET /ocorrencias?dataInicio=2026-01-01&dataFim=2026-04-22`
- `GET /ocorrencias-por-usuario?dataInicio=...&dataFim=...`
- `GET /ocorrencias-por-venda?dataInicio=...&dataFim=...`
- `GET /ocorrencias-por-dia?dataInicio=...&dataFim=...`
- `GET /ocorrencias-por-hora?dataInicio=...&dataFim=...`
- `GET /ocorrencias-por-dia-hora?dataInicio=...&dataFim=...`
- `GET /proximas-acoes-por-dia?dataInicio=...&dataFim=...`
- `GET /acoes-definidas?dataInicio=...&dataFim=...`
- `GET /atendentes-proxima-acao?dataInicio=...&dataFim=...`

Ausência de parâmetros = comportamento atual (total histórico). Presença parcial (apenas um dos dois) retorna `400`. Filtro aplicado em `OCORRENCIAS.DT_OCORRENCIA BETWEEN @dataInicio AND @dataFim`. Helper central: `helpers/dateRange.js`.

Parâmetros de segurança: `limit` é clamped a `1000` (`parseLimit`), `faixa` contra whitelist, `qtd` aceita `'nao'/'null'` para representar valor nulo.

### 6.10. `/inadimplencia/fiadores` — Associados/Fiadores da venda

Endpoints para consulta de fiadores/associados (cônjuge, cessionário, fiador) via view `DW.vw_fiadores_por_venda`.

- `GET /num-venda/:numVenda` → retorna `{ data: Fiador[] }` ordenado por `DATA_CADASTRO DESC, NOME ASC`. `404` se venda não existe ou não tem fiadores.
- `GET /cpf/:cpf` → busca fiadores por CPF do associado (dígitos apenas). Retorna `{ data: Fiador[] }`.

Campos de resposta: `NUM_VENDA`, `ID_ASSOCIADO`, `ID_RESERVA`, `ID_PESSOA`, `NOME`, `DOCUMENTO`, `DATA_CADASTRO`, `RENDA_FAMILIAR`, `TIPO_ASSOCIACAO`, `ENDERECO`.

### 6.11. `/inadimplencia/relatorios`

- `GET /ficha-financeira?numVenda=...&codColigada=&reportColigada=&reportId=` → retorna `{ url, numVenda, codColigada, reportColigada, reportId }` após o fluxo RM. Hoje é o **único** endpoint; o frontend também usa `POST /relatorios/ficha-financeira/` (opcional) em modo assíncrono — atualmente o backend responde `405/404`, o que faz o cliente cair automaticamente no fluxo síncrono.

### 6.12. Swagger

- `GET /inadimplencia/docs-json` (modo unificado) ou `GET /docs` (modo standalone legacy).
- Fonte: `swagger.js` (OpenAPI 3.0 manual). Mantido sincronizado com as rotas.
- Documenta endpoints `/fiadores/*` e query params `dataInicio`/`dataFim` nos 9 endpoints de ocorrências.

---

## 7. Pontos Críticos ("Gotchas")

1. **`server.js` monta o módulo duas vezes**: rotas aparecem em `/inadimplencia/*` e na raiz `/`. Se um cliente antigo acessar `/usuarios` ele funciona; se um cliente novo acessar `/inadimplencia/usuarios` também. **Nunca** duplicar manualmente o mount no `app.js` unificado.
2. **FK reflexiva de ocorrências**: `ocorrenciasModel` inspeciona `sys.foreign_keys` na primeira execução. Se a FK for removida do banco, a validação pré-insert é desabilitada silenciosamente. Em ambientes limpos, rodar os scripts em `docs/sql/*`.
3. **`DW.fat_analise_inadimplencia_v4`**: é uma **view/tabela do DW**, não transacional. Leituras podem ter latência de carga. Filtros de “inadimplente” são feitos via `UPPER(LTRIM(RTRIM(COALESCE(INADIMPLENTE,''))))='SIM'` (buildInadimplenteCondition). Alterar o schema quebra todos os endpoints `dashboard/*` e `inadimplenciaModel`.
4. **Pool compartilhado**: todos os models dividem a mesma `Promise` de pool. Uma query pesada pode saturar as 10 conexões. Evitar _long-running queries_ ou adicionar `max` via env.
5. **Sessão Fluig é cacheada em memória do processo** (10 min). Em modo cluster (PM2 com `instances > 1`), cada worker refaz login — aumenta carga no Fluig. Ajustar TTL/instância se necessário.
6. **Protocolo de atendimento é diário**: `AAAAMMDD#####`. Se houver mais de 99_999 atendimentos no dia, a sequência quebra. Hoje é seguro; vigiar.
7. **Snapshot da venda (JSON)**: alterações em `INADIMPLENCIA` não são refletidas em atendimentos já abertos (por design). Não “hidratar” com dados frescos sem revalidar requisitos de auditoria.
8. **`INADIMPLENTE='SIM'` é regra global** em quase todos os `dashboard/*` e `/proximas-acoes`. Mudar a definição de inadimplência precisa varrer todo o `dashboardModel.js`.
9. **Origin Guard x Integrações server-to-server**: requests sem `Origin` passam (considerados confiáveis). Se isso mudar (ex.: `fetch` node enviando Origin), revisar a whitelist.
10. **Formato de data/hora**: controller formata respostas em `YYYY-MM-DD` + `HH:MM:SS` (UTC-based). Clientes devem tratar como _local time_ do banco (America/Sao_Paulo). Não converter antes de gravar.
11. **`legacyApp` x módulo unificado**: Swagger do standalone (`/docs`) usa paths sem prefixo `/inadimplencia`. Quem abrir o Swagger unificado precisa escolher o spec `/docs-json/inadimplencia` no dropdown.
12. **`rmReportService` é custoso**: cada chamada envolve 2–3 chamadas a datasets Fluig + regex em XML. Em horários de pico, considerar cache curto por `numVenda`.
13. **Usuário sem perfil definido**: `usuarioController.create` assume `admin` se `USER_CODE === 'wffluig'`; caso contrário `operador`. Mudanças aqui afetam a UX do frontend (menu lateral esconde admin).
14. **`COR_HEX`**: se a UI mandar cor inválida sem `#`, a rota rejeita com `400 'COR_HEX invalida.'`. Frontend já normaliza.

---

## 8. Mapa de Navegação

| Responsabilidade | Caminho |
| --- | --- |
| Bootstrap de processo | `@/c:/api-inadimplencia/src/modules/inadimplencia/server.js` |
| Factory do módulo (montagem no app raiz) | `@/c:/api-inadimplencia/src/modules/inadimplencia/index.js` |
| App standalone (server.js) | `@/c:/api-inadimplencia/src/modules/inadimplencia/standaloneApp.js`, `legacyApp.js` |
| Rotas | `@/c:/api-inadimplencia/src/modules/inadimplencia/routes/*.js` |
| Controllers (validação + orquestração) | `@/c:/api-inadimplencia/src/modules/inadimplencia/controllers/*.js` |
| Models (SQL) | `@/c:/api-inadimplencia/src/modules/inadimplencia/models/*.js` |
| Integração Fluig | `@/c:/api-inadimplencia/src/modules/inadimplencia/services/fluigDataset.js` |
| Ficha Financeira RM | `@/c:/api-inadimplencia/src/modules/inadimplencia/services/rmReportService.js` |
| Tratamento de erro global | `@/c:/api-inadimplencia/src/modules/inadimplencia/middlewares/errorHandler.js` |
| Config de ambiente | `@/c:/api-inadimplencia/src/modules/inadimplencia/config/env.js` |
| Pool SQL | `@/c:/api-inadimplencia/src/modules/inadimplencia/config/db.js` |
| Swagger/OpenAPI | `@/c:/api-inadimplencia/src/modules/inadimplencia/swagger.js` |
| Scripts SQL (FKs, Fiadores) | `@/c:/api-inadimplencia/src/modules/inadimplencia/docs/sql/*.sql` (inclui `2026-04-22-fiadores-fat-associados.sql`) |
| Helpers | `@/c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js` (parseDateRange) |
| Utilitários compartilhados entre módulos | `@/c:/api-inadimplencia/src/shared/moduleEnv.js`, `@/c:/api-inadimplencia/src/shared/swaggerAccess.js` |
| PM2 | `@/c:/api-inadimplencia/src/modules/inadimplencia/ecosystem.config.js` |
| Composição raiz (app unificado) | `@/c:/api-inadimplencia/src/app.js` |

---

## 9. Checklist para novas mudanças

- [ ] Toda query SQL usa `pool.request().input(...)` com tipos (`sql.Int`, `sql.VarChar(n)`, `sql.UniqueIdentifier`, etc.).
- [ ] Novos endpoints recebem rota + controller + model separados. Controller não contém SQL.
- [ ] Payload aceito em camelCase e UPPER_SNAKE (compatibilidade com o frontend).
- [ ] Resposta padrão: `{ data }` para sucesso; `{ error }` para falha; `204` para deleções.
- [ ] Erros de domínio usam `err.statusCode` para pular o fallback 500.
- [ ] CORS atualizado em `INAD_CORS_ORIGIN` quando um novo consumidor entrar.
- [ ] Swagger (`swagger.js`) atualizado para cada nova rota (o frontend não depende, mas integradores usam).
- [ ] Filtros de inadimplência sempre passam por `buildInadimplenteCondition(alias)`.
- [ ] Mutations que envolvem `NUM_VENDA_FK` validam existência antes (ver `ocorrenciasController.validateReferencedNumVenda`).
- [ ] Transações apenas quando necessárias (geração de protocolo). Prefira `MERGE` para upserts.
- [ ] Integrações externas isoladas em `services/` e com timeouts/retries explícitos.
- [ ] Nunca logar `DB_PASSWORD`, `FLUIG_PASSWORD`, cookies Fluig ou conteúdo bruto de XML do RM fora do modo `RM_DEBUG=true`.
