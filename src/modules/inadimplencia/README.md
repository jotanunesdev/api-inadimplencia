# Modulo Inadimplencia

API REST responsavel pela gestao da inadimplencia: consulta de carteira, ocorrencias, atendimentos, proximas acoes, atribuicao de responsaveis, Kanban, relatorios e dashboards analiticos.

Construida em Node.js + Express com conexao a SQL Server (`mssql`) e documentacao OpenAPI via `swagger-ui-express`. Pode ser executada de forma isolada (standalone) ou montada dentro da API unificada do repositorio.

## Stack

- Node.js 18+
- Express 4
- SQL Server (via `mssql`)
- Swagger UI (`swagger-ui-express`)
- CORS configuravel e guarda de origem compartilhada (`src/shared/swaggerAccess`)

## Estrutura

```text
src/modules/inadimplencia/
  config/
    db.js                 # pool mssql compartilhado
    env.js                # carregamento de .env (raiz + modulo) e normalizacao de CORS
  controllers/            # controllers por dominio
    atendimentosController.js
    dashboardController.js
    inadimplenciaController.js
    kanbanStatusController.js
    notificationsController.js
    ocorrenciasController.js
    proximaAcaoController.js
    relatoriosController.js
    responsavelController.js
    usuarioController.js
  middlewares/
    errorHandler.js
  models/                 # acesso a dados / queries SQL
    atendimentosModel.js
    dashboardModel.js
    inadimplenciaModel.js
    kanbanStatusModel.js
    notificationsModel.js
    ocorrenciasModel.js
    proximaAcaoModel.js
    responsavelModel.js
    usuarioModel.js
  routes/                 # rotas Express por dominio
    atendimentosRoutes.js
    dashboardRoutes.js
    inadimplenciaRoutes.js
    kanbanStatusRoutes.js
    notificationsRoutes.js
    ocorrenciasRoutes.js
    proximaAcaoRoutes.js
    relatoriosRoutes.js
    responsavelRoutes.js
    usuarioRoutes.js
  services/
    fluigDataset.js                       # integracao com datasets Fluig
    inadimplenciaNotificationRealtime.js  # SSE de notificacoes em tempo real
    responsavelAssignmentService.js       # regras de atribuicao de responsavel
    rmReportService.js                    # geracao de relatorios RM/Totvs
  ecosystem.config.js     # PM2
  index.js                # factory do modulo (router + openapi)
  legacyApp.js            # app Express standalone legado (com /docs)
  server.js               # bootstrap standalone
  standaloneApp.js        # compoe legacyApp com o novo modulo
  swagger.js              # especificacao OpenAPI 3.0
```

## Variaveis de ambiente

O modulo carrega, nesta ordem:

1. `.env` da raiz do repositorio
2. `.env` dentro de `src/modules/inadimplencia/`

Variaveis sem prefixo sao resolvidas via helper `resolvePrefixedEnv('INAD')` (em `src/shared/moduleEnv`), aceitando o prefixo `INAD_` como alternativa por variavel.

Banco de dados (obrigatorias):

```env
DB_USER=...
DB_PASSWORD=...
DB_SERVER=...
DB_DATABASE=...
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

Servidor e CORS:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173,https://fluig.jotanunes.com
```

- `CORS_ORIGIN` aceita lista separada por virgula; `*` libera geral.
- A falta de `DB_USER`, `DB_PASSWORD`, `DB_SERVER` ou `DB_DATABASE` lanca erro na primeira conexao (`config/db.js`).

## Como executar

Instalacao (na raiz do repositorio):

```bash
npm install
```

Modo standalone (apenas este modulo):

```bash
npm run dev:inadimplencia    # watch com tsx
npm run start:inadimplencia  # execucao simples
```

Via PM2 (producao):

```bash
pm2 start src/modules/inadimplencia/ecosystem.config.js
```

O servidor sobe em `http://localhost:<PORT>` (default `3001`).

Quando rodando em standalone (`standaloneApp.js`), as rotas ficam disponiveis em dois prefixos:

- `/` -> `legacyApp` (rotas originais + `/docs` e `/docs-json`)
- `/inadimplencia/*` -> novo modulo montado via `createInadimplenciaModule()`

