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
