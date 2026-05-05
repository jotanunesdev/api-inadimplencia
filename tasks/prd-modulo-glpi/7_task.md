# Tarefa 7.0: Fábrica `createGlpiModule()`, CORS escopado e bootstrap standalone

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Empacotar o módulo em uma fábrica `createGlpiModule()` (`index.js`) que aplica CORS escopado a `/glpi/*` (via `createCorsOptionsDelegate` + `isRequestAllowed` de `src/shared/swaggerAccess.js`), monta as rotas e devolve `{ router, openapi }`. Também criar `server.js` para bootstrap standalone (`tsx src/modules/glpi/server.js`). Esta tarefa é o ponto de validação **fim a fim**: testes de integração com `supertest` cobrem os 3 endpoints mockando o pool.

<requirements>
- `index.js`: exportar `createGlpiModule()` retornando `{ router, openapi }`. Aplicar CORS antes das rotas; bloquear origem não permitida com 403 `FORBIDDEN_ORIGIN`. Concluir com `notFound` e `errorHandler`.
- Padrão idêntico ao de `src/modules/estoque-online/index.js`, mas em CommonJS.
- `server.js`: criar app Express, montar `createGlpiModule().router` em `/glpi`, expor `/health` raiz e `/docs` via `swagger-ui-express`. Listar em `process.env.PORT || 4010`.
- Logs do bootstrap: imprimir `Modulo GLPI standalone na porta X` ou warning quando `!env.isConfigured`.
</requirements>

## Subtarefas

- [ ] 7.1 Implementar `index.js` (fábrica) reutilizando `swaggerAccess`.
- [ ] 7.2 Implementar `server.js` standalone.
- [ ] 7.3 Criar `__tests__/integration.test.js` com `supertest`: `app = createGlpiModule()` montado em `/glpi`, mockando `getPool` para simular `mysql2`. Cenários: 200 nos três endpoints, 400 com query inválida, 503 com `GLPI_ENABLED=false`, 403 com origem não autorizada quando CORS_ORIGIN é restritivo.
- [ ] 7.4 Validar manualmente `npm run dev:glpi` em terminal e bater os três endpoints com `curl`.

## Detalhes de Implementação

Ver "Componentes a criar" e "Configuração `.env`" do `techspec.md`. Espelhar `src/modules/estoque-online/index.js` para o padrão de CORS+isRequestAllowed.

## Critérios de Sucesso

- `createGlpiModule()` retorna router montável em qualquer app Express.
- Testes de integração 100% verdes (com `mysql2` mockado).
- `npm run dev:glpi` sobe servidor standalone e responde nos três endpoints.
- Origem fora do `GLPI_CORS_ORIGIN` recebe 403; sem header `Origin` (ex: `curl`) passa.

## Testes da Tarefa

- [ ] Testes de unidade — não aplicável (apenas wiring).
- [ ] Testes de integração — `integration.test.js` cobrindo CORS, status, formatos.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\index.js`
- `c:\api-inadimplencia\src\modules\glpi\server.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\integration.test.js`
- Referência: `c:\api-inadimplencia\src\modules\estoque-online\index.js`
- Referência: `c:\api-inadimplencia\src\shared\swaggerAccess.js`
- Dependências: tarefas 1.0–6.0
