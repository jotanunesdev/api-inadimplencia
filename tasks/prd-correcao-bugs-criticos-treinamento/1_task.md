# Tarefa 1.0: Token Cache Lock - Race Condition SharePoint

<complexity>MEDIUM</complexity>

## Visão Geral

Implementar mecanismo de lock/singleton no cache de token SharePoint para evitar que múltiplas requisições concorrentes disparem refresh simultâneo do token. Isso elimina a race condition identificada no Bug B1.

<requirements>
1. Implementar promise singleton `refreshPromise` que garanta apenas uma requisição de refresh por vez
2. Threads concorrentes devem aguardar a mesma Promise de refresh em vez de criarem novas
3. Manter TTL (time-to-live) do token respeitado para evitar requisições desnecessárias
4. Resetar `refreshPromise` após conclusão (sucesso ou erro) para permitir futuros refreshs
</requirements>

## Subtarefas

- [ ] 1.1 Adicionar variável `refreshPromise` no escopo do módulo `sharePointService.ts`
- [ ] 1.2 Modificar `getAccessToken()` para verificar `refreshPromise` antes de iniciar novo refresh
- [ ] 1.3 Implementar lógica de deduplicação: se `refreshPromise` existe, retornar ela
- [ ] 1.4 Garantir que `refreshPromise` seja resetada no `finally` (sucesso ou erro)
- [ ] 1.5 Testar com 100+ requisições simultâneas verificando apenas 1 chamada à API da Microsoft

## Detalhes de Implementação

Ver Tech Spec - Seção "Design de Implementação" e código de referência:

```typescript
// sharePointService.ts
let tokenCache: TokenCache | null = null
let refreshPromise: Promise<string> | null = null  // NOVO

async function getAccessToken(): Promise<string> {
  const config = getSharePointConfig()
  if (!config) throw new Error("SharePoint nao habilitado")

  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.value
  }

  // NOVO: Deduplicação de refresh
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      // ... lógica de refresh existente ...
      const json = await response.json()
      const expiresInSeconds = Number(json.expires_in ?? 3600)
      tokenCache = {
        value: json.access_token,
        expiresAt: now + Math.max(60, expiresInSeconds - 120) * 1000,
      }
      return tokenCache.value
    } finally {
      refreshPromise = null  // Resetar para permitir próximo refresh
    }
  })()

  return refreshPromise
}
```

## Critérios de Sucesso

- [ ] 100 requisições simultâneas ao `getAccessToken()` resultam em exatamente 1 chamada à API da Microsoft
- [ ] TTL do token é respeitado (token em cache válido é reutilizado)
- [ ] Após expiração, novo refresh é feito corretamente
- [ ] Erros no refresh não quebram o mecanismo (reset funciona em catch)
- [ ] Latência adicional < 10ms por requisição deduplicada

## Testes da Tarefa

- [ ] **Teste de Unidade 1:** Simular 100 chamadas simultâneas a `getAccessToken()` e verificar que apenas 1 fetch é feito à API da Microsoft
- [ ] **Teste de Unidade 2:** Verificar que token em cache válido retorna imediatamente sem chamar API
- [ ] **Teste de Unidade 3:** Simular erro no refresh e verificar que `refreshPromise` é resetada, permitindo retry
- [ ] **Teste de Integração:** Executar upload de arquivo com SharePoint habilitado, verificar que autenticação funciona e apenas 1 token é gerado

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/treinamento/services/sharePointService.ts` (linhas 57-172)