Quando montado na API unificada do repositorio, o modulo exporta `{ router, openapi }` atraves de `createInadimplenciaModule()` para ser combinado ao agregador principal.

## Documentacao Swagger

Executando em standalone:

- `GET /docs` - Swagger UI
- `GET /docs-json` - especificacao OpenAPI (JSON)

A spec esta em `swagger.js` e cobre todos os grupos de endpoints listados abaixo.

## Endpoints

Base URL padrao em standalone: `http://localhost:3001`.

As rotas podem ser acessadas em dois formatos dependendo do ponto de montagem:

- Standalone legacy: `/<grupo>` (ex.: `/inadimplencia`, `/ocorrencias`, `/dashboard/kpis`)
- Novo modulo: `/inadimplencia/<grupo>` (ex.: `/inadimplencia/ocorrencias`, `/inadimplencia/dashboard/kpis`); o grupo `inadimplencia` fica na raiz do modulo (`/inadimplencia` e `/inadimplencia/cpf/:cpf`)

### Health

| Metodo | Rota       | Descricao                 |
| ------ | ---------- | ------------------------- |
| GET    | `/health`  | Health check do servico   |

### Inadimplencia

| Metodo | Rota                                 | Descricao                           |
| ------ | ------------------------------------ | ----------------------------------- |
| GET    | `/inadimplencia`                     | Lista todas as inadimplencias       |
| GET    | `/inadimplencia/cpf/:cpf`            | Busca por CPF                       |
| GET    | `/inadimplencia/num-venda/:numVenda` | Busca por numero de venda           |
| GET    | `/inadimplencia/responsavel/:nome`   | Busca por responsavel               |
| GET    | `/inadimplencia/cliente/:nomeCliente`| Busca por nome do cliente           |

### Proximas Acoes

| Metodo | Rota                        | Descricao                              |
| ------ | --------------------------- | -------------------------------------- |
| GET    | `/proximas-acoes`           | Lista proximas acoes                   |
| POST   | `/proximas-acoes`           | Cria proxima acao                      |
| GET    | `/proximas-acoes/:numVenda` | Busca proxima acao pelo numero de venda|
| PUT    | `/proximas-acoes/:numVenda` | Atualiza proxima acao                  |
| DELETE | `/proximas-acoes/:numVenda` | Remove proxima acao                    |

### Ocorrencias

| Metodo | Rota                                 | Descricao                        |
| ------ | ------------------------------------ | -------------------------------- |
| GET    | `/ocorrencias`                       | Lista ocorrencias                |
| POST   | `/ocorrencias`                       | Cria ocorrencia                  |
| GET    | `/ocorrencias/num-venda/:numVenda`   | Busca por numero da venda        |
| GET    | `/ocorrencias/protocolo/:protocolo`  | Busca por protocolo              |
| GET    | `/ocorrencias/:id`                   | Busca por ID                     |
| PUT    | `/ocorrencias/:id`                   | Atualiza por ID                  |
| DELETE | `/ocorrencias/:id`                   | Remove por ID                    |

### Atendimentos

| Metodo | Rota                                  | Descricao                     |
| ------ | ------------------------------------- | ----------------------------- |
| POST   | `/atendimentos`                       | Cria atendimento              |
| GET    | `/atendimentos/cpf/:cpf`              | Busca por CPF                 |
| GET    | `/atendimentos/num-venda/:numVenda`   | Busca por numero da venda     |
| GET    | `/atendimentos/protocolo/:protocolo`  | Busca por protocolo           |
| GET    | `/atendimentos/cliente/:nomeCliente`  | Busca por nome do cliente     |

### Usuarios

| Metodo | Rota                | Descricao               |
| ------ | ------------------- | ----------------------- |
| GET    | `/usuarios`         | Lista usuarios          |
| POST   | `/usuarios`         | Cria usuario            |
| GET    | `/usuarios/:nome`   | Busca por nome          |
| PUT    | `/usuarios/:nome`   | Atualiza por nome       |
| DELETE | `/usuarios/:nome`   | Remove por nome         |

### Responsaveis

