# Tech Spec — Dashboard: Filtro de Período, Fiadores da Venda e Script "Alteração de Data"

> Leia antes: `@c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md` (backend) e `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/documentos/techspec-codebase.md` (frontend). Este documento descreve a implementação específica da feature; padrões e estrutura dos codebases estão nos respectivos `techspec-codebase.md`.

## Resumo Executivo

A entrega combina quatro frentes técnicas independentes que compartilham um único incremento no DW:

1. **Backend — filtro de período**: introduz um helper central `parseDateRange` e modifica 9 models do `dashboardModel.js` para aceitar `dataInicio`/`dataFim` via querystring, aplicando o filtro em `OCORRENCIAS.DT_OCORRENCIA` com parametrização `sql.Date`.
2. **Backend — recurso Fiadores**: novo trio `fiadoresRoutes.js`/`fiadoresController.js`/`fiadoresModel.js` que consulta a view `DW.vw_fiadores_por_venda` (já criada) e expõe dois endpoints (`/num-venda/:numVenda`, `/cpf/:cpf`).
3. **Frontend — filtro + painel**: componentes `DateRangeFilter` (escopo local à seção de ocorrências do Dashboard) e `FiadoresPanel` (integrado em 5 pontos de "abrir a venda"). Hooks `useDashboardDateRange` (para sincronizar com `searchParams`) e `useFiadores(numVenda)`.
4. **Frontend — novo script e i18n**: adiciona o item "Alteração de Data" em `OCCURRENCE_STATUS_OPTIONS` e executa uma varredura textual em todos os `.tsx/.ts` do `src/` corrigindo apenas strings visíveis ao usuário.

O SQL já está aplicado no banco; apenas versionamos os scripts em `docs/sql/` para histórico.

## Arquitetura do Sistema

### Visão Geral dos Componentes

Componentes **novos** (criados):

- **`DW.vw_fiadores_por_venda`** (view SQL — já aplicada): fonte oficial de fiadores por venda consumida pelo backend. Script versionado em `@c:/api-inadimplencia/src/modules/inadimplencia/docs/sql/2026-04-22-fiadores-fat-associados.sql`.
- **`fiadoresModel.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/models/fiadoresModel.js`): camada SQL para leitura dos fiadores. Expõe `findByNumVenda(numVenda)` e `findByCpf(cpf)`.
- **`fiadoresController.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/controllers/fiadoresController.js`): validação de `numVenda` (`Number.isSafeInteger`) e `cpf` (somente dígitos), formatação de resposta padrão `{ data }`.
- **`fiadoresRoutes.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/routes/fiadoresRoutes.js`): registra `GET /num-venda/:numVenda` e `GET /cpf/:cpf` no router `/fiadores`.
- **`helpers/dateRange.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js`): função `parseDateRange(query)` compartilhada. Valida formato, ordem, retorna `{ dataInicio, dataFim, hasRange }` ou lança `HttpError(400)`.
- **`DateRangeFilter.tsx`** (`@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/dateRangeFilter/DateRangeFilter.tsx`): componente controlado com dois inputs de data, presets e botão limpar.
- **`useDashboardDateRange.ts`** (`@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/dashboard/hooks/useDashboardDateRange.ts`): hook que sincroniza estado com `searchParams` (`dtIni`/`dtFim`), expõe `{ range, setRange, clear, toQuery }`.
- **`FiadoresPanel.tsx`** (`@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/fiadores/FiadoresPanel.tsx`): componente reutilizável.
- **`useFiadores.ts`** (`@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/hooks/useFiadores.ts`): hook de fetch + estados.
- **`fiador.ts`** (`@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/types/fiador.ts`): tipos `FiadorRecord`, `FiadorRow`, `FiadorResponse`.

Componentes **modificados**:

