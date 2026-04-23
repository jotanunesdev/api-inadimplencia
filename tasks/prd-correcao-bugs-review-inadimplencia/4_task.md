# Tarefa 4.0: Reconexão SSE com Backoff Exponencial (F4)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Implementar lógica de reconexão automática com backoff exponencial para o `EventSource` de notificações em tempo real no componente `Notifications.tsx`. Atualmente, se a conexão SSE cai, o usuário perde todas as notificações até recarregar manualmente a página. A correção encapsula a criação do `EventSource` em uma função `connect()` interna ao `useEffect`, com retry automático.

<requirements>
- RF-4.1: Quando a conexão SSE falhar, o sistema deve tentar reconectar automaticamente.
- RF-4.2: As tentativas de reconexão devem usar backoff exponencial, iniciando em 1 segundo e com limite máximo de 30 segundos.
- RF-4.3: Ao reconectar com sucesso, o delay de retry deve ser resetado ao valor inicial (1s).
- RF-4.4: O cleanup do `useEffect` deve encerrar tanto a conexão SSE quanto quaisquer timers de retry pendentes.
- RF-4.5: O usuário não deve precisar recarregar a página para restaurar as notificações após uma queda temporária de conexão.
</requirements>

## Subtarefas

- [ ] 4.1 Refatorar o `useEffect` de SSE para encapsular a criação do `EventSource` em uma função `connect()` interna
- [ ] 4.2 Implementar variáveis de controle de retry:
  - `retryTimeout: ReturnType<typeof setTimeout> | null`
  - `retryDelay = 1_000` (delay inicial)
  - `MAX_RETRY_DELAY = 30_000` (delay máximo)
- [ ] 4.3 Implementar handler `es.onerror`:
  - Fechar o `EventSource` atual
  - Agendar `setTimeout` com `retryDelay`
  - Duplicar `retryDelay` (com cap em `MAX_RETRY_DELAY`)
  - Chamar `connect()` recursivamente
- [ ] 4.4 Implementar handler `es.onopen`:
  - Resetar `retryDelay` para `1_000` ao reconectar com sucesso
- [ ] 4.5 Atualizar cleanup do `useEffect`:
  - `es?.close()` + `eventSourceRef.current = null`
  - `if (retryTimeout) clearTimeout(retryTimeout)`
- [ ] 4.6 Adicionar log de reconexão: `console.warn('SSE disconnected, retrying in ${retryDelay}ms')`
- [ ] 4.7 Criar e executar testes da tarefa

## Detalhes de Implementação

Consulte a seção **F4 — Reconexão SSE com Backoff Exponencial** da `techspec.md` para:
- O código completo do `useEffect` refatorado (linhas 172-217 da techspec)
- A tabela de parâmetros de reconexão (delay inicial, máximo, fator de backoff, reset)

**Pontos-chave**:
- O `EventSource` consome o mesmo endpoint SSE — nenhuma alteração no servidor
- Retry é ilimitado enquanto o componente está montado (parar forçaria reload manual)
- O cleanup do `useEffect` previne race conditions ao desmontar durante um `setTimeout`

## Critérios de Sucesso

- Após queda de rede, a conexão SSE reconecta automaticamente sem reload da página
- O delay de retry dobra a cada falha (1s → 2s → 4s → 8s → 16s → 30s → 30s...)
- O delay reseta para 1s ao reconectar com sucesso
- Nenhum timer de retry fica pendurado após desmontar o componente
- Console exibe `warn` com o delay atual a cada tentativa de reconexão

## Testes da Tarefa

- [ ] **Teste unitário**: Verificar que `connect()` é chamada novamente após `onerror` com delay crescente
- [ ] **Teste unitário**: Verificar que `onopen` reseta `retryDelay` para 1000ms
- [ ] **Teste unitário**: Verificar que `retryDelay` nunca excede `MAX_RETRY_DELAY` (30s)
- [ ] **Teste unitário**: Verificar que o cleanup do `useEffect` limpa tanto o `EventSource` quanto o `retryTimeout`
- [ ] **Teste manual**: Abrir notificações → desconectar rede por 10s → reconectar → verificar que notificações voltam automaticamente sem reload

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/pages/main/Notifications.tsx` (linhas ~54-78) — arquivo a modificar
- `src/shared/types/notification.ts` — tipo `InadimplenciaNotificationSnapshot` (somente leitura)
