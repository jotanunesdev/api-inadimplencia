# Tarefa 2.0: Backend — Recurso Fiadores (`/inadimplencia/fiadores/*`)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Criar o recurso REST `/inadimplencia/fiadores` em três camadas (model/controller/route) seguindo o padrão do módulo (`atendimentos`, `responsaveis`). Dois endpoints:

- `GET /num-venda/:numVenda` → fiadores da venda.
- `GET /cpf/:cpf` → fiadores de vendas cujo `DOCUMENTO` bate com o CPF informado (somente dígitos).

Consulta exclusivamente a view `DW.vw_fiadores_por_venda` (task 1.0).

<requirements>
- Seguir MVC: SQL apenas no model; validação apenas no controller.
- Parametrizar 100% das queries (`sql.Int`, `sql.VarChar`).
- Respostas no envelope `{ data }`; erros no padrão `{ error }`.
- Montar o router tanto em `index.js` quanto em `legacyApp.js`.
- Atualizar `swagger.js` com os dois endpoints + schema `Fiador`.
</requirements>

## Subtarefas

- [ ] 2.1 Criar `@c:/api-inadimplencia/src/modules/inadimplencia/models/fiadoresModel.js` com `findByNumVenda(numVenda)` e `findByCpf(cpf)`.
- [ ] 2.2 Criar `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/fiadoresController.js` validando `numVenda` (`Number.isSafeInteger`) e `cpf` (somente dígitos, 11 ou 14 chars) e retornando `{ data }`.
- [ ] 2.3 Criar `@c:/api-inadimplencia/src/modules/inadimplencia/routes/fiadoresRoutes.js`.
- [ ] 2.4 Registrar o router em `@c:/api-inadimplencia/src/modules/inadimplencia/index.js` e em `@c:/api-inadimplencia/src/modules/inadimplencia/legacyApp.js`.
- [ ] 2.5 Documentar `/fiadores/num-venda/{numVenda}` e `/fiadores/cpf/{cpf}` em `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js` (tag `Fiadores`).
- [ ] 2.6 Escrever testes de unidade para model e controller.
- [ ] 2.7 Escrever teste de integração HTTP (supertest) hit em ambas as rotas.

## Detalhes de Implementação

Referência completa: seção **Design de Implementação** do `techspec.md`.

## Critérios de Sucesso

- `GET /inadimplencia/fiadores/num-venda/20988` retorna lista não-vazia (validar com o exemplo do PRD).
- `GET /inadimplencia/fiadores/num-venda/abc` retorna `400 { error: "numVenda invalido." }`.
- Swagger renderiza a tag `Fiadores` com os dois endpoints.
- Testes passam (`npm test` ou equivalente do módulo).

## Testes da Tarefa

- [ ] Testes de unidade: `fiadoresModel` (mock do pool) + `fiadoresController` (mock do model).
- [ ] Testes de integração: chamada HTTP real nas duas rotas, assert de status + envelope `{ data }`.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/models/fiadoresModel.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/fiadoresController.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/routes/fiadoresRoutes.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/index.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/legacyApp.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js`
