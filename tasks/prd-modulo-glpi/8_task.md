# Tarefa 8.0: Wire-up no app principal (`src/app.js` + `unifiedOpenapi.js`)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Integrar o módulo GLPI ao bootstrap unificado da API. Após esta tarefa, `tsx src/server.js` expõe `/glpi/*`, `/docs-json/glpi` e o módulo aparece no Swagger UI principal.

<requirements>
- `src/app.js`: importar `createGlpiModule`, instanciar (`const glpiModule = createGlpiModule();`), montar com `app.use('/glpi', glpiModule.router);` e expor `app.get('/docs-json/glpi', ...)`.
- `src/docs/unifiedOpenapi.js`: criar `buildGlpiOpenapi(openapi)` (mesmo padrão dos outros módulos) e incluir em `buildUnifiedOpenapi(...)`.
- Adicionar entrada `{ url: '/docs-json/glpi', name: '/glpi' }` no array `urls` do `swagger-ui-express` em `src/app.js`.
- Manter ordem alfabética/lógica entre os módulos no `app.js` (sugestão: imediatamente antes de `auth` ou após `entrada-nota-fiscal`).
</requirements>

## Subtarefas

- [ ] 8.1 Editar `src/docs/unifiedOpenapi.js` adicionando `buildGlpiOpenapi` e somando o openapi do GLPI ao unificado.
- [ ] 8.2 Editar `src/app.js` para importar, instanciar, montar e expor `/docs-json/glpi`.
- [ ] 8.3 Atualizar o array de `urls` do swagger-ui.
- [ ] 8.4 Criar `__tests__/appWireup.test.js` (na pasta do módulo) com `supertest` carregando `src/app.js` e validando: `GET /glpi/health` retorna 200, `GET /docs-json/glpi` retorna JSON OpenAPI válido, `GET /docs-json` inclui as paths do GLPI.

## Detalhes de Implementação

Ver "Componentes a modificar" do `techspec.md`. Espelhar 100% o padrão do bloco já existente para `estoque-online` no `app.js`.

## Critérios de Sucesso

- `tsx src/server.js` sobe sem erros.
- `curl http://localhost:PORT/glpi/health` responde 200/503 conforme `.env`.
- Swagger UI em `/docs` lista `/glpi` no dropdown.
- `__tests__/appWireup.test.js` 100% verde.

## Testes da Tarefa

- [ ] Testes de unidade — não aplicável.
- [ ] Testes de integração — `appWireup.test.js` validando rotas e Swagger no app unificado.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\app.js`
- `c:\api-inadimplencia\src\docs\unifiedOpenapi.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\appWireup.test.js`
- Dependências: tarefas 1.0–7.0
