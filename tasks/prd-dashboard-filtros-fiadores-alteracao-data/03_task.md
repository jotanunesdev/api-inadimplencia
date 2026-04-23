# Tarefa 3.0: Backend — Filtro `dataInicio/dataFim` nos 9 endpoints de ocorrências do Dashboard

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Introduzir um filtro opcional `?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` em 9 endpoints do Dashboard, preservando compatibilidade total com chamadas atuais (sem parâmetros ⇒ comportamento idêntico). Seguir **TDD red-green-refactor**: criar primeiro os testes (controllers + models), vê-los falhar, implementar e refatorar.

Endpoints afetados:

- `/dashboard/ocorrencias`, `/dashboard/ocorrencias-por-usuario`, `/dashboard/ocorrencias-por-venda`, `/dashboard/ocorrencias-por-dia`, `/dashboard/ocorrencias-por-hora`, `/dashboard/ocorrencias-por-dia-hora`, `/dashboard/proximas-acoes-por-dia`, `/dashboard/acoes-definidas`, `/dashboard/atendentes-proxima-acao`.

<requirements>
- Criar helper central `parseDateRange(query)` em `@c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js`.
- Aplicar filtro SQL via `AND <alias>.DT_OCORRENCIA BETWEEN @dataInicio AND @dataFim` (ou equivalente com tempo — ver "Riscos Conhecidos" do techspec).
- Parametrizar com `sql.Date`.
- Retornar `400` quando apenas um dos dois parâmetros for informado ou formato invalido ou `dataFim < dataInicio`.
- Atualizar Swagger dos 9 endpoints com os dois query params.
- Seguir TDD (testes primeiro).
</requirements>

## Subtarefas

- [ ] 3.1 Escrever testes de unidade de `parseDateRange` (vários cenários de entrada válida/invalida). RED.
- [ ] 3.2 Implementar `helpers/dateRange.js` até os testes passarem. GREEN.
- [ ] 3.3 Escrever testes de unidade dos 9 métodos do `dashboardModel.js` (verificar SQL gerado com e sem range, via spy). RED.
- [ ] 3.4 Refatorar `dashboardModel.js` para aceitar `{ dataInicio, dataFim, hasRange }` e concatenar o predicate seguro (ou `AND 1=1` quando ausente). GREEN + REFACTOR.
- [ ] 3.5 Escrever testes de integração HTTP nos 9 endpoints (com e sem query). RED.
- [ ] 3.6 Atualizar `dashboardController.js` para invocar `parseDateRange` e repassar ao model. GREEN.
- [ ] 3.7 Atualizar `swagger.js` com os dois parâmetros query (`dataInicio`, `dataFim`, formato `date`).
- [ ] 3.8 Testar manualmente no Swagger UI.

## Detalhes de Implementação

Referência completa: seções **Design de Implementação → Endpoints de API** e **Considerações Técnicas → Riscos Conhecidos** do `techspec.md`.

## Critérios de Sucesso

- Chamadas atuais sem querystring não mudam resposta.
- Chamadas com `?dataInicio=2026-04-01&dataFim=2026-04-15` retornam subconjunto coerente.
- `?dataInicio=2026-04-15&dataFim=2026-04-01` retorna `400`.
- Somente `?dataInicio=...` retorna `400`.
- Swagger mostra os dois parâmetros nos 9 endpoints.

## Testes da Tarefa

- [ ] Testes de unidade: `parseDateRange` (8+ cenários) e `dashboardModel` (1 cenário com range + 1 sem, por método → 18 testes).
- [ ] Testes de integração: 9 endpoints, cada um com 3 cenários (sem filtro, com filtro válido, com filtro invalido).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js`