| Metodo | Rota                        | Descricao                               |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `/responsaveis`             | Lista responsaveis                      |
| POST   | `/responsaveis`             | Atribui responsavel a uma venda         |
| GET    | `/responsaveis/:numVenda`   | Busca responsavel por numero de venda   |
| PUT    | `/responsaveis/:numVenda`   | Atualiza responsavel                    |
| DELETE | `/responsaveis/:numVenda`   | Remove responsavel                      |

Corpo de `POST /responsaveis`:

```json
{
  "numVenda": 12345,
  "nomeUsuario": "joao.silva",
  "adminUserCode": "wffluig"
}
```

Corpo de `PUT /responsaveis/:numVenda`:

```json
{
  "nomeUsuario": "maria.souza",
  "adminUserCode": "wffluig"
}
```

### Kanban Status

| Metodo | Rota              | Descricao                             |
| ------ | ----------------- | ------------------------------------- |
| GET    | `/kanban-status`  | Lista status do Kanban                |
| POST   | `/kanban-status`  | Cria ou atualiza status do Kanban     |

### Relatorios

| Metodo | Rota                            | Descricao                         |
| ------ | ------------------------------- | --------------------------------- |
| GET    | `/relatorios/ficha-financeira`  | Relatorio de ficha financeira (RM)|

### Notifications (SSE) - EM CONSTRUCAO

