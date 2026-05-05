# Tarefa 6.0: `ensureConfigured`, `/glpi/health` e tratamento global de erros

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Adicionar o middleware que bloqueia chamadas quando o módulo está desabilitado/desconfigurado, o endpoint `/glpi/health`, o middleware `notFound` e o `errorHandler` global do módulo. Esses componentes garantem respostas consistentes em todos os cenários.

<requirements>
- `middlewares/ensureConfigured.js`: 503 com `{ error: 'Modulo GLPI nao configurado.', code: 'GLPI_NOT_CONFIGURED', missingRequired }` quando `!env.isConfigured`. 503 com `code: 'GLPI_DISABLED'` quando `env.ENABLED === false`.
- `middlewares/notFound.js`: 404 `{ error: 'Endpoint nao encontrado' }`.
- `middlewares/errorHandler.js`: respeita `err.statusCode` + `err.code`; mapeia erros mysql2 (`ECONNREFUSED`, `ETIMEDOUT`, `PROTOCOL_CONNECTION_LOST`, `ER_ACCESS_DENIED_ERROR`) para 503 `DB_UNAVAILABLE`. Logger em modo erro com mensagem técnica e stack; resposta sem stack.
- `controllers/healthController.js`: retorna `{ status, configured, enabled, missingRequired, dbReachable, timestamp }`. Status 200 quando tudo ok, 503 caso contrário. `dbReachable` vem de `pingPool()` (criado na tarefa 1.0).
- Registrar `router.get('/health', asyncHandler(getHealth))` **antes** de `ensureConfigured` (saúde sempre acessível).
</requirements>

## Subtarefas

- [ ] 6.1 Implementar `middlewares/ensureConfigured.js`.
- [ ] 6.2 Implementar `middlewares/notFound.js`.
- [ ] 6.3 Implementar `middlewares/errorHandler.js` com mapa de códigos mysql2.
- [ ] 6.4 Implementar `controllers/healthController.js` consumindo `pingPool()`.
- [ ] 6.5 Registrar `/health` em `routes/index.js`.
- [ ] 6.6 Criar `__tests__/middlewares.test.js` cobrindo: `ensureConfigured` quando `!isConfigured` (503), quando `enabled=false` (503), quando ok (next chamado); `errorHandler` mapeando `ECONNREFUSED` para 503.
- [ ] 6.7 Criar `__tests__/healthController.test.js` mockando `pingPool` (sucesso e falha).

## Detalhes de Implementação

Ver "Pontos de Integração" e "Riscos Conhecidos" no `techspec.md`. Para o mapa de erros mysql2, basear-se nos códigos publicados na FAQ oficial (`/sidorares/node-mysql2`).

## Critérios de Sucesso

- `GET /glpi/health` responde 200 quando configurado e DB acessível, 503 caso contrário com `dbReachable: false`.
- Qualquer rota `/glpi/*` (exceto `/health`) responde 503 quando `GLPI_ENABLED=false` no `.env`.
- Erro de conexão MySQL nunca expõe host/usuário no body.
- Testes unit dos middlewares e do health 100% verdes.

## Testes da Tarefa

- [ ] Testes de unidade — `middlewares.test.js`, `healthController.test.js`.
- [ ] Testes de integração — exercitar `/glpi/health` via supertest na tarefa 7.0.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\middlewares\ensureConfigured.js`
- `c:\api-inadimplencia\src\modules\glpi\middlewares\notFound.js`
- `c:\api-inadimplencia\src\modules\glpi\middlewares\errorHandler.js`
- `c:\api-inadimplencia\src\modules\glpi\controllers\healthController.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\middlewares.test.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\healthController.test.js`
- Dependências: tarefas 1.0, 2.0
