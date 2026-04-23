# Tarefa 4.0: Backend — Catálogo do script "Alteração de Data" no Swagger

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

O backend já aceita qualquer string em `STATUS_OCORRENCIA`. Esta task apenas **documenta** o novo valor `"Alteração de Data"` como parte do enum sugerido no Swagger, sem quebrar retrocompatibilidade (o campo continua sendo string livre).

<requirements>
- Não alterar validação do controller (continua aceitando qualquer string).
- Atualizar Swagger para informar o enum ampliado em `/ocorrencias` (POST e PUT).
- Garantir que o texto "Alteração de Data" seja exatamente igual ao do FE (`OCCURRENCE_STATUS_OPTIONS`).
</requirements>

## Subtarefas

- [ ] 4.1 Atualizar `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js` para incluir o enum ampliado em `STATUS_OCORRENCIA` na descrição dos endpoints POST/PUT de `/ocorrencias`.
- [ ] 4.2 Validar que o Swagger renderiza a lista completa (todos os scripts + "Alteração de Data").

## Detalhes de Implementação

Referência: seção **Funcionalidades Principais → 3. Script de ocorrência "Alteração de Data"** do `prd.md`.

## Critérios de Sucesso

- Swagger mostra "Alteração de Data" no enum informativo de `STATUS_OCORRENCIA`.
- Chamadas antigas continuam funcionando sem mudança.

## Testes da Tarefa

- [ ] Teste de unidade: assert de presença da string no spec OpenAPI.
- [ ] Teste de integração: POST `/ocorrencias` com `STATUS_OCORRENCIA: "Alteração de Data"` retorna `201`.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js`
