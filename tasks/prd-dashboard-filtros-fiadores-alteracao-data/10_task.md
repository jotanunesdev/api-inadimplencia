# Tarefa 10.0: Documentação final + checklist de regressão

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Atualizar a documentação dos dois repositórios para refletir a feature entregue e executar um smoke test de regressão.

<requirements>
- Atualizar `techspec-codebase.md` do backend: rotas `/fiadores/*`, novos query params `dataInicio/dataFim` nos 9 endpoints, nova tabela/view.
- Atualizar `techspec-codebase.md` do frontend: `FiadoresPanel`, `useFiadores`, `DateRangeFilter`, `useDashboardDateRange`, novo script de ocorrência.
- Produzir um checklist de regressão manual.
- Executar o smoke test.
</requirements>

## Subtarefas

- [ ] 10.1 Atualizar `@c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md` (seções "Mapa de Navegação" e "Rotas").
- [ ] 10.2 Atualizar `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/documentos/techspec-codebase.md` (seções "Mapa de Navegação", "Engines" e "Checklist").
- [ ] 10.3 Rodar o checklist de regressão abaixo em ambiente de homologação.

### Checklist de Regressão

- [ ] Dashboard abre sem filtro aplicado (URL sem `dtIni`/`dtFim`) e exibe dados como antes.
- [ ] Aplicar preset "7 dias": gráficos da seção atualizam, KPIs e demais painéis permanecem iguais.
- [ ] URL muda para `?dtIni=&dtFim=`. Refresh preserva o estado.
- [ ] Limpar filtro volta ao modo total.
- [ ] Faixas invalidas (dtFim < dtIni) são bloqueadas no componente.
- [ ] Fiadores aparecem nos 5 pontos (TrainingsPage, NoNextActionPage, MyResponsibilityPage, Calendar modals, Dashboard drill-downs).
- [ ] Renda "0.01" é exibida como "Não informado".
- [ ] Criar ocorrência "Alteração de Data" persiste e aparece na listagem.
- [ ] Páginas-chave sem erros de português visíveis.
- [ ] Swagger UI lista as novas rotas e os novos query params.
- [ ] `npm run lint` passa no frontend.
- [ ] Health-check (`/inadimplencia/health`) continua `200`.

## Detalhes de Implementação

Referência: todos os outros itens deste plano.

## Critérios de Sucesso

- Checklist acima 100% marcado em homologação.
- `techspec-codebase.md` dos dois repos refletem a feature.

## Testes da Tarefa

- [ ] Smoke test manual (checklist acima).
- [ ] Diff de documentação revisado.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/documentos/techspec-codebase.md`
