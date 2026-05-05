# Tarefa 9.0: Swagger/OpenAPI do módulo GLPI

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Construir a especificação OpenAPI 3.0 completa do módulo GLPI em `src/modules/glpi/docs/openapi.js`, servida em `/docs-json/glpi` e exibida no Swagger UI unificado da `api-inadimplencia`. A spec é a **fonte de verdade do contrato** consumida por dashboards, BI e Power Apps — precisa ser fiel aos modelos retornados pelas tarefas 3.0–6.0 e bloquear semanticamente qualquer método que não seja `GET` (regra explícita do PRD).

<requirements>
- Arquivo `src/modules/glpi/docs/openapi.js` exportando objeto OpenAPI 3.0.x válido em CommonJS (`module.exports = openapi`).
- Bloco `info` com `title: 'API GLPI - JotaNunes'`, `version` (alinhado ao `package.json`), `description` resumindo o módulo, `contact` (TI JotaNunes).
- Bloco `servers` com pelo menos `{ url: '/glpi', description: 'Prefixo padrao na api-inadimplencia' }` e opcionalmente o standalone (`http://localhost:4010/glpi`).
- Bloco `tags`: `Health`, `Chamados`, `Inventario`, `Custos`.
- Paths obrigatórios — **somente método `get`**:
  - `/health`
  - `/chamados`
  - `/inventario`
  - `/custos`
- Para cada path documentar todos os query params com `name`, `in: query`, `required: false`, `schema` tipado e `description` em PT-BR. Datas como `string`/`format: date` (`YYYY-MM-DD`); `status` como `array` com `style: form, explode: false` (CSV) e `enum`; `tipo`, `tipo_origem` com `enum`; `grupo` como `string` com `maxLength: 50`.
- Bloco `components.schemas` com:
  - `EnvelopeResposta<T>` — wrapper `{ data: T[], count: integer, filters: object }` (representado como schema reutilizável usando `allOf`).
  - `Chamado`, `InventarioItem`, `Custo` — todos os campos retornados pelas consultas oficiais (ver `prd.md`), com `nullable: true` onde necessário, datas como `string` (formato `YYYY-MM-DD HH:MM:SS`), valores numéricos como `number`/`integer`.
  - `Erro` — `{ error: string, code: string, missingRequired?: string[] }`.
- Bloco `components.responses` reutilizáveis: `BadRequest` (400), `ServiceUnavailable` (503), `Forbidden` (403).
- `components.securitySchemes` vazio (módulo não usa JWT/API key) e descrição clara em `info.description` informando que a proteção é via CORS allowlist.
- O JSON precisa passar em validação OpenAPI 3.0.x sem warnings (validar manualmente no https://editor.swagger.io).
</requirements>

## Subtarefas

- [ ] 9.1 Esboçar a estrutura geral (`info`, `servers`, `tags`, `components`) revisando o que outros módulos (`estoque-online`, `m365`) já fazem para manter consistência visual no Swagger UI agregado.
- [ ] 9.2 Escrever `components.schemas` para `Chamado`, `InventarioItem`, `Custo`, `EnvelopeResposta`, `Erro` — campos exatos das consultas oficiais (`prd.md`).
- [ ] 9.3 Escrever `components.responses` para `BadRequest`, `Forbidden`, `ServiceUnavailable` referenciando `Erro`.
- [ ] 9.4 Escrever os 4 paths com `get`, parâmetros completos e responses (`200` referenciando envelope tipado, `400`, `403`, `503`).
- [ ] 9.5 (RED) Escrever `__tests__/openapi.test.js` validando:
  - Importação do objeto sem erro.
  - `openapi` versão `3.0.x`.
  - Existência das 4 paths obrigatórias.
  - Cada path tem **somente** o verbo `get` (asserir que `post`, `put`, `patch`, `delete` são `undefined`).
  - Schemas `Chamado`, `InventarioItem`, `Custo`, `EnvelopeResposta`, `Erro` definidos em `components.schemas`.
  - `info.title` e `info.version` preenchidos.
- [ ] 9.6 (GREEN) Ajustar `docs/openapi.js` até todos os asserts passarem.
- [ ] 9.7 Validar o JSON exportado em https://editor.swagger.io (copiar e colar) e corrigir eventuais warnings.
- [ ] 9.8 Confirmar visualmente no Swagger UI raiz (`/docs`, dropdown `/glpi`) que os 4 endpoints aparecem com schemas corretos e o botão "Try it out" funciona em ambiente de dev.
- [ ] 9.9 Garantir que a fábrica `createGlpiModule()` (tarefa 7.0) devolva exatamente este objeto em `module.openapi` e que `buildGlpiOpenapi` (tarefa 8.0) o utilize.

## Detalhes de Implementação

Ver "Modelos de Dados (resposta JSON)", "Endpoints de API" e "Configuração `.env`" no `techspec.md`. Os campos de cada schema vêm das consultas oficiais em `prd.md` (seção Funcionalidades Principais). Estrutura visual: replicar o estilo de `src/modules/estoque-online/docs/openapi.ts` adaptando para CommonJS.

Diretrizes de schema:
- Datas vêm como string ISO simplificada (`YYYY-MM-DD HH:MM:SS`) por causa de `dateStrings: true` no pool. Documentar em cada campo de data.
- Campos numéricos do GLPI (`time_to_resolve`, `time_to_own`, `waiting_duration`, `custo`, `custo_total`) → `type: number`, `nullable: true`.
- `status` no `Chamado` é o texto traduzido pelo CASE (`Novo|Atribuido|...`) — usar `enum`.
- `origem` no `InventarioItem` → `enum: ['Computer', 'NetworkEquipment', 'Line']`.

## Critérios de Sucesso

- `GET /docs-json/glpi` retorna OpenAPI 3.0 válido (zero erros no Swagger Editor).
- Swagger UI em `/docs` lista os 4 endpoints do GLPI com schemas tipados visíveis.
- Testes unit de `openapi.test.js` 100% verdes, garantindo ausência de POST/PUT/PATCH/DELETE.
- Schemas dos retornos batem 1:1 com as colunas das consultas oficiais (verificação cruzada com `prd.md`).
- Validação manual no Swagger Editor sem warnings.

## Testes da Tarefa

- [ ] Testes de unidade — `__tests__/openapi.test.js` cobrindo estrutura, paths, ausência de métodos não-GET, presença de schemas.
- [ ] Testes de integração — opcional: teste com `supertest` em cima de `createGlpiModule().router` (ou app unificado) chamando `GET /docs-json/glpi` e comparando com o objeto exportado.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\docs\openapi.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\openapi.test.js`
- Referência: `c:\api-inadimplencia\src\modules\estoque-online\docs\openapi.ts`
- Referência: `c:\api-inadimplencia\src\docs\unifiedOpenapi.js` (tarefa 8.0 já registra o módulo)
- Dependências: tarefas 3.0, 4.0, 5.0, 6.0 (entregam os contratos finais), 7.0 (fábrica devolve `openapi`), 8.0 (wire-up no Swagger raiz)
