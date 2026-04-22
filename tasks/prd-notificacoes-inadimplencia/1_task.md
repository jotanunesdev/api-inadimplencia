# Tarefa 1.0: Corrigir BUG-01 - Erro de sintaxe SQL em `listUnread`

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Corrigir a query SQL do método `listUnread` no repository para incluir a cláusula `OFFSET 0 ROWS` antes de `FETCH NEXT ... ROWS ONLY`, conforme exigido pelo SQL Server.

<requirements>
- A query SQL deve incluir `OFFSET 0 ROWS` antes de `FETCH NEXT`
- A correção deve seguir o padrão já utilizado em `listPaginated`
- O método deve continuar retornando no máximo 20 registros
</requirements>

## Subtarefas

- [ ] 1.1 Adicionar `OFFSET 0 ROWS` na query SQL do método `listUnread`
- [ ] 1.2 Criar teste unitário para verificar que `listUnread` funciona corretamente após a correção
- [ ] 1.3 Executar o teste e validar o funcionamento

## Detalhes de Implementação

**Arquivo:** `src/modules/inadimplencia/models/notificationsRepository.js` - linha 211

**Correção:**
```sql
-- Antes:
ORDER BY DT_CRIACAO DESC
FETCH NEXT @limit ROWS ONLY

-- Depois:
ORDER BY DT_CRIACAO DESC
OFFSET 0 ROWS
FETCH NEXT @limit ROWS ONLY
```

Referência: Comparar com `listPaginated` (linha 174–176), que usa `OFFSET @offset ROWS` corretamente.

## Critérios de Sucesso

- A query SQL não lança erro de sintaxe ao ser executada
- O método `listUnread` retorna os resultados esperados
- O teste unitário passa com sucesso

## Testes da Tarefa

- [ ] Teste unitário do repository para verificar que `listUnread` retorna resultados corretamente após a correção SQL

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/inadimplencia/models/notificationsRepository.js`
- `src/modules/inadimplencia/models/notificationsRepository.test.js`
