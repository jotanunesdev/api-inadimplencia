# Tarefa 5.0: Corrigir BUG-05 - Race condition no `softDelete` (repository)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Unificar o SELECT para verificar `LIDA` e o UPDATE de exclusão do método `softDelete` em uma única operação atômica para evitar race condition TOCTOU (Time-Of-Check-Time-Of-Use).

<requirements>
- O SELECT e o UPDATE devem ser unificados em uma operação atômica
- Deve ser possível distinguir "não encontrado" (404) de "não lida" (409)
- Requisições DELETE concorrentes para a mesma notificação não lida não devem ambas passar pela verificação
- **Recomendado seguir processo Red-Green-Refactor (TDD)** devido à complexidade crítica da race condition
</requirements>

## Subtarefas

- [ ] 5.1 Criar testes de integração simulando requisições concorrentes (TDD - Red)
- [ ] 5.2 Unificar SELECT e UPDATE em uma operação atômica usando `OUTPUT INSERTED.*` (TDD - Green)
- [ ] 5.3 Implementar lógica para distinguir "não encontrado" (404) de "não lida" (409) baseado em `rowsAffected`
- [ ] 5.4 Refatorar se necessário (TDD - Refactor)
- [ ] 5.5 Executar os testes e validar o funcionamento

## Detalhes de Implementação

**Arquivo:** `src/modules/inadimplencia/models/notificationsRepository.js` - linhas 275–323

**Correção esperada:**
```sql
-- Unificar em uma única operação atômica:
UPDATE dbo.INAD_NOTIFICACOES
SET DT_EXCLUSAO = SYSUTCDATETIME()
OUTPUT INSERTED.*
WHERE ID = @id
  AND USUARIO_DESTINATARIO = @username
  AND LIDA = 1
  AND DT_EXCLUSAO IS NULL
```

**Lógica de distinção de erros:**
- Se `rowsAffected[0] === 0`, fazer um SELECT separado apenas para distinguir:
  - "não existe" (404) - se não encontrar a notificação
  - "não lida" (409) - se encontrar a notificação mas `LIDA = 0`

## Critérios de Sucesso

- O SELECT e o UPDATE são executados em uma única operação atômica
- Requisições DELETE concorrentes para a mesma notificação não lida não causam race condition
- É possível distinguir corretamente "não encontrado" (404) de "não lida" (409)
- Todos os testes de integração passam

## Testes da Tarefa

- [ ] Teste de integração simulando requisições concorrentes para garantir que apenas uma exclusão ocorre
- [ ] Teste de integração para verificar distinção correta entre "não encontrado" (404) e "não lida" (409)

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>
<critical>PARA ESTA TAREFA HIGH COMPLEXITY, RECOMENDADO SEGUIR PROCESSO RED-GREEN-REFACTOR (TDD) ONDE OS TESTES SÃO CRIADOS ANTES DA IMPLEMENTAÇÃO</critical>

## Arquivos relevantes
- `src/modules/inadimplencia/models/notificationsRepository.js`
- `src/modules/inadimplencia/models/notificationsRepository.test.js`

## Dependências
- Nenhuma
