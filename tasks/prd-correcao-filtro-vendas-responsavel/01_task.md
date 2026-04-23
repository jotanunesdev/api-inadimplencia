# Tarefa 1.0: Backend — Adicionar filtro `dataInicio/dataFim` no endpoint `/vendas-por-responsavel`

<critical>Ler os arquivos de prd.md e techspec.md da pasta `prd-dashboard-filtros-fiadores-alteracao-data` para entender o padrão de filtros de data já implementado</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Adicionar suporte ao filtro de período (dataInicio/dataFim) no endpoint `GET /dashboard/vendas-por-responsavel`, seguindo o mesmo padrão já implementado nos 9 endpoints de ocorrências. O filtro deve ser aplicado no campo `VENCIMENTO_MAIS_ANTIGO` da tabela `DW.fat_analise_inadimplencia_v4`.

<requirements>
- O endpoint deve aceitar `dataInicio` e `dataFim` como query parameters opcionais
- O filtro deve ser aplicado via SQL com `BETWEEN @dataInicio AND @dataFim` no campo `VENCIMENTO_MAIS_ANTIGO`
- Quando os parâmetros não forem informados, manter o comportamento atual (sem filtro de data)
- Validar formato das datas (YYYY-MM-DD) usando o helper `parseDateRange` existente
- Retornar erro 400 se apenas um dos parâmetros for informado ou se dataFim < dataInicio
- Manter retrocompatibilidade — clients atuais sem query params devem continuar funcionando
</requirements>

## Subtarefas

- [ ] 1.1 Modificar `dashboardController.js` — Adicionar `parseDateRange(req.query)` no handler `getVendasPorResponsavel` e passar para o model
- [ ] 1.2 Modificar `dashboardModel.js` — Alterar a função `vendasPorResponsavel()` para aceitar `rangeInput` e aplicar filtro em `VENCIMENTO_MAIS_ANTIGO`
- [ ] 1.3 Adicionar testes de unidade para o controller — Validar parse de datas, erro 400, e chamada ao model com range
- [ ] 1.4 Adicionar testes de unidade para o model — Validar SQL gerado com e sem filtro de data
- [ ] 1.5 Atualizar Swagger — Documentar os query params `dataInicio` e `dataFim` no endpoint

## Detalhes de Implementação

### Controller (`@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.js`)

Referência aos endpoints já implementados com filtro (ex: `getOcorrenciasPorUsuario` linha 126-134):

```javascript
async function getOcorrenciasPorUsuario(req, res, next) {
  try {
    const range = parseDateRange(req.query);
    const data = await model.ocorrenciasPorUsuario(range);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
```

Aplicar o mesmo padrão em `getVendasPorResponsavel` (linha 54-61).

### Model (`@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.js`)

Referência à função `ocorrenciasPorUsuario` (linha 440-461) que já usa o padrão de filtro:

```javascript
async function ocorrenciasPorUsuario(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('o.DT_OCORRENCIA', range.hasRange);
  // ...
}
```

Para `vendasPorResponsavel` (linha 93-111), usar o campo `f.VENCIMENTO_MAIS_ANTIGO` para o filtro:

```javascript
async function vendasPorResponsavel(rangeInput) {
  const pool = await db.getPool();
  const range = normalizeRange(rangeInput);
  const request = applyDateRangeInputs(pool.request(), range);
  const dateCondition = buildDateRangeCondition('f.VENCIMENTO_MAIS_ANTIGO', range.hasRange);
  // Incluir dateCondition na WHERE clause
}
```

**Importante**: Adicionar `f.VENCIMENTO_MAIS_ANTIGO IS NOT NULL` à condição base para evitar registros sem data.

## Critérios de Sucesso

- [ ] Endpoint aceita `?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` e retorna apenas vendas com `VENCIMENTO_MAIS_ANTIGO` no período
- [ ] Endpoint sem query params continua retornando todas as vendas (comportamento atual)
- [ ] Requisição com apenas um parâmetro retorna 400 com mensagem clara
- [ ] Requisição com `dataFim < dataInicio` retorna 400
- [ ] SQL gerado usa parametrização `sql.Date` (sem concatenação de strings)
- [ ] Swagger atualizado com documentação dos novos parâmetros

## Testes da Tarefa

- [ ] Testes de unidade: `parseDateRange` com parâmetros válidos, inválidos, parciais
- [ ] Testes de unidade: `vendasPorResponsavel` model — verificar SQL gerado via spy/mock
- [ ] Testes de integração: Chamadas HTTP com e sem filtros, validar resposta
- [ ] Testes de integração: Validar erro 400 em casos inválidos

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js` (helper existente)
- `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.test.ts` (testes)
- `@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.test.ts` (testes)