- **`dashboardModel.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.js`): 9 funções passam a aceitar `{ dataInicio, dataFim }` e incorporam `AND f.DT_OCORRENCIA BETWEEN @dataInicio AND @dataFim` (alias ajustado por função).
- **`dashboardController.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.js`): 9 handlers invocam `parseDateRange(req.query)` e repassam ao model.
- **`swagger.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js`): documenta `dataInicio`/`dataFim` nos 9 endpoints e acrescenta `/fiadores/*`.
- **`index.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/index.js`): monta o novo router `/fiadores`.
- **`legacyApp.js`** (`@c:/api-inadimplencia/src/modules/inadimplencia/legacyApp.js`): idem (mantém paridade do modo standalone).
- **`DashboardPage.tsx`**: renderiza `<DateRangeFilter>` no topo da seção de ocorrências; passa o estado para os hooks/components dos 9 gráficos.
- **`dashboard/api.ts`**: `fetchDashboard(path, { signal, query })` passa a aceitar um objeto `query` que é serializado para querystring.
- **5 pontos de integração do `FiadoresPanel`**: `TrainingsPage.tsx`, `NoNextActionPage.tsx`, `MyResponsibilityPage.tsx`, `InteractiveCalendar.tsx` (via `EventModal`/`CardModal`), e os modais de drill-down (`aging-detalhes`, `parcelas-detalhes`, `score-saldo-detalhes`) dentro de `DashboardPage.tsx`.
- **`occurrence.ts`** (constants do FE): adiciona `"Alteração de Data"` ao array `OCCURRENCE_STATUS_OPTIONS` (sem template em `OCCURRENCE_STATUS_TEMPLATES`).
- **i18n**: todos os `.tsx/.ts` em `src/` com strings visíveis ao usuário.

### Fluxo de dados (resumo)

- **Filtro de período**: `DateRangeFilter` → `useDashboardDateRange` (URL) → `fetchDashboard(path, { query })` → `GET /dashboard/...?dataInicio=&dataFim=` → `parseDateRange` → model SQL com `BETWEEN`.
- **Fiadores**: `<FiadoresPanel numVenda />` → `useFiadores(numVenda)` → `apiFetch("/fiadores/num-venda/:numVenda")` → `fiadoresController` → `fiadoresModel` → `SELECT ... FROM DW.vw_fiadores_por_venda WHERE NUM_VENDA = @numVenda`.

## Design de Implementação

### Interfaces Principais

```ts
// Frontend: tipo canônico retornado pela API
export type FiadorRecord = {
  NUM_VENDA: number | string
  ID_ASSOCIADO: number | string
  ID_RESERVA?: number | string | null
  ID_PESSOA?: number | string | null
  NOME: string | null
  DOCUMENTO?: string | null
  DATA_CADASTRO?: string | null
  RENDA_FAMILIAR?: number | string | null
  TIPO_ASSOCIACAO?: string | null
  ENDERECO?: string | null
}

// Hook de filtro
export type DashboardDateRange = { dtIni: string | null; dtFim: string | null }
export function useDashboardDateRange(): {
  range: DashboardDateRange
  setRange: (next: DashboardDateRange) => void
  clear: () => void
  toQuery: () => Record<string, string> // { dataInicio, dataFim } ou {}
}
```

```js
// Backend helper
// @/c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js
function parseDateRange(query) {
  // valida YYYY-MM-DD, ordem, exige ambos quando um está presente;
  // retorna { hasRange, dataInicio: Date, dataFim: Date } ou lança Error com statusCode=400
}
module.exports = { parseDateRange }
```

### Modelos de Dados

- **Banco** (já aplicado):
  - `DW.fat_associados_num_venda (ID_ASSOCIADO, ID_RESERVA, ID_PESSOA, NOME, DATA_CADASTRO, DOCUMENTO, RENDA_FAMILIAR, TIPO_ASSOCIACAO, NUM_VENDA, ENDERECO)` — relacionada N:1 com `DW.fat_analise_inadimplencia_v4` por `NUM_VENDA`.
  - `DW.vw_fiadores_por_venda` — view com `INNER JOIN` que retorna somente os associados de vendas existentes no fato.
  - Índice `IX_fat_associados_num_venda__NUM_VENDA` em `(NUM_VENDA)` com `INCLUDE` das colunas usadas pelo SELECT.
- **Contrato HTTP do filtro**: todos os 9 endpoints afetados passam a aceitar `?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD`. Ausência de parâmetros ⇒ comportamento atual. Presença parcial ⇒ `400`.
- **Contrato HTTP dos fiadores**: resposta `{ data: FiadorRecord[] }` (envelope `data`, padrão do módulo). `204` se a venda não existir na `vw_fiadores_por_venda` (sem fiadores).

### Endpoints de API

Novos endpoints:

- `GET /inadimplencia/fiadores/num-venda/:numVenda` → `200 { data: FiadorRecord[] }` | `400` | `404`.
- `GET /inadimplencia/fiadores/cpf/:cpf` → `200 { data: FiadorRecord[] }` (busca via `DOCUMENTO`, dígitos).

