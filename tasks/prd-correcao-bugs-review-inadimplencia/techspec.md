# Tech Spec — Correção de Bugs do Code Review (Inadimplência Front-End)

## Resumo Executivo

Esta Tech Spec define a abordagem de implementação para corrigir 4 defeitos identificados no code review do front-end do módulo de Inadimplência. As correções são cirúrgicas e isoladas: (1) eliminação de stale closure via `useRef`, (2) correção de string com dupla codificação UTF-8, (3) substituição do cache ilimitado por um cache LRU com TTL, e (4) implementação de reconexão automática com backoff exponencial no `EventSource` de notificações SSE. Nenhuma alteração de API back-end, dependência nova ou refatoração estrutural é necessária.

## Arquitetura do Sistema

### Visão Geral dos Componentes

- **`InteractiveCalendar.tsx`** — Componente principal do calendário interativo. Será modificado em 3 pontos:
  - **`handleConfirmStartAttendance`** (linha ~1006): callback com stale closure → fix via `useRef`
  - **`setClientDetailError`** (linha ~1508): string corrompida → correção literal
  - **`clientCache` + `fetchClienteByNumVenda`** (linhas ~87-104): cache ilimitado → cache LRU com TTL

- **`Notifications.tsx`** — Componente de notificações em tempo real. Será modificado em 1 ponto:
  - **`useEffect` de SSE** (linhas ~54-78): sem reconexão → reconexão com backoff exponencial

### Fluxo de Dados

Nenhum fluxo de dados novo é introduzido. As correções mantêm os contratos existentes:
- F1: O callback continua invocando `handleStartAttendance` e verificando `isClientAdimplente`, agora com valores atualizados via ref
- F3: `fetchClienteByNumVenda` mantém a mesma assinatura — a mudança é interna ao mecanismo de cache
- F4: O `EventSource` continua consumindo o mesmo endpoint SSE, apenas com resiliência a falhas de conexão

## Design de Implementação

### F1 — Stale Closure: `useRef` para `handleStartAttendance`

**Estratégia**: Usar um `useRef` que sempre aponta para a versão mais recente de `handleStartAttendance`, e adicionar `isClientAdimplente` ao array de dependências do `useCallback`.

```tsx
// Novo ref — declarar próximo aos outros refs do componente
const handleStartAttendanceRef = useRef(handleStartAttendance)
useEffect(() => {
  handleStartAttendanceRef.current = handleStartAttendance
}, [handleStartAttendance])

// Callback corrigido
const handleConfirmStartAttendance = useCallback(async () => {
  if (clientDetail && isClientAdimplente) {
    void showClienteAdimplenteAlert(clientDetail)
    return
  }

  const numVenda = clientDetail ? getNumVenda(clientDetail) : ""
  if (!numVenda) return

  const result = await Swal.fire({ /* ... sem alteração ... */ })
  if (!result.isConfirmed) return

  handleStartAttendanceRef.current()
}, [clientDetail, isClientAdimplente])
```

**Justificativa**: `isClientAdimplente` é derivado de `clientDetail` (recalculado a cada render), então adicioná-lo ao array de deps não causa re-renderizações extras. Já `handleStartAttendance` depende de `clientDetail` e `navigate`, e recria a cada render — usar `useRef` evita recriações desnecessárias do callback de confirmação, especialmente relevante por ele ser passado a um componente filho (botão/modal).

**Arquivos afetados**: `src/shared/ui/calendar/InteractiveCalendar.tsx`
**Linhas**: ~1006-1035 (callback), novo bloco de ref antes da linha 1006

---

### F2 — String UTF-8 Corrompida

**Estratégia**: Substituição direta do literal corrompido.

```tsx
// De:
setClientDetailError("Não foi possÃ­vel carregar detalhes do cliente.")
// Para:
setClientDetailError("Não foi possível carregar detalhes do cliente.")
```

**Causa raiz**: O arquivo foi salvo ou editado em algum momento com dupla codificação UTF-8 (UTF-8 → Latin-1 → UTF-8), corrompendo `í` → `Ã­`.

**Verificação adicional**: Fazer `grep` por `Ã` em todo o projeto para identificar outras strings potencialmente corrompidas.

**Arquivos afetados**: `src/shared/ui/calendar/InteractiveCalendar.tsx`
**Linha**: ~1508

---

### F3 — Cache LRU com TTL

**Estratégia**: Substituir o `Map` simples por uma classe `LRUCache` com TTL, implementada inline no mesmo arquivo (sem dependência externa).

