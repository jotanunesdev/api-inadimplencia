# Tarefa 2.0: Corrigir BUG-02 - Tratamento de erro no `softDelete` (service)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Refatorar o bloco try/catch do método `softDelete` no service para não capturar o próprio erro 404 lançado internamente, evitando que erros reais do SSE emit sejam mascarados.

<requirements>
- O erro 404 lançado dentro do try não deve ser capturado pelo catch do mesmo bloco
- Erros do repositório (statusCode 409) devem continuar sendo tratados
- Erros reais do `sseHub.emitUpdate` não devem ser mascarados
</requirements>

## Subtarefas

- [ ] 2.1 Refatorar o bloco try/catch para mover a verificação `!row` para fora do try/catch
- [ ] 2.2 Criar testes unitários para verificar os cenários: notificação encontrada, não encontrada (404), e erros reais do SSE emit
- [ ] 2.3 Executar os testes e validar o funcionamento

## Detalhes de Implementação

**Arquivo:** `src/modules/inadimplencia/services/notificationService.js` - linhas 179–196

**Correção esperada:**
```js
// Mover a guarda !row para fora do try/catch:
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

## Critérios de Sucesso

- O erro 404 lançado internamente não é capturado pelo catch
- Erros do repositório (409) continuam sendo tratados corretamente
- Erros reais do `sseHub.emitUpdate` não são mascarados
- Todos os testes unitários passam

## Testes da Tarefa

- [ ] Teste unitário do service para verificar cenário de notificação encontrada
- [ ] Teste unitário do service para verificar cenário de notificação não encontrada (404)
- [ ] Teste unitário do service para verificar que erros reais do SSE emit não são mascarados

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/inadimplencia/services/notificationService.js`
- `src/modules/inadimplencia/services/notificationService.test.js`
