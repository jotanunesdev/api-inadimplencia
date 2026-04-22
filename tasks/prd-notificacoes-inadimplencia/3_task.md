# Tarefa 3.0: Corrigir BUG-03 - Normalização de chave do mutex

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Aplicar `normalizeUsername` na chave do mutex `dedupeMutex` em `createOverdueNotification` para evitar que chamadas concorrentes com usernames em diferentes cases gerem chaves diferentes e bypassem o mutex.

<requirements>
- A chave do mutex deve usar o username normalizado
- Chamadas concorrentes com usernames em diferentes cases devem gerar a mesma chave
- A deduplicação deve funcionar corretamente independentemente do case do username
</requirements>

## Subtarefas

- [ ] 3.1 Aplicar `normalizeUsername` na chave do mutex `dedupeMutex`
- [ ] 3.2 Criar teste unitário simulando chamadas concorrentes com usernames em diferentes cases
- [ ] 3.3 Executar o teste e validar o funcionamento

## Detalhes de Implementação

**Arquivo:** `src/modules/inadimplencia/services/notificationService.js` - linha 93

**Correção:**
```js
// Antes:
const dedupeKey = `VENDA_ATRASADA|${destinatario}|${numVenda}|${proximaAcaoDia}`;

// Depois:
const dedupeKey = `VENDA_ATRASADA|${normalizeUsername(destinatario)}|${numVenda}|${proximaAcaoDia}`;
```

## Critérios de Sucesso

- A chave do mutex usa o username normalizado
- Chamadas concorrentes com usernames em diferentes cases geram a mesma chave
- O teste unitário simula com sucesso chamadas concorrentes e valida a deduplicação

## Testes da Tarefa

- [ ] Teste unitário simulando chamadas concorrentes com usernames em diferentes cases para garantir deduplicação

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/inadimplencia/services/notificationService.js`
- `src/modules/inadimplencia/services/notificationService.test.js`