```tsx
const CACHE_MAX_SIZE = 200
const CACHE_TTL_MS = 60_000

interface CacheEntry<T> {
  value: T
  ts: number
}

class LRUCache<K, V> {
  private map = new Map<K, CacheEntry<V>>()
  constructor(
    private maxSize: number,
    private ttlMs: number,
  ) {}

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > this.ttlMs) {
      this.map.delete(key)
      return undefined
    }
    // Move to end (most recently used)
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest (first entry)
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { value, ts: Date.now() })
  }

  clear(): void {
    this.map.clear()
  }
}

const clientCache = new LRUCache<string, InadimplenciaRecord>(CACHE_MAX_SIZE, CACHE_TTL_MS)

async function fetchClienteByNumVenda(numVenda: string) {
  const cached = clientCache.get(numVenda)
  if (cached !== undefined) return cached

  try {
    const data = await apiFetch<InadimplenciaResponse>(`/num-venda/${numVenda}`)
    const records = normalizeArray<InadimplenciaRecord>(data)
    const result = sanitizeInadimplenciaRecord(records[0] ?? null)
    // Não cacheia null — permite re-fetch em falhas
    if (result !== null) {
      clientCache.set(numVenda, result)
    }
    return result
  } catch {
    return null
  }
}
```

**Decisões de design**:
| Decisão | Valor | Justificativa |
|---|---|---|
| TTL | 60s | Equilíbrio entre freshness e redução de requisições. Configurável via constante |
| Max size | 200 | Cobre sessões típicas. LRU evicta entradas menos usadas |
| Null caching | Desabilitado | Permite retry automático de buscas que falharam |
| Política de evicção | LRU via Map iteration order | `Map` do JS preserva ordem de inserção — `delete` + `set` move para o final |
| Cleanup na desmontagem | Não necessário | O cache é module-scoped e leve; o TTL + LRU evitam crescimento descontrolado. O PRD menciona limpar ao desmontar, mas como o `Map` é fora do componente, isso invalidaria o cache entre navegações desnecessariamente. O TTL já resolve a questão de dados stale |

**Arquivos afetados**: `src/shared/ui/calendar/InteractiveCalendar.tsx`
**Linhas**: ~87-104

---

### F4 — Reconexão SSE com Backoff Exponencial

**Estratégia**: Encapsular a criação do `EventSource` em uma função `connect()` interna ao `useEffect`, com retry automático via `setTimeout` e backoff exponencial.

```tsx
useEffect(() => {
  const resolvedUser = loggedUser.trim() || getUserFromWcm().trim() || "melyssa.tatum"
  if (!resolvedUser) return

  const url = `${API_BASE}/notificacoes/inadimplencia/stream?username=${encodeURIComponent(resolvedUser)}`

  let es: EventSource | null = null
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let retryDelay = 1_000
  const MAX_RETRY_DELAY = 30_000

  function connect() {
    es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener(SSE_EVENT, (e: MessageEvent) => {
      try {
        const snapshot = JSON.parse(e.data) as InadimplenciaNotificationSnapshot
        applySnapshot(snapshot)
      } catch {
        // parse error — ignora
      }
    })

    es.onopen = () => {
      retryDelay = 1_000 // reset ao reconectar com sucesso
    }

    es.onerror = () => {
      es?.close()
      eventSourceRef.current = null
      retryTimeout = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY)
        connect()
      }, retryDelay)
    }
  }

  connect()

  return () => {
    es?.close()
    eventSourceRef.current = null
    if (retryTimeout) clearTimeout(retryTimeout)
  }
}, [loggedUser, applySnapshot])
```

**Parâmetros de reconexão**:
| Parâmetro | Valor |
|---|---|
| Delay inicial | 1s |
| Delay máximo | 30s |
| Fator de backoff | 2x (exponencial) |
| Máximo de tentativas | Ilimitado (enquanto componente montado) |
| Reset | Ao reconectar com sucesso (`onopen`) |

**Arquivos afetados**: `src/pages/main/Notifications.tsx`
**Linhas**: ~54-78

### Interfaces Principais

Nenhuma interface nova é introduzida. A classe `LRUCache<K, V>` é interna ao módulo e não exportada.

### Modelos de Dados

Nenhuma alteração em modelos de dados. A `CacheEntry<T>` é um tipo auxiliar interno:

```tsx
interface CacheEntry<T> {
  value: T
  ts: number  // timestamp de criação em ms
}
```

### Endpoints de API

Nenhum endpoint alterado. Todas as correções são exclusivamente front-end.

## Pontos de Integração

Nenhuma integração externa nova. Os pontos existentes mantêm-se:
- **API REST**: `apiFetch<InadimplenciaResponse>(/num-venda/{numVenda})` — inalterado
- **SSE**: `EventSource` para `/notificacoes/inadimplencia/stream` — mesma URL, agora com reconexão

## Abordagem de Testes

### Testes Unitários

Embora testes automatizados não sejam obrigatórios neste escopo (PRD), os seguintes cenários são recomendados:

- **LRUCache**:
  - `get` retorna `undefined` para chave inexistente
  - `get` retorna `undefined` para entrada expirada (TTL)
  - `set` evicta a entrada mais antiga quando `maxSize` é atingido
  - `get` promove entrada para o final (LRU behavior)
  - `clear` esvazia o cache

