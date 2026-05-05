# Tarefa 2.0: Utilitários compartilhados (`AppError`, `asyncHandler`, `parseFilters` via TDD)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Implementar os utilitários transversais consumidos por todos os controllers e middlewares do módulo. **Os testes vêm primeiro (red-green-refactor)** porque `parseFilters` concentra toda a validação de query strings dos três endpoints e é o ponto crítico de robustez.

<requirements>
- `utils/AppError.js`: classe estendendo `Error` com `statusCode`, `code` e `details` opcional.
- `utils/asyncHandler.js`: wrapper `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`.
- `utils/parseFilters.js`: três funções públicas — `parseChamadosFilters(query)`, `parseInventarioFilters(query)`, `parseCustosFilters(query)`.
- Cada função retorna objeto com chaves `dataInicio`, `dataFim` e específicas (`status[]`, `tipo`, `tipoOrigem`, `grupo`), ou lança `AppError(400, msg, 'INVALID_FILTER')` em caso inválido.
- Aceitar `data_inicio`/`data_fim` em `YYYY-MM-DD`. Se ambos informados, exigir `dataInicio <= dataFim`.
- `status`: lista CSV; valores aceitos exatamente: `Novo, Atribuido, Planejado, BackLog, Em Validacao, Fechado` (case-sensitive segundo o CASE do SQL).
- `tipo`: `Incidente` ou `Requisicao`.
- `tipoOrigem`: `computer`, `network` ou `line` (lowercase).
- `grupo`: string livre, **trim** e tamanho ≤ 50; rejeitar caracteres `%` e `_` (curinga MySQL) para evitar wildcard injection — eles serão adicionados pelo model.
</requirements>

## Subtarefas

- [ ] 2.1 (RED) Escrever `__tests__/parseFilters.test.js` cobrindo: defaults vazios, datas válidas/inválidas, ordem invertida, status válidos/lista mista, status desconhecido, tipo aceito/recusado, tipo_origem aceito/recusado, grupo com curinga rejeitado, grupo limite de tamanho.
- [ ] 2.2 (RED) Escrever `__tests__/asyncHandler.test.js` cobrindo: handler async resolvido (chama `res`), handler async rejeitado (chama `next(err)`), handler sync que lança (chama `next(err)`).
- [ ] 2.3 (GREEN) Implementar `utils/AppError.js`.
- [ ] 2.4 (GREEN) Implementar `utils/asyncHandler.js`.
- [ ] 2.5 (GREEN) Implementar `utils/parseFilters.js` até todos os testes passarem.
- [ ] 2.6 (REFACTOR) Extrair helpers internos (`parseDate`, `parseEnumList`, `assertNoWildcards`) deduplicando regras entre as três funções públicas.

## Detalhes de Implementação

Ver seção "Estratégia de filtros (SQL)" e "Interfaces Principais" do `techspec.md`. Reutilizar a forma do `AppError` exemplificada em `src/modules/estoque-online/types/errors.ts`, mas em JS.

## Critérios de Sucesso

- `npm run test:run -- src/modules/glpi/__tests__` 100% verde.
- Cobertura ≥ 90% em `utils/parseFilters.js` (medida com `npm run test:coverage`).
- Nenhum teste depende de banco ou rede.
- Zero uso de `eval`, regex insegura ou concatenação direta dos filtros em SQL.

## Testes da Tarefa

- [ ] Testes de unidade — `parseFilters.test.js` (≥ 15 cenários) e `asyncHandler.test.js` (3 cenários).
- [ ] Testes de integração — não aplicável (utilitários puros).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\utils\AppError.js`
- `c:\api-inadimplencia\src\modules\glpi\utils\asyncHandler.js`
- `c:\api-inadimplencia\src\modules\glpi\utils\parseFilters.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\parseFilters.test.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\asyncHandler.test.js`
- Referência: `c:\api-inadimplencia\src\modules\estoque-online\utils\asyncHandler.ts`
