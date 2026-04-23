# Especificação Técnica: Correção de Bugs Críticos - Módulo Treinamento

## Resumo Executivo

Esta Tech Spec documenta a correção de 6 bugs críticos no módulo Treinamento da API Inadimplência. As correções focam em: (1) implementar um mecanismo de lock/singleton para evitar race conditions no cache de token SharePoint, (2) adicionar tratamento seguro de JSON.parse com try-catch, (3) garantir cleanup robusto de arquivos temporários mesmo em caso de falha, (4) implementar resiliência no pool de conexões MSSQL com retry e health check, (5) adicionar observabilidade para erros silenciados no SharePoint, e (6) corrigir o tratamento de range requests para streaming de vídeos. A arquitetura prioriza minimalismo, mantendo as interfaces existentes e utilizando padrões de locking em memória e retry exponencial.

## Arquitetura do Sistema

### Visão Geral dos Componentes

| Componente | Responsabilidade | Ação |
|------------|-----------------|------|
| **TokenCache** (sharePointService.ts) | Gerenciar token de acesso SharePoint com deduplicação de refresh | Criar promise singleton para refresh |
| **JSON Parser** (collectiveProofToken.ts) | Parsing seguro de tokens coletivos | Adicionar try-catch com validação de schema |
| **File Cleanup** (turmaController.ts) | Limpeza de arquivos temporários de upload | Capturar estado inicial, cleanup em finally |
| **Connection Pool** (db.ts) | Gerenciar pool de conexões MSSQL resiliente | Implementar retry com backoff, health check |
| **Error Logger** (authController.ts) | Observabilidade de falhas SharePoint | Adicionar logging estruturado |
| **Video Streaming** (routes/index.ts) | Suporte a range requests HTTP 206 | Adicionar middleware de streaming com headers corretos |

**Fluxo de dados crítico:**
```
Upload Evidência → sharePointService (token cache lock) → SharePoint API
                    ↓
              authController (log permissão)
                    ↓
         turmaController (cleanup arquivos)
```

## Design de Implementação

### Interfaces Principais

```typescript
// Token Cache com Lock (sharePointService.ts)
type TokenCache = {
  value: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null
let refreshPromise: Promise<string> | null = null  // NOVO: promise singleton

export async function getAccessToken(): Promise<string>

// Pool de Conexões Resiliente (db.ts)
type PoolMetrics = {
  connected: boolean
  activeConnections: number
  idleConnections: number
}

export function getPool(): Promise<sql.ConnectionPool>
export function resetPool(): void  // NOVO: permitir retry
export async function healthCheckPool(): Promise<PoolMetrics>  // NOVO

// Video Streaming Range Request (middleware)
interface RangeRequest {
  start: number
  end: number
  total: number
}

export function handleVideoRangeRequest(
  req: Request, 
  res: Response, 
  filePath: string
): Promise<void>
```

### Modelos de Dados

```typescript
// Resposta padronizada para erros de parsing (collectiveProofToken.ts)
type TokenParseError = {
  code: 'TOKEN_MALFORMED' | 'TOKEN_EXPIRED' | 'SIGNATURE_INVALID'
  message: string
  timestamp: string
}

// Métricas de pool para observabilidade (db.ts)
type PoolMetrics = {
  connected: boolean
  activeConnections: number
  idleConnections: number
  waitingRequests: number
}

// Log estruturado para falhas SharePoint (authController.ts)
type SharePointPermissionLog = {
  level: 'WARN'
  event: 'SHAREPOINT_PERMISSION_GRANT_FAILED'
  user: string
  email: string
  timestamp: string
  error: string
}
```

### Endpoints de API

| Método | Endpoint | Descrição | Alteração |
|--------|----------|-----------|-----------|
| `POST` | `/api/treinamento/turmas/:turmaId/evidencias` | Upload de evidências | Cleanup robusto, estado inicial capturado |
| `POST` | `/api/treinamento/auth/login` | Login de usuário | Logging de falha SharePoint |
| `POST` | `/api/treinamento/auth/primeiro-acesso` | Primeiro acesso | Logging de falha SharePoint |
| `GET` | `/api/treinamento/videos/:id/stream` | Streaming de vídeo | Suporte a Range Requests (206) |
| `GET` | `/api/treinamento/health/db` | Health check do pool | NOVO: métricas de conexão |

## Pontos de Integração

### Microsoft Graph API (SharePoint)

- **Autenticação:** Token OAuth2 client_credentials
- **Rate Limiting:** Respeitar headers `Retry-After` (já implementado no retry de chunks)
- **Caching:** Implementar promise singleton para evitar múltiplos refresh simultâneos
- **Timeout:** 5 minutos por chunk de upload (já existente)

### MSSQL Database

- **Pool Configuration:**
  - Max connections: 50 (baseado em métricas de sucesso)
  - Connection timeout: 30s (configurável via env)
  - Retry: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Health Check:** Query simples `SELECT 1` antes de retornar conexão

## Abordagem de Testes

### Testes Unidade

