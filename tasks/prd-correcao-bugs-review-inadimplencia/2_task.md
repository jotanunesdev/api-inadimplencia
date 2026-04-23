# Tarefa 2.0: Implementação de Cache LRU com TTL (F3)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Substituir o `Map` simples usado como cache de clientes por uma classe `LRUCache<K, V>` com TTL, implementada inline no mesmo arquivo (sem dependência externa). A classe deve limitar o cache a 200 entradas, expirar entradas após 60 segundos, e não cachear resultados `null`. Esta tarefa segue abordagem **TDD (Red-Green-Refactor)**: os testes devem ser criados antes da implementação.

<requirements>
- RF-3.1: O cache não deve armazenar resultados `null` (falhas de busca).
- RF-3.2: O cache deve ter um limite máximo de 200 entradas com política de evicção LRU.
- RF-3.3: Cada entrada do cache deve ter um TTL de 60 segundos, após o qual é considerada expirada.
- RF-3.4: A Tech Spec decidiu que o cache NÃO será limpo no unmount (é module-scoped, TTL + LRU já garantem freshness). Ver justificativa na tabela de decisões da techspec.md.
</requirements>

## Subtarefas

- [ ] 2.1 **(RED)** Criar arquivo de teste para a classe `LRUCache` com os seguintes cenários:
  - `get` retorna `undefined` para chave inexistente
  - `get` retorna `undefined` para entrada expirada (TTL)
  - `set` evicta a entrada mais antiga quando `maxSize` é atingido
  - `get` promove entrada para o final (LRU behavior)
  - `clear` esvazia o cache
- [ ] 2.2 **(RED)** Criar testes para `fetchClienteByNumVenda`:
  - Não cacheia resultado `null`
  - Retorna do cache quando entrada válida existe
  - Faz nova requisição quando entrada expirou
- [ ] 2.3 **(GREEN)** Implementar a classe `LRUCache<K, V>` com `maxSize` e `ttlMs` conforme a techspec.md (linhas ~87-131)
- [ ] 2.4 **(GREEN)** Substituir `const clientCache = new Map(...)` por `const clientCache = new LRUCache<string, InadimplenciaRecord>(200, 60_000)`
- [ ] 2.5 **(GREEN)** Atualizar `fetchClienteByNumVenda` para usar `clientCache.get()` e `clientCache.set()` da nova classe, e não cachear `null`
- [ ] 2.6 **(REFACTOR)** Revisar e executar todos os testes — garantir que passam e que o código está limpo

## Detalhes de Implementação

Consulte a seção **F3 — Cache LRU com TTL** da `techspec.md` para:
- O código completo da classe `LRUCache<K, V>` (linhas 87-131 da techspec)
- A função `fetchClienteByNumVenda` atualizada (linhas 134-150 da techspec)
- A tabela de decisões de design (TTL, maxSize, null caching, política de evicção, cleanup)

**Pontos-chave**:
- `CACHE_MAX_SIZE = 200`, `CACHE_TTL_MS = 60_000`
- LRU implementado via `Map` iteration order — `delete` + `set` move para o final
- `null` nunca é cacheado → permite retry automático de buscas que falharam

## Critérios de Sucesso

- `clientCache.map.size` nunca excede 200 entradas (verificável via DevTools)
- Entradas expiram após 60 segundos — nova busca é realizada automaticamente
- Resultados `null` nunca são cacheados
- Todos os testes unitários passam
- Sessões longas (>2h) mantêm memória estável

## Testes da Tarefa

- [ ] **Testes unitários da `LRUCache`**:
  - `get` retorna `undefined` para chave inexistente
  - `get` retorna `undefined` para entrada expirada (TTL)
  - `set` evicta a entrada mais antiga quando `maxSize` é atingido
  - `get` promove entrada para o final (LRU behavior)
  - `clear` esvazia o cache
- [ ] **Testes unitários de `fetchClienteByNumVenda`**:
  - Não cacheia resultado `null`
  - Retorna do cache quando entrada válida existe
  - Faz nova requisição quando entrada expirou
- [ ] **Teste manual**: Abrir sistema → realizar >200 buscas distintas → verificar via DevTools que o tamanho do cache não excede 200

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/shared/ui/calendar/InteractiveCalendar.tsx` (linhas ~87-104) — arquivo a modificar
- `src/shared/api/client.ts` — referência (somente leitura)
- `src/shared/types/inadimplencia.ts` — tipo `InadimplenciaRecord` (somente leitura)
