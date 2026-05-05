# Tech Spec: Módulo `inadimplencia` — Sistema de Notificações

## 1. Visão Geral

O módulo `inadimplencia` é um serviço backend Node.js/Express que gerencia o ciclo de vida de vendas inadimplentes: atribuição de responsáveis, registro de ocorrências, kanban de status e notificações em tempo real. É executado como um processo autônomo (`server.js` próprio) dentro de um monorepo multi-módulo.

O subsistema de **notificações** é o componente mais crítico e recente. Ele persiste notificações em banco (SQL Server), evita duplicatas por chave de dedupe, e as transmite em tempo real via **Server-Sent Events (SSE)**. Existem dois tipos de notificação: vendas atrasadas (`VENDA_ATRASADA`), geradas automaticamente por um scanner periódico, e atribuições de responsável (`VENDA_ATRIBUIDA`), disparadas por ação administrativa.

---

## 2. Stack Tecnológico

| Item | Detalhe |
|---|---|
| **Core** | Node.js + Express.js 4.x — arquivos `.js` (CommonJS) com runner `tsx` |
| **Build/Package** | NPM + `tsx` (transpilação on-the-fly); `tsc` gera `dist/` para produção |
| **Banco de Dados** | SQL Server via `mssql` ^10.0.2 (pool gerenciado em `config/db.js`) |
| **Interface** | REST (JSON) + SSE para push de notificações em tempo real |
| **Processo** | PM2 (`ecosystem.config.js`) para deploy de produção |
| **Testes** | Jest ^30 — testes unitários com mocks manuais (sem jest.mock automático) |
| **Dependências Chave** | `nodemailer` (e-mail), `axios` (HTTP externo), `dotenv` (configuração), `cors` |

---

## 3. Arquitetura e Padrões

### 3.1. Padrões Predominantes

| Camada / Diretório | Padrão | Responsabilidade |
|---|---|---|
| `routes/` | Router Express | Mapeamento de URI → handler; sem lógica |
| `controllers/` | Controller MVC | Parse de req/res, delegação ao service, next(err) |
| `services/` | Service Layer | Regras de negócio, orquestração, DTOs |
| `models/` | Repository + Query Model | Acesso direto ao banco via `mssql`; sem ORM |
| `middlewares/errorHandler.js` | Global Error Handler Express | Converte `err.statusCode` → resposta JSON padronizada |
| `config/env.js` | Config Module | Resolução de env vars com prefixo `INAD_*` |

O fluxo canônico é: `routes → controller → service → repository/model → SQL Server`.

### 3.2. Subsistema de Notificações — Componentes Centrais

```
overdueScanner          → tick() periódico (default 60s)
    └─ notificationsModel.findAllOverdue()    [SELECT no DW + kanban]
    └─ notificationService.createOverdueNotification()
           └─ notificationsRepository.findByDedupeKey()   [SELECT-before-INSERT]
           └─ notificationsRepository.insert()
           └─ sseHub.emitNew(username, dto)               [broadcast SSE]

responsavelAssignmentService.assignResponsavel()
    └─ notificationService.createAssignmentNotification()
           └─ notificationsRepository.insert()
           └─ sseHub.emitNew(username, dto)

sseHub.register(username, res)
    └─ SSE headers + flushHeaders()
    └─ notificationService.getSnapshotForUser()   [snapshot inicial]
    └─ heartbeat setInterval 15s
    └─ cleanup em res.on('close')
```

### 3.3. Padrões de Design Não-Óbvios

- **Persist-then-Broadcast**: a notificação é sempre gravada no banco _antes_ de ser emitida via SSE. Falha de broadcast não reverte a persistência.
- **Mutex in-memory (dedupeMutex)**: `Set` em memória de `dedupeKey` serializa chamadas concorrentes no mesmo processo para `VENDA_ATRASADA`. Não funciona em múltiplos workers PM2.
- **Re-entrancy guard** no `overdueScanner`: flag `isRunning` impede ticks sobrepostos se o processamento demorar mais que o intervalo.
- **Soft-delete**: registros em `dbo.INAD_NOTIFICACOES` nunca são deletados fisicamente — `DT_EXCLUSAO IS NULL` filtra os ativos. Deleção exige que `LIDA = 1`.
- **Arquivo legado**: `inadimplenciaNotificationRealtime.js` implementa SSE por **polling** (60s) com snapshot calculado on-the-fly. **Não usar** — substituído pelo `sseHub` + `overdueScanner`.

