# Tarefa 3.0: Endpoint `GET /glpi/chamados` (model + controller + rota)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Implementar o primeiro endpoint produtivo: listagem de chamados do GLPI. A consulta oficial fica intacta como **subquery base** dentro de um `SELECT * FROM (<oficial>) t WHERE 1=1 AND ...` que adiciona filtros opcionais via placeholders `?`. **Abordagem TDD** (red-green-refactor) por ser HIGH: escrever testes do builder de SQL antes da implementação para travar o contrato (zero injection, zero quebra da consulta original).

<requirements>
- `models/chamadosModel.js`: função `listChamados(filters)` que retorna `Promise<Row[]>`.
- `controllers/chamadosController.js`: função `getChamados(req, res)` que chama `parseChamadosFilters`, delega ao model, devolve `{ data, count, filters }`.
- `routes/index.js`: registrar `router.get('/chamados', ensureConfigured, asyncHandler(getChamados))`.
- A query oficial de chamados (do `prd.md`) entra **literal** como subquery — sem alterações de regra de negócio.
- Filtros opcionais aplicados na query externa: `data_abertura >= ?`, `data_abertura < DATE_ADD(?, INTERVAL 1 DAY)`, `FIND_IN_SET(status, ?)`, `tipo = ?`.
- Todos os valores via `pool.execute(sql, params)` — **nenhuma** concatenação de valor.
- `pool.execute` deve receber `{ timeout: env.QUERY_TIMEOUT_MS }`.
- Erros do mysql2 (`ECONNREFUSED`, `ETIMEDOUT`, `ER_*`) mapeados para `AppError(503, 'Banco GLPI indisponivel.', 'DB_UNAVAILABLE')`.
- Resultado preserva os nomes de colunas em PT (`titulo`, `solicitante`, `grupo_equipe`, `grupo_empresa`, `nome_tecnico`, `etiqueta`, etc.).
- Logar `{ module: 'glpi', endpoint: 'chamados', durationMs, rowCount }` ao final.
</requirements>

## Subtarefas

- [ ] 3.1 (RED) Criar `__tests__/chamadosModel.test.js` que importa um helper interno `buildChamadosSql(filters)` e valida o SQL gerado e os params para 4 cenários: sem filtros, só período, só status (lista), combinação completa.
- [ ] 3.2 (RED) Criar `__tests__/chamadosController.test.js` mockando o model — verifica formato `{ data, count, filters }` e 400 para query inválida.
- [ ] 3.3 (GREEN) Implementar `models/chamadosModel.js` com `buildChamadosSql` exportável (helper interno) + `listChamados`.
- [ ] 3.4 (GREEN) Implementar `controllers/chamadosController.js`.
- [ ] 3.5 (GREEN) Criar `routes/index.js` registrando a rota (rotas de inventário/custos virão nas próximas tarefas).
- [ ] 3.6 Smoke manual: rodar `npm run dev:glpi` (após tarefa 7.0) e executar `curl 'http://localhost:PORT/glpi/chamados?data_inicio=2025-01-01&data_fim=2025-01-31&tipo=Incidente'` documentando saída no `progress.txt` da pasta tasks (caso precise rastrear).
- [ ] 3.7 (REFACTOR) Mover o WHERE-builder para `utils/sqlFilters.js` se outros endpoints reaproveitarem.

## Detalhes de Implementação

Ver "Estratégia de filtros (SQL)" e "Componentes a criar" no `techspec.md`. A consulta oficial está integralmente em `prd.md` (seção Funcionalidades Principais — Chamados). Não alterar a regra de exclusão de `priscilla.ribeiro`/`fabio.machado` nem `is_deleted = 0`.

## Critérios de Sucesso

- Testes unit de `chamadosModel` e `chamadosController` 100% verdes.
- `GET /glpi/chamados` retorna 200 com payload `{ data, count, filters }` quando o banco está acessível.
- `GET /glpi/chamados?data_inicio=invalida` retorna 400 com `code: 'INVALID_FILTER'`.
- Banco indisponível devolve 503 `code: 'DB_UNAVAILABLE'` (sem stack/credencial no body).
- Inspeção manual do SQL gerado mostra apenas placeholders `?` (sem interpolação de valores).

## Testes da Tarefa

- [ ] Testes de unidade — `chamadosModel.test.js` (4+ cenários de SQL/params), `chamadosController.test.js` (formato resposta, 400, 503).
- [ ] Testes de integração — opcional: contra MySQL local com fixture pequeno; documentar como rodar mas não bloquear o merge.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\models\chamadosModel.js`
- `c:\api-inadimplencia\src\modules\glpi\controllers\chamadosController.js`
- `c:\api-inadimplencia\src\modules\glpi\routes\index.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\chamadosModel.test.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\chamadosController.test.js`
- Dependências: tarefa 1.0 (config/db) e tarefa 2.0 (utils)
