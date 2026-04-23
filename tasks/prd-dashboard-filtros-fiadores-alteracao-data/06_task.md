# Tarefa 6.0: Frontend — Integração do `FiadoresPanel` nos 5 pontos de "abrir venda"

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Plugar `<FiadoresPanel numVenda>` nas 5 telas onde o usuário "abre" os detalhes da venda. O painel deve ficar agrupado visualmente com as demais informações do cliente (mesmo card/bloco).

Telas:

- **TR-2.1** `TrainingsPage` (atendimento)
- **TR-2.2** `NoNextActionPage`
- **TR-2.3** `MyResponsibilityPage`
- **TR-2.4** `InteractiveCalendar` (`EventModal`/`CardModal`)
- **TR-2.5** Modais de drill-down do Dashboard (`aging-detalhes`, `parcelas-detalhes`, `score-saldo-detalhes`)

<requirements>
- Usar o mesmo componente em todos os 5 pontos.
- Nunca renderizar o painel sem `numVenda` (guard).
- Respeitar scroll/responsividade existente das telas.
- Não duplicar lógica de fetch.
</requirements>

## Subtarefas

- [ ] 6.1 Integrar em `TrainingsPage.tsx`.
- [ ] 6.2 Integrar em `NoNextActionPage.tsx`.
- [ ] 6.3 Integrar em `MyResponsibilityPage.tsx`.
- [ ] 6.4 Integrar no `EventModal` e no `CardModal` internos do `InteractiveCalendar.tsx`.
- [ ] 6.5 Integrar nos modais de drill-down do `DashboardPage.tsx` (`aging-detalhes`, `parcelas-detalhes`, `score-saldo-detalhes`).
- [ ] 6.6 Teste de integração: abrir cada tela/modal e validar presença do painel com dados mockados.

## Detalhes de Implementação

Referência: seção **Arquitetura do Sistema → Componentes modificados** do `techspec.md` e **Funcionalidades Principais → 2** do `prd.md`.

## Critérios de Sucesso

- Painel aparece nos 5 pontos com os mesmos dados.
- Comportamento de scroll/tema/modal continua OK nos 5 pontos.
- Nenhuma regressão visual em telas sem painel.

## Testes da Tarefa

- [ ] Testes de unidade: snapshot/render de cada tela com mock de `useFiadores`.
- [ ] Testes de integração (ao menos 2 dos 5 pontos) com RTL + fake API.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/TrainingsPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/NoNextActionPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/MyResponsibilityPage.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/calendar/InteractiveCalendar.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/DashboardPage.tsx`
