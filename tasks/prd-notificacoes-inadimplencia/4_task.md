# Tarefa 4.0: Corrigir BUG-04 - Contagem correta de notificações não lidas no snapshot

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Modificar `listUnread` para retornar a contagem total real de notificações não lidas (independente do limite de 20) e atualizar `getSnapshotForUser` para usar essa contagem correta nos campos `unreadCount` e `total`.

<requirements>
- `listUnread` deve retornar a contagem total real de notificações não lidas
- `getSnapshotForUser` deve usar a contagem real nos campos `unreadCount` e `total`
- O limite de 20 registros deve continuar sendo aplicado apenas à lista de notificações retornadas
- Esta tarefa depende da Tarefa 1.0 (BUG-01) pois modifica o mesmo método `listUnread`
</requirements>

## Subtarefas

- [ ] 4.1 Modificar `listUnread` para retornar `{ rows, totalUnread }` com a contagem real
- [ ] 4.2 Atualizar `getSnapshotForUser` para usar `totalUnread` nos campos `unreadCount` e `total`
- [ ] 4.3 Criar testes unitários do repository para verificar contagem correta com >20 notificações não lidas
- [ ] 4.4 Criar testes unitários do service para verificar o snapshot com contagem correta
- [ ] 4.5 Executar os testes e validar o funcionamento

## Detalhes de Implementação

**Arquivos:**
- `src/modules/inadimplencia/models/notificationsRepository.js` - método `listUnread`
- `src/modules/inadimplencia/services/notificationService.js` - método `getSnapshotForUser` (linhas 223–231)

**Opções de implementação:**
- Adicionar um `COUNT(*)` separado em `listUnread`, retornando `{ rows, totalUnread }`
- Reutilizar `listPaginated({ username, lida: false })` que já possui `UnreadCTE` com a contagem total

**Correção esperada em `getSnapshotForUser`:**
```js
// Antes:
const unreadCount = rows.length; // no máximo 20

return {
  total: unreadCount,   // errado se houver > 20 não lidas
  unreadCount,           // errado se houver > 20 não lidas
  notifications: rows.map(mapRowToDTO),
};

// Depois:
const { rows, totalUnread } = await notificationsRepository.listUnread(username);

return {
  total: totalUnread,
  unreadCount: totalUnread,
  notifications: rows.map(mapRowToDTO),
};
```

## Critérios de Sucesso

- `listUnread` retorna a contagem total real de notificações não lidas
- `getSnapshotForUser` retorna `unreadCount` e `total` corretos mesmo com >20 notificações não lidas
- O limite de 20 registros continua sendo aplicado apenas à lista de notificações
- Todos os testes unitários passam

## Testes da Tarefa

- [ ] Teste unitário do repository para verificar contagem correta com >20 notificações não lidas
- [ ] Teste unitário do service para verificar o snapshot com contagem correta

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/inadimplencia/models/notificationsRepository.js`
- `src/modules/inadimplencia/services/notificationService.js`
- `src/modules/inadimplencia/models/notificationsRepository.test.js`
- `src/modules/inadimplencia/services/notificationService.test.js`

## Dependências
- Tarefa 1.0 (BUG-01) - deve ser completada antes desta tarefa
