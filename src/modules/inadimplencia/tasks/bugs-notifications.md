# Bugs Identificados — Módulo de Notificações

> Revisão realizada em: 22/04/2026  
> Escopo: `src/modules/inadimplencia` — arquivos relacionados a notificações

---

## BUG-01 — `listUnread`: Erro de sintaxe SQL — `OFFSET` ausente

**Severidade:** Alta  
**Arquivo:** `models/notificationsRepository.js` — linha 211  
**Status:** Aberto

### Descrição
O SQL Server exige a cláusula `OFFSET n ROWS` antes de `FETCH NEXT ... ROWS ONLY`. Sem ela, a query lança um erro de sintaxe, quebrando toda chamada a `listUnread`.

### Código atual
```sql
ORDER BY DT_CRIACAO DESC
FETCH NEXT @limit ROWS ONLY
```

### Correção esperada
```sql
ORDER BY DT_CRIACAO DESC
OFFSET 0 ROWS
FETCH NEXT @limit ROWS ONLY
```

### Referência
Comparar com `listPaginated` (linha 174–176), que usa `OFFSET @offset ROWS` corretamente.

---

## BUG-02 — `softDelete` (service): Catch captura o próprio 404

**Severidade:** Média  
**Arquivo:** `services/notificationService.js` — linhas 179–196  
**Status:** Aberto

### Descrição
O erro 404 lançado dentro do bloco `try` (linha 179) é capturado pelo `catch` do mesmo bloco. Isso faz com que qualquer exceção lançada por `sseHub.emitUpdate(...)` cuja mensagem seja `'Notification not found'` seja **convertida silenciosamente em um falso 404**, mascarando o erro real.

### Código atual
```js
try {
  const row = await notificationsRepository.softDelete(id, username);

  if (!row) {
    throw buildError('Notification not found', 404); // lançado dentro do try
  }

  const dto = mapRowToDTO(row);
  sseHub.emitUpdate(normalizeUsername(username), dto); // se lançar, cai no catch abaixo

  return dto;
} catch (error) {
  if (error.statusCode === 409) {
    throw error;
  }
  if (error.message === 'Notification not found') {
    throw buildError('Notification not found', 404); // captura o próprio 404 e recria
  }
  throw error;
}
```

### Correção esperada
Mover a guarda `!row` para fora do `try/catch`, ou restringir o catch apenas a erros do repositório:

```js
const row = await notificationsRepository.softDelete(id, username).catch((error) => {
  if (error.statusCode === 409) throw error;
  throw error;
});

if (!row) {
  throw buildError('Notification not found', 404);
}

const dto = mapRowToDTO(row);
sseHub.emitUpdate(normalizeUsername(username), dto);
return dto;
```

---

## BUG-03 — `createOverdueNotification`: Chave do mutex não normalizada

**Severidade:** Média  
**Arquivo:** `services/notificationService.js` — linha 93  
**Status:** Aberto

### Descrição
A chave do mutex in-memory (`dedupeMutex`) é construída com o `destinatario` cru (sem normalização). O campo `RESPONSAVEL` retornado pelo banco pode ter casing variado (ex: `'Joao Silva'`). Duas chamadas concorrentes com `'Joao Silva'` e `'joao silva'` geram chaves diferentes, **bypassam o mutex** e podem inserir notificações duplicadas — mesmo que o SELECT de dedupe no banco normalize o valor.

### Código atual
```js
const dedupeKey = `VENDA_ATRASADA|${destinatario}|${numVenda}|${proximaAcaoDia}`;
```

### Correção esperada
```js
const dedupeKey = `VENDA_ATRASADA|${normalizeUsername(destinatario)}|${numVenda}|${proximaAcaoDia}`;
```

---

## BUG-04 — `getSnapshotForUser`: `unreadCount` e `total` limitados a 20

**Severidade:** Média  
**Arquivo:** `services/notificationService.js` — linhas 223–231  
**Status:** Aberto

### Descrição
`listUnread` retorna no máximo 20 registros. O `unreadCount` e `total` do snapshot são calculados como `rows.length`, que será sempre ≤ 20. Se o usuário tiver 50 notificações não lidas, o cliente recebe `total: 20, unreadCount: 20` — o contador de badge estará incorreto.

### Código atual
```js
const unreadCount = rows.length; // no máximo 20

return {
  total: unreadCount,   // errado se houver > 20 não lidas
  unreadCount,           // errado se houver > 20 não lidas
  notifications: rows.map(mapRowToDTO),
};
```

### Correção esperada
Buscar a contagem real do banco, independente do limite de 20 linhas. Opções:
- Adicionar um `COUNT(*)` separado em `listUnread`, retornando `{ rows, totalUnread }`.
- Reutilizar `listPaginated({ username, lida: false })` que já possui `UnreadCTE` com a contagem total.

---

## BUG-05 — `softDelete` (repository): Race condition TOCTOU

**Severidade:** Baixa  
**Arquivo:** `models/notificationsRepository.js` — linhas 275–323  
**Status:** Aberto

### Descrição
O SELECT para verificar `LIDA` (linhas 275–291) e o UPDATE de exclusão (linhas 300–322) são dois round-trips separados, sem transação ou lock. Duas requisições DELETE concorrentes para a mesma notificação não lida podem **ambas passar pela verificação** antes que qualquer uma execute o UPDATE, permitindo a exclusão de uma notificação não lida.

### Código atual (fluxo)
```
1. SELECT LIDA FROM ... WHERE ID = @id AND DT_EXCLUSAO IS NULL
2. if (LIDA === 0) → throw 409
3. UPDATE ... SET DT_EXCLUSAO = ...     ← outra request pode chegar aqui antes do UPDATE
```

### Correção esperada
Unificar em uma única operação atômica: executar o `UPDATE` diretamente com a condição `AND LIDA = 1` e usar `OUTPUT DELETED.*` ou verificar `rowsAffected` para distinguir "não encontrado" de "não lida":

```sql
UPDATE dbo.INAD_NOTIFICACOES
SET DT_EXCLUSAO = SYSUTCDATETIME()
OUTPUT INSERTED.*
WHERE ID = @id
  AND USUARIO_DESTINATARIO = @username
  AND LIDA = 1
  AND DT_EXCLUSAO IS NULL
```

Se `rowsAffected[0] === 0`, fazer um SELECT separado apenas para distinguir "não existe" (404) de "não lida" (409).

---

## Resumo

| ID | Severidade | Arquivo | Descrição curta |
|----|------------|---------|-----------------|
| BUG-01 | **Alta** | `models/notificationsRepository.js:211` | `listUnread` — SQL quebrado, falta `OFFSET 0 ROWS` |
| BUG-02 | **Média** | `services/notificationService.js:179-196` | `softDelete` — catch captura o próprio 404, pode mascarar erros reais |
| BUG-03 | **Média** | `services/notificationService.js:93` | Mutex de dedupe usa username não normalizado |
| BUG-04 | **Média** | `services/notificationService.js:223-228` | Snapshot retorna `unreadCount` errado quando há > 20 não lidas |
| BUG-05 | **Baixa** | `models/notificationsRepository.js:275-323` | `softDelete` SELECT→UPDATE não é atômico (TOCTOU) |