- **fetchClienteByNumVenda**:
  - Não cacheia resultado `null`
  - Retorna do cache quando entrada válida existe
  - Faz nova requisição quando entrada expirou

### Testes Manuais

| Bug | Cenário de verificação |
|---|---|
| F1 | Abrir modal de cliente → esperar mudança de adimplência → clicar "Confirmar Atendimento" → verificar que usa o status atualizado |
| F2 | Forçar erro ao carregar detalhes do cliente → verificar que a mensagem exibe "possível" sem caracteres corrompidos |
| F3 | Abrir sistema → realizar >200 buscas distintas → verificar que `clientCache.map.size` nunca excede 200 via DevTools |
| F4 | Abrir notificações → desconectar rede por 10s → reconectar → verificar que notificações voltam automaticamente sem reload |

### Testes de E2E

Se implementados futuramente com Playwright MCP:
- Navegar ao calendário → abrir modal → simular falha de API → verificar mensagem UTF-8 correta
- Abrir notificações → interceptar SSE com `page.route()` para simular queda → verificar reconexão

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **F2 — String UTF-8** (1 linha, zero risco, validação visual imediata)
2. **F3 — Cache LRU** (mudança isolada no module scope, sem dependência dos outros fixes)
3. **F1 — Stale Closure** (depende de entender o fluxo de refs no componente)
4. **F4 — Reconexão SSE** (arquivo separado, pode ser feito em paralelo com F1/F3)

### Dependências Técnicas

- Nenhuma dependência de infraestrutura ou serviço externo
- Nenhuma biblioteca nova necessária
- Todos os 4 fixes são independentes entre si e podem ser entregues/mergeados separadamente

## Monitoramento e Observabilidade

- **F3**: Opcionalmente, logar `console.debug` quando uma entrada do cache é evictada por LRU ou TTL (remover antes de produção ou proteger com flag de debug)
- **F4**: O `onerror` do EventSource já logava (console vazio) — adicionar `console.warn('SSE disconnected, retrying in ${retryDelay}ms')` para visibilidade em produção
- **Logs PM2**: Erros de reconexão SSE serão visíveis nos logs do browser (DevTools), não nos logs do servidor

## Considerações Técnicas

### Decisões Principais

| Decisão | Alternativa rejeitada | Justificativa |
|---|---|---|
| `useRef` para `handleStartAttendance` (F1) | Adicionar ao array de deps | `handleStartAttendance` recria a cada render por depender de `clientDetail` e `navigate`. Adicioná-lo ao deps causaria recriações em cascata do callback de confirmação. `useRef` mantém referência estável |
| LRU manual via `Map` (F3) | Biblioteca `lru-cache` | PRD restringe novas dependências. A implementação via `Map` iteration order é ~30 linhas e suficiente para o caso de uso |
| Retry SSE indefinido (F4) | Limite de N tentativas | Componente montado = usuário na página. Parar de tentar forçaria reload manual, exatamente o problema que queremos resolver |
| Não limpar cache no unmount (F3) | `useEffect` cleanup que chama `clientCache.clear()` | Cache module-scoped é compartilhado entre montagens. TTL + LRU já garantem freshness e limite de memória. Limpar no unmount invalidaria dados válidos ao navegar entre páginas |

### Riscos Conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `isClientAdimplente` como dep pode causar recriações do callback F1 | Baixa | Baixo | É derivado de `clientDetail` que já está no array — muda junto |
| Outras strings com dupla codificação UTF-8 (F2) | Média | Baixo | Fazer grep por `Ã` no projeto antes de considerar completo |
| Race condition no retry SSE se componente desmontar durante setTimeout | Baixa | Baixo | Cleanup do `useEffect` limpa tanto `es` quanto `retryTimeout` |
| Cache LRU não limpo em memory pressure do browser | Muito baixa | Baixo | 200 entradas × ~1KB = ~200KB — negligível |

### Conformidade com Padrões

Conforme `@.windsurf/rules/techspec-codebase.md`:

- **SSE via `sseHub`**: A regra se aplica ao back-end. No front-end, o `EventSource` consome o stream — a correção F4 não altera o servidor, apenas adiciona resiliência no cliente
- **Sem dependências novas**: Atendido — LRU implementado manualmente
- **Somente front-end**: Atendido — nenhuma alteração em routes, controllers, services ou models do back-end

### Arquivos relevantes e dependentes

| Arquivo | Ação | Bug |
|---|---|---|
| `src/shared/ui/calendar/InteractiveCalendar.tsx` | Modificar | F1, F2, F3 |
| `src/pages/main/Notifications.tsx` | Modificar | F4 |
| `src/shared/utils/clienteSituacao.ts` | Somente leitura (referência) | F1 |
| `src/shared/api/client.ts` | Somente leitura (referência) | F3 |
| `src/shared/types/inadimplencia.ts` | Somente leitura (tipo `InadimplenciaRecord`) | F3 |
| `src/shared/types/notification.ts` | Somente leitura (tipo `InadimplenciaNotificationSnapshot`) | F4 |