| Componente | Cenários Críticos |
|------------|-------------------|
| TokenCache | 100+ requisições simultâneas → apenas 1 refresh |
| JSON Parser | Payload malformado, expirado, assinatura inválida |
| File Cleanup | Falha simulada no meio do upload → arquivos limpos |
| ConnectionPool | Falha inicial → retry bem-sucedido, métricas corretas |
| RangeRequest | Range válido (206), range inválido (416), sem range (200) |

### Testes de Integração

- Upload de evidência grande (50MB+) com falha simulada no SharePoint
- Autenticação com email inválido → verificar log de warning
- Streaming de vídeo com seeking (range requests sequenciais)
- Carga: 100 usuários simultâneos acessando vídeos

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Connection Pool Resilience (F4)** - Fundamento para todos os outros testes
2. **Token Cache Lock (F1)** - Resolve race condition que afeta uploads
3. **JSON Parser Safe (F2)** - Tratamento de erro rápido, alto impacto
4. **File Cleanup Robust (F3)** - Dependente de uploads funcionando
5. **Error Observability (F5)** - Logging pode ser adicionado paralelamente
6. **Video Streaming 206 (F6)** - Requer investigação adicional do endpoint

### Dependências Técnicas

- **Bloqueante:** Configuração de variáveis de ambiente para pool (DB_CONNECTION_TIMEOUT_MS)
- **Paralelo:** Implementação de logging não bloqueia outras correções
- **Risco:** Endpoint de streaming de vídeo precisa ser identificado antes da F6

## Monitoramento e Observabilidade

### Métricas Prometheus

```
# Cache de Token
sharepoint_token_refresh_total{status="success|error"}
sharepoint_token_refresh_concurrent_deduplicated_total

# Pool de Conexões
mssql_pool_connections{state="active|idle|waiting"}
mssql_pool_acquire_duration_seconds
mssql_pool_errors_total{type="connection|timeout"}

# Uploads
upload_cleanup_failures_total
upload_temp_files_removed_total

# Permissões SharePoint
sharepoint_permission_grant_failures_total

# Streaming
video_streaming_range_requests_total
video_streaming_errors_total{code="304|416|etc"}
```

### Logs Estruturados

```json
{
  "level": "WARN",
  "event": "SHAREPOINT_PERMISSION_GRANT_FAILED",
  "user": "12345678901",
  "email": "user@example.com",
  "timestamp": "2026-04-17T10:30:00Z",
  "error": "Request failed with status 403"
}
```

## Considerações Técnicas

### Decisões Principais

| Decisão | Justificativa | Alternativas Rejeitadas |
|---------|---------------|------------------------|
| Promise singleton para token cache | Simples, sem dependências externas | Mutex libraries (async-mutex, semaphore) - adicionam complexidade desnecessária |
| Retry exponencial no pool | Padrão industry-standard, permite recuperação | Retry linear - menos eficiente, Fixed delay - não adaptativo |
| Capturar estado SharePoint no início | Determinístico, evita race condition | Verificar estado no cleanup - causa bug atual |
| Log WARN para permissões SharePoint | Não bloqueia login, alerta DevOps | Log ERROR - muito alarmista, Silenciar - perde observabilidade |

### Riscos Conhecidos

| Risco | Mitigação |
|-------|-----------|
| Promise singleton pode ficar stale em erro | Resetar refreshPromise no catch do getAccessToken |
| Pool retry pode causar cascade failure | Limitar retries a 3, aumentar timeout gradualmente |
| Video streaming endpoint não identificado | Adicionar middleware genérico ou investigar CDN/SharePoint |
| Testes de carga requerem ambiente específico | Documentar requisitos, usar k6 ou artillery local |

### Conformidade com Padrões

- **Padrão do projeto:** Node.js + TypeScript + Express, mssql para SQL Server
- **Convenções:** Async/await, throw HttpError para erros HTTP, logging via console estruturado
- **ESLint:** Manter regras existentes, não adicionar novas dependências

## Arquivos Relevantes e Dependentes

| Arquivo | Linhas Afetadas | Tipo de Mudança |
|---------|-----------------|-----------------|
| `src/modules/treinamento/services/sharePointService.ts` | 57-172 | Adicionar refreshPromise singleton |
| `src/modules/treinamento/utils/collectiveProofToken.ts` | 75-76 | Adicionar try-catch em JSON.parse |
| `src/modules/treinamento/controllers/turmaController.ts` | 191-268 | Capturar useSharePoint no início, cleanup robusto |
| `src/modules/treinamento/config/db.ts` | 17-25 | Implementar retry, health check, métricas |
| `src/modules/treinamento/controllers/authController.ts` | 31-36 | Adicionar logging estruturado em tryGrantSharePointPermission |
| `src/modules/treinamento/controllers/sectorFolderController.ts` | 3451+ | Novo endpoint `/items/:itemId/stream` com range request support |
| `src/modules/treinamento/routes/sectorFolderRoutes.ts` | - | Nova rota `GET /items/:itemId/stream` |
| `src/modules/treinamento/services/sharePointService.ts` | - | Nova função `downloadSharePointFileRange()` para proxy de ranges |

---

## Correção Específica - Bug F6 (Streaming de Vídeos)

### Causa Raiz Identificada