Endpoints modificados (filtro opcional `?dataInicio&dataFim`):

- `GET /inadimplencia/dashboard/ocorrencias`
- `GET /inadimplencia/dashboard/ocorrencias-por-usuario`
- `GET /inadimplencia/dashboard/ocorrencias-por-venda`
- `GET /inadimplencia/dashboard/ocorrencias-por-dia`
- `GET /inadimplencia/dashboard/ocorrencias-por-hora`
- `GET /inadimplencia/dashboard/ocorrencias-por-dia-hora`
- `GET /inadimplencia/dashboard/proximas-acoes-por-dia`
- `GET /inadimplencia/dashboard/acoes-definidas`
- `GET /inadimplencia/dashboard/atendentes-proxima-acao`

## Pontos de Integração

- **SQL Server (DW)**: todas as leituras usam `mssql` via `getPool()` com parâmetros tipados (`sql.Int`, `sql.Date`, `sql.VarChar`). Nenhuma concatenação de string com input de usuário.
- **Frontend**: `apiFetch` com base-URL resolvida automaticamente; toggle local/prod continua via `Ctrl+Alt+T`.
- **Sem novas integrações externas.**

## Abordagem de Testes

### Testes Unidade

- **Backend**:
  - `parseDateRange`: casos válidos/invalidos (faltando um dos campos, formato errado, `dataFim < dataInicio`, vazio, com tempo embutido).
  - `fiadoresModel.findByNumVenda` e `findByCpf` com mock do pool (testar ordenação e forma do recordset).
  - `dashboardModel`: para cada um dos 9 métodos modificados, testar SQL gerado com e sem `hasRange` (inspecionar a query passada ao `query()` via spy).
- **Frontend**:
  - `useDashboardDateRange`: leitura/escrita em `searchParams`, validação `dtFim >= dtIni`, aplicação de presets.
  - `DateRangeFilter`: renderiza inputs, dispara `onChange` somente com range válido, limpa.
  - `useFiadores`: sucesso, vazio, erro, abort na desmontagem.
  - `FiadoresPanel`: estados (loading, empty, error, ok), formatação de BRL/data, fallback de renda ≤ 1,00.

### Testes de Integração

- **Backend** (Vitest + pool real em ambiente de teste ou SQL `in-memory`): chamadas HTTP nas rotas novas e nas 9 modificadas, validando status, body e querystring.
- **Frontend** (Vitest + React Testing Library): renderizar `DashboardPage` com stubs de `apiFetch` e verificar que um preset dispara 9 requests com os parâmetros esperados.

### Testes de E2E

- **Playwright MCP** (manual ou automatizado, conforme capacidade):
  - Aplicar preset "7 dias" na seção de ocorrências; validar que o total de cada gráfico muda e que KPIs permanecem idênticos.
  - Abrir uma venda em `TrainingsPage` e verificar o `FiadoresPanel` com dados.
  - Criar ocorrência do tipo "Alteração de Data" com descrição livre e reabrir para validar persistência.
  - Smoke de português: inspecionar 3 páginas-chave (`MainPage`, `DashboardPage`, `TrainingsPage`) buscando por termos desacentuados residuais.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **1.0** Versionar o SQL aplicado + atualizar `techspec-codebase.md` backend (não bloqueia nada, mas é rápido).
2. **2.0** Backend do recurso Fiadores (destrava o FE `FiadoresPanel`).
3. **3.0** Backend do filtro de período (pode andar em paralelo com 2.0) — destrava o FE do filtro.
4. **4.0** Catálogo de scripts no backend (independente, LOW).
5. **5.0** FE `FiadoresPanel` (depende de 2.0).
6. **6.0** Integração do `FiadoresPanel` nos 5 pontos (depende de 5.0).
7. **7.0** FE do filtro de período na seção do Dashboard (depende de 3.0) — pode correr em paralelo com 5.0/6.0.
8. **8.0** FE novo script "Alteração de Data" (depende de 4.0).
9. **9.0** Refatoração de português (pode correr em paralelo com qualquer outra).
10. **10.0** Documentação final + regressão.

### Dependências Técnicas

- Backend de fiadores exige a view `DW.vw_fiadores_por_venda` (✅ já aplicada no banco).
- FE do filtro depende do backend respeitar `dataInicio`/`dataFim`.
- FE do script novo depende do frontend não mudar o contrato do `POST /ocorrencias` (continuamos usando `STATUS_OCORRENCIA` string livre).

