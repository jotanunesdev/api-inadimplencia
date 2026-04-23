# Tarefa 7.0: Frontend — Filtro de período na seção de ocorrências/atendimentos do Dashboard

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Adicionar um filtro de período (`DateRangeFilter`) no topo da **seção** de gráficos de ocorrências/atendimentos do Dashboard (não no topo global da página). O estado deve ficar sincronizado com `searchParams` (`?dtIni=YYYY-MM-DD&dtFim=YYYY-MM-DD`) para permitir deep-link. Seguir **TDD red-green-refactor**.

<requirements>
- O filtro afeta **apenas** os 9 endpoints da seção (confirmados no PRD).
- Não afeta KPIs nem demais painéis.
- Presets: Hoje, 7 dias, 30 dias, Mês atual, Ano atual + range customizado.
- Validação: `dtFim >= dtIni` no próprio componente; não chamar backend se invalido.
- Botão "Limpar" remove `dtIni`/`dtFim` da URL e volta ao modo total.
- Alteração do toggle de API (`Ctrl+Alt+T`) deve limpar o estado de filtro.
- Componente reutilizável em `src/shared/ui/dateRangeFilter/`.
- Hook `useDashboardDateRange` em `src/pages/main/dashboard/hooks/`.
</requirements>

## Subtarefas

- [ ] 7.1 Escrever testes de unidade do hook `useDashboardDateRange` (leitura/escrita URL, presets, clear, `toQuery`). RED.
- [ ] 7.2 Implementar hook. GREEN.
- [ ] 7.3 Escrever testes de unidade do `DateRangeFilter` (render, presets, validação, clear). RED.
- [ ] 7.4 Implementar componente + CSS Module. GREEN.
- [ ] 7.5 Integrar `DateRangeFilter` + hook no `DashboardPage.tsx`, no topo da seção de ocorrências. Propagar `query` para os 9 hooks/components de gráficos.
- [ ] 7.6 Atualizar `src/pages/main/dashboard/api.ts`: `fetchDashboard(path, { signal, query })` que serializa `query` via `URLSearchParams`.
- [ ] 7.7 Testes de integração: simular preset "7 dias" e verificar que 9 requests são disparados com `dataInicio`/`dataFim` corretos e que os outros (KPIs, aging, etc.) não mudam.
- [ ] 7.8 Teste E2E (Playwright MCP): aplicar filtro, validar que URL reflete o range, refresh mantém estado.

## Detalhes de Implementação

Referência: seções **Arquitetura do Sistema**, **Design de Implementação** e **Riscos Conhecidos** do `techspec.md`.

## Critérios de Sucesso

- URL reflete o range (`?dtIni=&dtFim=`).
- Refresh preserva estado.
- `Limpar` volta ao comportamento original.
- `dtFim < dtIni` não dispara requests.
- `npm run lint` passa.

## Testes da Tarefa

- [ ] Testes de unidade: 6+ cenários no hook + 4+ no componente.
- [ ] Testes de integração: `DashboardPage` com `apiFetch` mockado validando requests.
- [ ] Teste E2E: 1 fluxo completo pelo Playwright MCP.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/dateRangeFilter/DateRangeFilter.tsx` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/dateRangeFilter/dateRangeFilter.module.css` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/dashboard/hooks/useDashboardDateRange.ts` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/DashboardPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/dashboard/api.ts`