---

## 4. Design de Código e Convenções

### 4.1. Nomenclatura

| Artefato | Padrão |
|---|---|
| **Arquivos** | `camelCase.js` (ex: `notificationService.js`, `notificationsRepository.js`) |
| **Funções exportadas** | `camelCase` verbais (ex: `createOverdueNotification`, `markAllAsRead`) |
| **Testes** | mesmo nome do arquivo + `.test.js` (ex: `notificationsRepository.test.js`) |
| **Colunas SQL → DTO** | Transformação explícita via `mapRowToDTO()` no service; colunas em `UPPER_SNAKE`, DTO em `camelCase` |
| **Tipos de notificação** | Constantes string: `'VENDA_ATRASADA'` e `'VENDA_ATRIBUIDA'` (sem enum/objeto centralizado) |

### 4.2. Tratamento de Erros

- Erros de negócio são criados com `buildError(message, statusCode)` — uma função utilitária local que adiciona `err.statusCode` ao objeto `Error`.
- Controllers sempre delegam via `next(err)` — nunca tratam exceções diretamente.
- `errorHandler.js` centraliza a resposta: `{ error: message }` com o status HTTP do `err.statusCode`.
- Erros 4xx (ex: 404, 409) **não** são logados; erros 5xx (`>= 500`) são logados via `console.error`.
- O service `responsavelAssignmentService` captura falhas de notificação e **não propaga** — a atribuição não pode ser bloqueada por falha de notificação.

### 4.3. DTO Pattern

`mapRowToDTO(row)` centraliza no `notificationService` a conversão do recordset SQL para o formato de API. O campo `PAYLOAD` é armazenado como JSON string no banco e parseado na leitura. O campo `ORIGEM_USUARIO` (coluna) é exposto como `adminUserCode` no DTO.

### 4.4. Normalização de Username

`normalizeUsername(value)` (`.trim().toLowerCase()`) é replicada em múltiplos arquivos (service, hub, repository). Esta é uma duplicação intencional de baixo risco — cada arquivo é independente.

---

## 5. Banco de Dados

### Tabela Principal: `dbo.INAD_NOTIFICACOES`

| Coluna | Tipo | Notas |
|---|---|---|
| `ID` | UniqueIdentifier (PK) | GUID gerado pelo SQL Server |
| `TIPO` | VarChar(32) | `'VENDA_ATRASADA'` \| `'VENDA_ATRIBUIDA'` |
| `USUARIO_DESTINATARIO` | VarChar(255) | Username normalizado (lowercase) |
| `ORIGEM_USUARIO` | VarChar(255) | Admin que originou (nullable — nulo para VENDA_ATRASADA) |
| `NUM_VENDA` | Int | Chave do negócio |
| `PROXIMA_ACAO` | DateTime | Data da próxima ação (dedupe granularidade dia) |
| `PAYLOAD` | NVarChar(MAX) | JSON com snapshot da venda no momento da notificação |
| `LIDA` | bit | 0 = não lida, 1 = lida |
| `DT_CRIACAO` | DateTime | Gerado pelo banco |
| `DT_LEITURA` | DateTime | Nullable |
| `DT_EXCLUSAO` | DateTime | Soft-delete (nullable) |

**Dedupe VENDA_ATRASADA**: `TIPO + USUARIO_DESTINATARIO + NUM_VENDA + CAST(PROXIMA_ACAO AS date)` — uma notificação por venda por dia.

### Tabelas de Consulta (somente leitura para notificações)

| Tabela | Uso |
|---|---|
| `DW.fat_analise_inadimplencia_v4` | Dados das vendas inadimplentes |
| `dbo.VENDA_RESPONSAVEL` | Responsável atual por venda |
| `dbo.KANBAN_STATUS` | Status e data da próxima ação (último por venda+usuário via ROW_NUMBER) |

---

## 6. Integrações Externas

| Sistema | Objetivo | Protocolo |
|---|---|---|
| **SQL Server** | Persistência de notificações + consulta de vendas/responsáveis | TCP via `mssql` connection pool |
| **Fluig** (via `fluigDataset.js`) | Consulta de datasets corporativos (atendimentos, usuários) | REST/HTTP via `axios` |
| **LDAP** | Autenticação de usuários (módulo `auth`) | LDAP via `ldapjs` |