O erro 304 ocorre no endpoint `/sector-file-manager/items/:itemId/content` (`getItemContent` - linha 3451 do `sectorFolderController.ts`). O problema:

1. **Download completo para buffer:** `downloadSharePointFileContentByItemId()` carrega todo o arquivo em memória
2. **Sem range request support:** O endpoint retorna sempre o arquivo completo via `res.send(buffer)`
3. **Headers de cache inadequados:** Apenas `Cache-Control: private, max-age=300`, sem `ETag` ou `Last-Modified`
4. **Sem `Accept-Ranges`:** O player não sabe que pode fazer requisições parciais

### Solução Técnica

Criar novo endpoint `/items/:itemId/stream` específico para vídeos:

```typescript
// sectorFolderController.ts - Nova função
export const streamItemContent = asyncHandler(async (req: Request, res: Response) => {
  ensureSharePointIsAvailable()
  
  const requestedSector = parseSectorFromQuery(req)
  const sourceSector = parseOptionalSector(req.query.sourceSector)
  const sharedRootItemId = parseParentItemId(req.query.sharedRootItemId)
  const itemId = String(req.params.itemId ?? "").trim()
  
  if (!itemId) {
    throw new HttpError(400, "Informe o arquivo a ser streamado.")
  }
  
  const { item } = await resolveFilePreviewContext({
    requestedSector,
    itemId,
    sourceSector,
    sharedRootItemId,
  })
  
  // Validação: apenas arquivos de vídeo
  const isVideo = item.name?.match(/\.(mp4|mov|avi|mkv|webm|wmv|m4v)$/i)
  if (!isVideo) {
    throw new HttpError(400, "Este endpoint suporta apenas arquivos de vídeo.")
  }
  
  // Headers de cache condicional
  const etag = `"${item.id}-${item.lastModifiedDateTime}"`
  const lastModified = new Date(item.lastModifiedDateTime).toUTCString()
  
  // Verificar If-None-Match
  const ifNoneMatch = req.headers['if-none-match']
  if (ifNoneMatch === etag) {
    return res.status(304).set({
      'ETag': etag,
      'Last-Modified': lastModified,
      'Cache-Control': 'private, max-age=300'
    }).end()
  }
  
  // Verificar Range
  const range = req.headers.range
  if (range) {
    // Proxy range request para SharePoint
    const { data, contentRange, status } = await downloadSharePointFileRange({
      itemId: item.id,
      range,
    })
    
    res.status(status)
      .set({
        'Content-Type': item.file?.mimeType || 'video/mp4',
        'Content-Range': contentRange,
        'Content-Length': data.length,
        'Accept-Ranges': 'bytes',
        'ETag': etag,
        'Last-Modified': lastModified,
        'Cache-Control': 'private, max-age=300'
      })
      .send(data)
  } else {
    // Sem range - retornar 200 com Accept-Ranges
    const buffer = await downloadSharePointFileContentByItemId({ itemId: item.id })
    
    res.status(200)
      .set({
        'Content-Type': item.file?.mimeType || 'video/mp4',
        'Content-Length': buffer.length,
        'Accept-Ranges': 'bytes',
        'ETag': etag,
        'Last-Modified': lastModified,
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`
      })
      .send(buffer)
  }
})
```

### Nova Rota

```typescript
// sectorFolderRoutes.ts
router.get("/items/:itemId/stream", streamItemContent)  // NOVO
router.get("/items/:itemId/content", getItemContent)    // EXISTENTE (para PDFs/imagens)
```

### Alteração em sharePointService.ts

```typescript
// Nova função para proxy de range requests
export async function downloadSharePointFileRange(params: {
  itemId: string
  range: string  // "bytes=start-end"
}): Promise<{
  data: Buffer
  contentRange: string
  status: 206 | 416
}> {
  const token = await getAccessToken()
  const { driveId } = await getDriveContext()
  
  // Parse range
  const match = params.range.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    throw new Error("Range inválido")
  }
  
  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : undefined
  
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${params.itemId}/content`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Range': params.range
      }
    }
  )
  
  if (response.status === 416) {
    // Range Not Satisfiable
    return {
      data: Buffer.alloc(0),
      contentRange: 'bytes */0',
      status: 416
    }
  }
  
  const arrayBuffer = await response.arrayBuffer()
  const contentRange = response.headers.get('content-range') || ''
  
  return {
    data: Buffer.from(arrayBuffer),
    contentRange,
    status: 206
  }
}
```

### Checklist de Implementação F6

- [ ] Implementar `downloadSharePointFileRange()` em `sharePointService.ts`
- [ ] Criar função `streamItemContent()` em `sectorFolderController.ts`
- [ ] Adicionar rota `/items/:itemId/stream` em `sectorFolderRoutes.ts`
- [ ] Atualizar frontend para usar `/stream` para vídeos e `/content` para outros arquivos
- [ ] Testar seeking em vídeos MP4
- [ ] Verificar resposta 304 em requisições condicionais

---

**Próximo passo:** Após aprovação da Tech Spec, criar tasks individuais para cada bug (B1-B6) seguindo a ordem de prioridade definida.
