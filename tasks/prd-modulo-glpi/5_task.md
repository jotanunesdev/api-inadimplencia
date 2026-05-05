# Tarefa 5.0: Endpoint `GET /glpi/custos` (filtro de período + `grupo`)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Implementar a listagem de custos lançados em chamados pelas equipes terceiras (DW/DECODIFICAR/ESSOLUCAO). A consulta oficial já filtra por essas três empresas e por `custo_total <> 0` — **manter intacta**. Filtros novos opcionais: período em `data_atendimento` e `grupo` (substring extra dentro da allowlist).

<requirements>
- `models/custosModel.js`: `listCustos(filters)`.
- `controllers/custosController.js`: `getCustos(req, res)`.
- `router.get('/custos', ensureConfigured, asyncHandler(getCustos))`.
- Subquery base = SQL oficial de custos (preserva `WHERE GPO.name LIKE '%DW%' OR ... AND BASE.custo_total <> 0`).
- Filtros opcionais externos: `BASE.data_atendimento >= ?`, `BASE.data_atendimento < DATE_ADD(?, INTERVAL 1 DAY)`, `BASE.GRUPO LIKE CONCAT('%', ?, '%')`.
- `parseCustosFilters` da tarefa 2.0 já garante que `grupo` não contém `%`/`_` — model só passa o valor.
- Mesmo tratamento de erro 503 das tarefas anteriores.
</requirements>

## Subtarefas

- [ ] 5.1 Criar `__tests__/custosModel.test.js` com cenários: sem filtros, com período, com `grupo='DW'`, com período + grupo.
- [ ] 5.2 Implementar `models/custosModel.js` com `buildCustosSql` (helper) e `listCustos`.
- [ ] 5.3 Implementar `controllers/custosController.js` (formato `{ data, count, filters }`).
- [ ] 5.4 Adicionar a rota em `routes/index.js`.
- [ ] 5.5 Smoke `curl 'http://localhost:PORT/glpi/custos?data_inicio=2025-01-01&grupo=DW'`.

## Detalhes de Implementação

Consulta oficial em `prd.md` (Custos). `techspec.md` ("Estratégia de filtros (SQL)") detalha o uso de `LIKE CONCAT('%', ?, '%')` para o filtro de grupo.

## Critérios de Sucesso

- Testes unit verdes.
- `GET /glpi/custos` retorna 200 mantendo a regra fixa do SQL original (apenas DW/DECODIFICAR/ESSOLUCAO, custo ≠ 0).
- `GET /glpi/custos?grupo=DW` afunila ainda mais a saída sem alterar a allowlist do SQL original.
- `GET /glpi/custos?data_inicio=2025-13-40` retorna 400.

## Testes da Tarefa

- [ ] Testes de unidade — `custosModel.test.js` (SQL e params), `custosController.test.js` (formato e 400).
- [ ] Testes de integração — opcional contra MySQL.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\models\custosModel.js`
- `c:\api-inadimplencia\src\modules\glpi\controllers\custosController.js`
- `c:\api-inadimplencia\src\modules\glpi\routes\index.js` (acrescentar rota)
- `c:\api-inadimplencia\src\modules\glpi\__tests__\custosModel.test.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\custosController.test.js`
- Dependências: tarefas 1.0, 2.0
