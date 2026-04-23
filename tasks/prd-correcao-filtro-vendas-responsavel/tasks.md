# Resumo de Tarefas de Implementação — Correção: Filtro de Período no Gráfico "Vendas Por Responsável"

## Contexto

O gráfico **"Vendas Por Responsável"** do Dashboard de Inadimplência não está sendo filtrado quando o usuário aplica um período de datas no filtro de ocorrências. Enquanto os outros 5 gráficos de ocorrências (Ocorrências por usuário, Atendentes com próxima ação, Ocorrências por dia, Ocorrências por hora, Top vendas com ocorrências) estão funcionando corretamente com o filtro, o "Vendas Por Responsável" permanece mostrando todos os dados.

## Problema Raiz

1. **Backend**: O endpoint `GET /dashboard/vendas-por-responsavel` em `dashboardController.js` não recebe nem aplica parâmetros de data
2. **Frontend**: O hook `useDashboardData.ts` não passa o `query` com filtros na chamada para `/vendas-por-responsavel`

## Solução

Adicionar suporte ao filtro de período no endpoint `/vendas-por-responsavel`, filtrando pelo campo `VENCIMENTO_MAIS_ANTIGO` da tabela `DW.fat_analise_inadimplencia_v4`.

## Tarefas

- [x] 1.0 Backend — Adicionar filtro `dataInicio/dataFim` no endpoint `/vendas-por-responsavel` (Complexidade: MEDIUM)
- [x] 2.0 Frontend — Passar filtros de data na chamada do `/vendas-por-responsavel` (Complexidade: LOW)
- [x] 3.0 Testes — Testes de unidade e integração para o filtro (Complexidade: MEDIUM)