> **Status**: funcionalidade **em construcao**. Contrato e payload sujeitos a mudanca. Ha bugs conhecidos listados em [Notificacoes - detalhes](#notificacoes-detalhes).

| Metodo | Rota                     | Descricao                                                        |
| ------ | ------------------------ | ---------------------------------------------------------------- |
| GET    | `/notifications`         | Snapshot atual das notificacoes do usuario (`?username=<user>`)  |
| GET    | `/notifications/stream`  | Stream Server-Sent Events de notificacoes (`?username=<user>`)   |

### Dashboard

Todas as rotas sao `GET` e retornam agregacoes analiticas.

| Rota | Descricao |
| ---- | --------- |
| `/dashboard/kpis` | KPIs gerais |
| `/dashboard/vendas-por-responsavel` | Vendas agrupadas por responsavel |
| `/dashboard/inadimplencia-por-empreendimento` | Inadimplencia por empreendimento |
| `/dashboard/clientes-por-empreendimento` | Clientes por empreendimento |
| `/dashboard/status-repasse` | Status de repasse |
| `/dashboard/blocos` | Blocos |
| `/dashboard/unidades` | Unidades |
| `/dashboard/usuarios-ativos` | Usuarios ativos |
| `/dashboard/responsaveis` | Todos os responsaveis |
| `/dashboard/ocorrencias-por-usuario` | Ocorrencias por usuario |
| `/dashboard/ocorrencias-por-venda` | Ocorrencias por venda |
| `/dashboard/ocorrencias-por-dia` | Ocorrencias por dia |
| `/dashboard/ocorrencias-por-hora` | Ocorrencias por hora |
| `/dashboard/ocorrencias-por-dia-hora` | Ocorrencias por dia e hora |
| `/dashboard/ocorrencias` | Todas as ocorrencias |
| `/dashboard/proximas-acoes-por-dia` | Proximas acoes por dia |
| `/dashboard/acoes-definidas` | Acoes definidas |
| `/dashboard/aging` | Aging da carteira |
| `/dashboard/aging-detalhes` | Detalhes do aging |
| `/dashboard/parcelas-inadimplentes` | Parcelas inadimplentes |
| `/dashboard/parcelas-detalhes` | Detalhes de parcelas |
| `/dashboard/score-saldo` | Score saldo |
| `/dashboard/score-saldo-detalhes` | Detalhes do score saldo |
| `/dashboard/saldo-por-mes-vencimento` | Saldo por mes de vencimento |
| `/dashboard/perfil-risco-empreendimento` | Perfil de risco por empreendimento |
| `/dashboard/atendentes-proxima-acao` | Atendentes por proxima acao |

## Arquitetura

- **Camada de rotas (`routes/`)** - define endpoints Express e delega ao controller correspondente.
- **Camada de controllers (`controllers/`)** - orquestra entrada/saida HTTP, validacoes de request e tratamento de erros via `next(error)`.
- **Camada de models (`models/`)** - concentra as queries SQL e o uso do pool `mssql`.
- **Camada de services (`services/`)** - regras de negocio mais elaboradas e integracoes externas (Fluig, RM/Totvs, SSE de notificacoes).
- **Middlewares** - `errorHandler.js` centraliza a resposta de erros; `originGuard` valida origem via `isRequestAllowed` compartilhado em `src/shared/swaggerAccess`.
- **Factory `createInadimplenciaModule()`** - retorna `{ router, openapi }` para composicao com outras APIs do monorepo.

## Seguranca e CORS

- Todas as requisicoes passam por `cors(corsOptions)` + guarda de origem (`originGuard`).
- Origens nao permitidas recebem `403 { error: 'Origem nao permitida.' }`.
- Preflight `OPTIONS *` e tratado pelo CORS configurado.

## Erros

- 404 para rota nao encontrada dentro do modulo: `{ error: 'Endpoint nao encontrado' }`.
- Erros nao tratados caem no `errorHandler` da pasta `middlewares/`, que responde em JSON.

## Notificacoes - detalhes

> Secao dedicada a funcionalidade `/notifications`, que esta **em construcao**. Documenta o comportamento atual, contrato provisorio e bugs/lacunas conhecidos identificados no codigo.

### Visao geral

O recurso gera uma lista de "alertas" para um usuario (responsavel) com base em vendas inadimplentes cuja `PROXIMA_ACAO` no Kanban ja esta vencida. Componentes envolvidos:

- `routes/notificationsRoutes.js` - expoe `GET /` (snapshot) e `GET /stream` (SSE).
- `controllers/notificationsController.js` - valida `username` e delega para model (snapshot) ou service (SSE).
- `models/notificationsModel.js` - monta a query em SQL Server que correlaciona `DW.fat_analise_inadimplencia_v4`, `dbo.VENDA_RESPONSAVEL` e o ultimo registro de `dbo.KANBAN_STATUS` via `ROW_NUMBER()`.
- `services/inadimplenciaNotificationRealtime.js` - mantem um `Map<username, Set<res>>` em memoria com os clientes SSE conectados, envia snapshot inicial, heartbeat de 15s e re-broadcast por polling a cada 60s.

### Regra de negocio da query

Uma venda aparece na lista de notificacoes quando **todas** as condicoes sao verdadeiras:

1. A venda existe em `fat_analise_inadimplencia_v4` (carteira inadimplente).
2. Existe responsavel atribuido em `VENDA_RESPONSAVEL` cujo `NOME_USUARIO_FK` corresponde ao `username` da requisicao.
3. O registro mais recente de `KANBAN_STATUS` (ordenado por `DT_ATUALIZACAO` DESC, `PROXIMA_ACAO` DESC) possui:
   - `STATUS = 'todo'` (case-insensitive, com trim).
   - `PROXIMA_ACAO NOT NULL` e `CAST(PROXIMA_ACAO AS date) < CAST(GETDATE() AS date)` (acao vencida).

Ordenacao final: `PROXIMA_ACAO ASC, NUM_VENDA ASC`.

### Endpoints

#### `GET /notifications?username=<user>`

Retorna um snapshot sincrono.

- `400` se `username` nao informado: `{ "error": "username é obrigatório." }`.
- `200` com o payload abaixo.

Payload (provisorio):

```json
{
  "generatedAt": "2026-04-17T18:30:00.000Z",
  "username": "joao.silva",
  "notifications": [
    {
      "id": "sale-overdue-12345",
      "type": "sale_overdue",
      "tipo": "venda_inadimplente",
      "numVenda": 12345,
      "cliente": "Maria Silva",
      "cpfCnpj": "00000000000",
      "empreendimento": "EMP-001",
      "responsavel": "joao.silva",
      "proximaAcao": "2026-04-10T00:00:00.000Z",
      "status": "todo",
      "valorInadimplente": 1234.56,
      "createdAt": "2026-04-10T00:00:00.000Z",
      "lida": false
    }
  ],
  "unreadCount": 1
}
```

Observacoes sobre o contrato:

- `id` e deterministico por venda (`sale-overdue-<NUM_VENDA>`); nao e um identificador persistido de notificacao.
- `type` e `tipo` duplicam o mesmo dado em ingles e portugues (mantido por compatibilidade provisoria).
- `lida` sempre retorna `false`: **nao ha persistencia de leitura** (ver lacunas abaixo).
- `createdAt` reflete a data da `PROXIMA_ACAO`, nao a data de geracao do alerta.

#### `GET /notifications/stream?username=<user>`

Abre um canal **Server-Sent Events**.

- Headers setados: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- Envia snapshot inicial imediatamente ao conectar, com o evento nomeado:

```text
event: inadimplencia-notifications.snapshot
data: { ...payload igual ao do GET /notifications... }
```

- Heartbeat (comentario SSE) a cada 15s: `: ping\n\n`.
- Re-broadcast automatico do snapshot a cada 60s (polling interno por cliente).
- Ao `close` da conexao: intervalos sao limpos e o listener e removido do `Map` in-memory.

Nao ha autenticacao: o `username` vem por query string.

### Estado in-memory

- `listenersByUsername: Map<string, Set<Response>>` - chaveado pelo `username` recebido por query (sem normalizacao: `"Joao"` e `"joao"` viram buckets diferentes).
- Escala apenas em processo unico. Multiplas instancias PM2/cluster **nao** compartilham estado; clientes so recebem updates do proprio processo que os atende.
- Nao ha fonte de eventos externa: `broadcastInadimplenciaSnapshot` so e disparado pelos timers internos. Nao existe invalidacao por mutacao de dados (novas ocorrencias, mudanca de Kanban, atribuicao de responsavel etc. **nao** disparam broadcast).

### Lacunas e proximos passos

Funcionalidades **ainda nao implementadas**:

- Persistencia de estado de leitura (`lida`, `readAt`) - o model sempre devolve `lida: false`.
- Acao "marcar como lida" / "marcar todas" - nao ha endpoint `POST/PUT` para mutacao.
- Outros tipos de notificacao alem de `sale_overdue` (ex.: nova ocorrencia, responsavel atribuido, mudanca de status).
- Broadcast orientado a evento: hoje e 100% polling.
- Autenticacao/autorizacao: qualquer cliente consegue ler notificacoes de qualquer `username`.
- Filtros/paginacao no snapshot.
- Propagacao entre instancias (Redis Pub/Sub ou similar) quando houver mais de um processo.

### Bugs conhecidos

1. **`new Date.toISOString()` em `models/notificationsModel.js:96`** - sintaxe invalida; deveria ser `new Date().toISOString()`. Na pratica lanca `TypeError` toda vez que `/notifications` e chamado, o que tambem quebra o snapshot inicial do SSE. O endpoint so "funciona" se esse trecho for corrigido.
2. **Comparacao case-insensitive incompleta** - a query usa `LOWER(LTRIM(RTRIM(r.NOME_USUARIO_FK))) = @username`, mas o parametro `@username` e apenas `trim()`ado em `normalizeString` (sem `toLowerCase()`). Usuarios informados com maiuscula nao casam com valores minusculos do banco.
3. **Normalizacao duplicada** - `getInadimplenciaNotificationSnapshot` chama `normalizeString(username)` e em seguida `findOverdueSalesByUsername(normalizedString)`, que normaliza novamente. E idempotente, mas desnecessario.
4. **Chave do `Map` de listeners nao e normalizada** - `addListener(username, res)` usa o valor cru da query string. Uma conexao com `?username=Joao` e outra com `?username=joao` criam buckets distintos, embora a query SQL os trate como o mesmo usuario (apos o fix do bug 2).
5. **Ausencia de tratamento em `res.write`** - em `broadcastInadimplenciaSnapshot` e no heartbeat, se o socket falhar antes do evento `close`, a escrita pode lancar e derrubar o timer/loop do broadcast.
6. **Polling por cliente, nao por usuario** - cada conexao SSE cria seu proprio `setInterval` de 60s; N conexoes do mesmo `username` executam N queries iguais. O ideal e um unico timer por bucket.
7. **Swagger generico** - em `swagger.js` as rotas `/notifications` e `/notifications/stream` nao estao documentadas (apenas os demais grupos); o README cobre temporariamente essa lacuna.
8. **Comentarios desatualizados no controller** - `notificationsController.js` menciona `GET /notificacoes/inadimplencia` e `GET /notificacoes/inadimplencia/stream`, mas a rota real montada e `/notifications` (ou `/inadimplencia/notifications` via `standaloneApp.js`).
