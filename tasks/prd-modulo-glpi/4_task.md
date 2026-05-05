# Tarefa 4.0: Endpoint `GET /glpi/inventario` (UNION ALL com filtro `tipo_origem`)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Implementar a listagem unificada de inventário (Computadores, Equipamentos de Rede, Linhas). Quando `tipo_origem` é informado, **somente o sub-SELECT correspondente é executado** (sem UNION) para reduzir I/O. Coluna literal `origem` é injetada em cada sub-SELECT para o consumidor distinguir a fonte. Abordagem TDD por ser HIGH.

<requirements>
- `models/inventarioModel.js`: função `listInventario(filters)`.
- `controllers/inventarioController.js`: `getInventario(req, res)` análogo ao de chamados.
- Adicionar `router.get('/inventario', ensureConfigured, asyncHandler(getInventario))`.
- Cada sub-SELECT (Computer/NetworkEquipment/Line) ganha coluna literal `'<Origem>' AS origem`.
- Filtros: `data_inicio`/`data_fim` aplicados em `date_creation`. Linhas (`glpi_lines`) não têm `last_inventory_update` — manter `'' AS last_inventory_update` conforme SQL original.
- Sem `tipo_origem`: executar UNION ALL completo.
- Com `tipo_origem`: executar somente o SELECT correspondente.
- `is_deleted = 0` mantido em todas as fontes.
- Mesmo tratamento de erro mysql2 → 503 da tarefa 3.0.
</requirements>

## Subtarefas

- [ ] 4.1 (RED) `__tests__/inventarioModel.test.js`: helper `buildInventarioSql(filters)` deve retornar 1 SELECT quando `tipoOrigem` informado e 3 unidos por UNION ALL caso contrário; validar ordem de placeholders.
- [ ] 4.2 (RED) `__tests__/inventarioController.test.js`: 200 com `data/count/filters`, 400 para `tipo_origem` inválido.
- [ ] 4.3 (GREEN) Implementar `models/inventarioModel.js` exportando `listInventario` e `buildInventarioSql` (helper).
- [ ] 4.4 (GREEN) Implementar `controllers/inventarioController.js`.
- [ ] 4.5 (GREEN) Adicionar a rota em `routes/index.js`.
- [ ] 4.6 Smoke `curl 'http://localhost:PORT/glpi/inventario?tipo_origem=computer&data_inicio=2024-01-01'`.
- [ ] 4.7 (REFACTOR) Extrair os 3 fragments para constantes nomeadas (`SELECT_COMPUTERS`, `SELECT_NETWORK`, `SELECT_LINES`) com placeholders documentados em comentário acima de cada bloco.

## Detalhes de Implementação

Consulta oficial está em `prd.md` (Inventário). `techspec.md` detalha a otimização do `tipo_origem` em "Estratégia de filtros (SQL)". Para `glpi_lines` o `users_id` referencia usuários — manter o LEFT JOIN exatamente como no original; o campo `last_inventory_update` continua string vazia.

## Critérios de Sucesso

- Testes unit verdes.
- `GET /glpi/inventario` retorna 200 com mistura das três fontes ordenadas conforme implementação.
- `GET /glpi/inventario?tipo_origem=network` retorna apenas equipamentos de rede e SQL gerado é um único SELECT.
- `GET /glpi/inventario?tipo_origem=invalido` retorna 400.
- Coluna `origem` presente em todos os registros do retorno.

## Testes da Tarefa

- [ ] Testes de unidade — `inventarioModel.test.js` (validar SQL e params), `inventarioController.test.js` (formato e 400).
- [ ] Testes de integração — opcional contra MySQL com fixture mínimo.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\models\inventarioModel.js`
- `c:\api-inadimplencia\src\modules\glpi\controllers\inventarioController.js`
- `c:\api-inadimplencia\src\modules\glpi\routes\index.js` (acrescentar rota)
- `c:\api-inadimplencia\src\modules\glpi\__tests__\inventarioModel.test.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\inventarioController.test.js`
- Dependências: tarefas 1.0, 2.0