## Monitoramento e Observabilidade

- Logs do backend permanecem no console (padrão atual). Não há Grafana/Prometheus no escopo deste módulo.
- Acompanhar via logs:
  - Rejeições `400` de `parseDateRange` (diagnóstico de uso indevido por clientes).
  - Erros do pool MSSQL ao consultar `DW.vw_fiadores_por_venda` (indicador de falha no DW).
- Frontend: erros de `apiFetch` continuam aparecendo em toasts `Swal.fire`.

## Considerações Técnicas

### Decisões Principais

- **Filtro no próprio SQL vs filtro em memória**: aplicado no SQL com `BETWEEN` para manter performance e aproveitar índices em `OCORRENCIAS.DT_OCORRENCIA`. Evita carregar grandes recordsets em Node.
- **Helper `parseDateRange` central**: evita duplicação nos 9 controllers e garante consistência de erro/formato.
- **`searchParams` como fonte de verdade** do filtro no FE: permite deep-link e mantém estado no refresh sem introduzir store global. Segue o padrão "sem Redux/Zustand" do projeto.
- **Endpoint por `num-venda` + `cpf`**: a maioria dos pontos de uso conhece `NUM_VENDA`; `cpf` é um acessório para telas que partem do CPF (e o operador poderá ver fiadores de todas as vendas daquele CPF no futuro — fora do escopo, mas o endpoint já fica pronto).
- **Script "Alteração de Data" sem template**: o PRD pede descrição livre. Manter `OCCURRENCE_STATUS_TEMPLATES` sem entrada para esse script preserva a expectativa.
- **Refatoração de português** feita por varredura + revisão manual por página, não por script automático, para evitar regressões semânticas.

### Riscos Conhecidos

- **Timezone das datas de ocorrência**: se `DT_OCORRENCIA` estiver armazenada em UTC, o filtro em `YYYY-MM-DD` pode "comer" registros da borda. Mitigação: aplicar `BETWEEN CAST(@dataInicio AS datetime) AND DATEADD(day, 1, CAST(@dataFim AS datetime)) - 1ms` ou equivalente, e validar com amostra antes de liberar.
- **Performance de `fat_associados_num_venda`**: se o DW for grande, a view pode ficar lenta sem estatísticas. Mitigação: o índice `IX_fat_associados_num_venda__NUM_VENDA` já foi criado junto com a view.
- **Colisão com cache do frontend**: o toggle `Ctrl+Alt+T` altera a base da API. Garantir que o estado de filtro limpe ao trocar de base.
- **Qualidade dos valores `RENDA_FAMILIAR = 0.01`**: tratar como "Não informado" para evitar ruído; confirmar regra com área de negócio antes do release.

### Conformidade com Padrões

Regras `.windsurf/rules/*` aplicáveis:

- `@c:/api-inadimplencia/.windsurf/rules/techspec-codebase.md`: toda mudança no backend segue MVC (routes/controllers/models), parametrização `mssql`, `next(err)` + `errorHandler`, Swagger sempre atualizado, CORS inalterado.
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/.windsurf/rules/techspec-codebase.md`: HTTP via `apiFetch`, componentes em `src/shared/ui/`, tipos em `src/shared/types/`, evitar pasta `shered/`, manter `isClienteInadimplente` unificado.

### Arquivos relevantes e dependentes

Backend (novos/modificados):

- `@c:/api-inadimplencia/src/modules/inadimplencia/docs/sql/2026-04-22-fiadores-fat-associados.sql` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/helpers/dateRange.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/models/fiadoresModel.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/fiadoresController.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/routes/fiadoresRoutes.js` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/swagger.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/index.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/legacyApp.js`
- `@c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md`

Frontend (novos/modificados):

- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/types/fiador.ts` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/hooks/useFiadores.ts` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/fiadores/FiadoresPanel.tsx` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/fiadores/fiadoresPanel.module.css` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/dateRangeFilter/DateRangeFilter.tsx` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/dateRangeFilter/dateRangeFilter.module.css` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/dashboard/hooks/useDashboardDateRange.ts` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/DashboardPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/dashboard/api.ts`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/TrainingsPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/NoNextActionPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/MyResponsibilityPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/calendar/InteractiveCalendar.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/constants/occurrence.ts`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/documentos/techspec-codebase.md`
- Todos os `.tsx/.ts` em `src/` (refatoração de português em strings visíveis).
