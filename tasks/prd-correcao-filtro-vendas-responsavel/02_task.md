# Tarefa 2.0: Frontend — Passar filtros de data na chamada do `/vendas-por-responsavel`

<critical>Ler os arquivos de prd.md e techspec.md da pasta `prd-dashboard-filtros-fiadores-alteracao-data` para entender o padrão de filtros já implementado no frontend</critical>

## Visão Geral

<complexity>LOW</complexity>

Alterar o hook `useDashboardData.ts` para passar o `query` com os filtros de data na chamada ao endpoint `/vendas-por-responsavel`, seguindo o mesmo padrão dos outros gráficos de ocorrências.

<requirements>
- A chamada para `/vendas-por-responsavel` deve incluir o objeto `query` (ocorrenciasQuery)
- O gráfico deve atualizar automaticamente quando o filtro de período é alterado
- Manter compatibilidade com o comportamento atual quando não há filtro
- O gráfico deve aparecer na seção de "Gráficos filtrados" junto com os outros
</requirements>

## Subtarefas

- [ ] 2.1 Modificar `useDashboardData.ts` — Adicionar `query: ocorrenciasQuery` na chamada `fetchDashboard("/vendas-por-responsavel")`
- [ ] 2.2 Verificar se o `useEffect` dependency array precisa de ajuste para reagir às mudanças de `query`
- [ ] 2.3 Testar manualmente o filtro aplicado ao gráfico

## Detalhes de Implementação

### Hook (`@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/dashboard/hooks/useDashboardData.ts`)

Referência às chamadas que já passam o `query` (linha 152-161):

```typescript
fetchDashboard<OcorrenciasPorUsuarioRecord[]>(
  "/ocorrencias-por-usuario",
  { signal: controller.signal, query: ocorrenciasQuery },
).then((data) => {
  if (active) setOcorrenciasPorUsuario(data ?? [])
}),
```

Alterar a chamada de `/vendas-por-responsavel` (linha 117-122) para:

```typescript
fetchDashboard<VendasPorResponsavelRecord[]>(
  "/vendas-por-responsavel",
  { signal: controller.signal, query: ocorrenciasQuery },  // <-- adicionar query
).then((data) => {
  if (active) setVendasPorResponsavel(data ?? [])
}),
```

### API (`@c:/fluig/trenamento\wcm\layout\jnc_inadimplencia\src\main\jnc_inadimplencia\src\pages\main\dashboard\api.ts`)

Verificar se a função `fetchDashboard` já suporta o parâmetro `query`. Segundo o techspec da feature anterior, ela já foi modificada para aceitar `{ signal, query }`.

## Critérios de Sucesso

- [ ] Ao aplicar filtro de período no dashboard, o gráfico "Vendas Por Responsável" atualiza com dados filtrados
- [ ] Ao limpar o filtro, o gráfico volta a mostrar todos os dados
- [ ] O gráfico responde aos presets (Hoje, 7 dias, 30 dias, etc.)
- [ ] Não há regressão nos outros gráficos

## Testes da Tarefa

- [ ] Teste de integração (manual ou Playwright): Aplicar filtro e verificar que o gráfico atualiza
- [ ] Teste de unidade (Vitest): Verificar que `fetchDashboard` é chamado com `query` correto

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/fluig/trenamento\wcm\layout\jnc_inadimplencia\src\main\jnc_inadimplencia\src\pages\main\dashboard\hooks\useDashboardData.ts`
- `@c:/fluig/trenamento\wcm\layout\jnc_inadimplencia\src\main\jnc_inadimplencia\src\pages\main\dashboard\api.ts`