---

## 7. Configuração

Resolvida em `config/env.js` via `resolvePrefixedEnv('INAD')` — lê variáveis prefixadas `INAD_*` do `.env` raiz ou do `.env` local do módulo.

| Variável | Padrão | Descrição |
|---|---|---|
| `INAD_NOTIFICATIONS_OVERDUE_SCAN_MS` | `60000` | Intervalo do scanner em ms (mínimo: 15000) |
| `INAD_CORS_ORIGIN` | `*` | Origins permitidas (CSV) |
| `INAD_DB_*` | — | Credenciais do SQL Server |

O `overdueScanner` **não inicia** quando `NODE_ENV === 'test'`.

---

## 8. Pontos Críticos ("Gotchas")

1. **Mutex de dedupe é in-process**: Em clusters PM2 com múltiplos workers, o `dedupeMutex` não é compartilhado. A proteção de duplicata recai inteiramente sobre a constraint de negócio no banco (`findByDedupeKey`).

2. **SSE + Proxy Nginx**: O header `X-Accel-Buffering: no` desabilita buffering no Nginx. Sem ele, eventos SSE chegam ao cliente em batch, quebrando o tempo real.

3. **`softDelete` exige `LIDA = 1`**: Tentar deletar uma notificação não lida retorna HTTP 409. Este é comportamento intencional de produto.

4. **`inadimplenciaNotificationRealtime.js` é legado**: Ainda exportado, mas **não deve ser usado** em novas features. O `sseHub.js` + `notificationService.js` é o sistema ativo.


5. **Testes não fazem mock de `mssql`**: Os testes unitários mockam a camada de repository/model manualmente via `jest.fn()`. Não há `__mocks__` automático. Sempre mockar a dependência mais próxima do SUT.

---

## 9. Mapa de Navegação

| O que procuro | Onde encontro |
|---|---|
| **Ponto de entrada do módulo** | `src/modules/inadimplencia/index.js` |
| **Rotas HTTP** | `src/modules/inadimplencia/routes/` |
| **Regras de negócio de notificações** | `src/modules/inadimplencia/services/notificationService.js` |
| **Scanner de vendas atrasadas** | `src/modules/inadimplencia/services/overdueScanner.js` |
| **Hub SSE (conexões em tempo real)** | `src/modules/inadimplencia/services/sseHub.js` |
| **Atribuição de responsável** | `src/modules/inadimplencia/services/responsavelAssignmentService.js` |
| **Persistência de notificações** | `src/modules/inadimplencia/models/notificationsRepository.js` |
| **Query de vendas inadimplentes** | `src/modules/inadimplencia/models/notificationsModel.js` |
| **Schema da tabela de notificações** | Seção 5 deste documento |
| **Configuração de ambiente** | `src/modules/inadimplencia/config/env.js` |
| **Swagger/OpenAPI** | `src/modules/inadimplencia/swagger.js` |

---

## 10. Fluxo Completo — Ciclo de Vida de uma Notificação

```
[Produção]
overdueScanner.tick()
  → notificationsModel.findAllOverdue()          [SELECT em DW + kanban]
  → para cada venda com RESPONSAVEL:
      notificationService.createOverdueNotification()
        → dedupeMutex.has(key)?  → skip
        → notificationsRepository.findByDedupeKey()  → existe? → skip (deduped)
        → notificationsRepository.insert()            → persiste no banco
        → mapRowToDTO(row)                            → converte para DTO
        → sseHub.emitNew(username, dto)               → push SSE ao cliente

[Cliente conecta]
GET /notifications/stream?username=joao
  → sseHub.register('joao', res)
      → headers SSE + flushHeaders()
      → notificationService.getSnapshotForUser('joao')  → 20 não lidas do banco
      → res.write(snapshot)                              → evento 'snapshot'
      → heartbeat 15s

[Cliente lê notificação]
PUT /notifications/:id/read?username=joao
  → notificationService.markAsRead()
      → notificationsRepository.markRead(id, username)
      → sseHub.emitUpdate(username, dto)   → push SSE com notificação atualizada

[Cliente deleta]
DELETE /notifications/:id?username=joao
  → notificationService.softDelete()
      → notificationsRepository.softDelete()  → UPDATE SET DT_EXCLUSAO (requer LIDA=1)
      → sseHub.emitUpdate(username, dto)
```
