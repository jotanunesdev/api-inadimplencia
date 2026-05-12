# Tarefa 8.0: Rotas/controllers, wiring no modulo e documentacao OpenAPI

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Expor a integracao Serasa PEFIN via HTTP no modulo `inadimplencia`, criando rotas/controllers, montando no app modular e legacy, e documentando todos os endpoints internos e webhooks no Swagger.

<requirements>
- Criar `src/modules/inadimplencia/controllers/serasaPefinController.js`.
- Criar `src/modules/inadimplencia/routes/serasaPefinRoutes.js`.
- Montar o router em `src/modules/inadimplencia/index.js` sob `/serasa-pefin`.
- Montar o router em `src/modules/inadimplencia/legacyApp.js` mantendo compatibilidade standalone.
- Endpoints obrigatorios:
  - `GET /inadimplencia/serasa-pefin/vendas/:numVenda/preview`
  - `POST /inadimplencia/serasa-pefin/vendas/:numVenda/negativacoes`
  - `GET /inadimplencia/serasa-pefin/vendas/:numVenda/negativacoes`
  - `GET /inadimplencia/serasa-pefin/negativacoes/:id`
  - `POST /inadimplencia/serasa-pefin/webhooks/inclusao/sucesso`
  - `POST /inadimplencia/serasa-pefin/webhooks/inclusao/erro`
  - `POST /inadimplencia/serasa-pefin/webhooks/avalista/sucesso`
  - `POST /inadimplencia/serasa-pefin/webhooks/avalista/erro`
- Controllers devem validar parametros HTTP, preservar envelope `{ data }`, retornar `400` acionavel quando entrada for invalida e delegar erros inesperados com `next(err)`.
- Webhooks devem aceitar chamadas server-to-server sem `Origin`, aproveitando o `originGuard` existente.
- Atualizar `src/modules/inadimplencia/swagger.js` com schemas, parametros, exemplos e respostas.
- Nao expor credenciais, Bearer Token, Basic ou segredo em resposta/documentacao.
</requirements>

## Subtarefas

- [ ] 8.1 Revisar `prd.md`, `techspec.md` e controllers/routes existentes do modulo.
- [ ] 8.2 Implementar controller com metodos de preview, envio, historico, detalhe e webhook.
- [ ] 8.3 Implementar router com os oito endpoints definidos.
- [ ] 8.4 Montar router em `index.js` e `legacyApp.js`.
- [ ] 8.5 Garantir parsing/validacao de `numVenda`, `id`, body de envio e body de webhook.
- [ ] 8.6 Atualizar Swagger com tags, paths, schemas e exemplos de erro.
- [ ] 8.7 Criar testes de controller/rota com service fake.
- [ ] 8.8 Executar testes de Swagger/OpenAPI se houver cobertura existente para o modulo.

## Detalhes de Implementacao

Seguir as secoes "Endpoints de API", "Conformidade com Padroes" e "Arquivos relevantes e dependentes" do `techspec.md`. Controllers nao devem conter SQL nem detalhes de fetch Serasa; eles apenas traduzem HTTP para chamadas de service.

As respostas devem seguir o padrao do codebase: sucesso em `{ data }`, erro em `{ error }`, e erros inesperados encaminhados ao `errorHandler`.

## Criterios de Sucesso

- Todos os endpoints previstos respondem no modo modular e no modo legacy/standalone.
- Controllers nao expõem segredos nem payload sensivel desnecessario.
- OpenAPI permite entender preview, envio, historico, detalhe e webhooks.
- Webhooks server-to-server sem `Origin` passam pelo guard existente.
- Testes garantem wiring basico das rotas e envelopes de resposta.

## Testes da Tarefa

- [ ] Testes de unidade: controller com service fake para sucesso, `400`, `404`/dominio e erro inesperado via `next`.
- [ ] Testes de integracao: supertest no app/router para os oito endpoints, incluindo webhook sem `Origin` e documentacao OpenAPI valida quando houver teste existente.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\controllers\serasaPefinController.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\routes\serasaPefinRoutes.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\index.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\legacyApp.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\swagger.js`
