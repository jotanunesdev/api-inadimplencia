# Tarefa 9.0: Frontend — Refatoração de português em strings visíveis ao usuário

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Corrigir pontuação, acentuação e concordância em **strings visíveis ao usuário** em todos os `.tsx/.ts` do frontend `jnc_inadimplencia`. Não alterar identificadores (variáveis, arquivos, rotas, colunas SQL, nomes de componentes, classes CSS) nem comentários/JSDoc/mensagens de `throw new Error(...)`.

<requirements>
- Escopo estrito: `JSX text nodes` + atributos `label`, `placeholder`, `aria-label`, `title`, `alt` + strings passadas a componentes de UI (`title` de `Modal`, `header` de colunas do `Table`, etc.) + mensagens do `Swal.fire`.
- Proibido: mudar nomes de variáveis, arquivos, rotas, classes, funções, chaves de objeto, colunas SQL, comentários, `throw new Error(...)`.
- Backend **NÃO** é afetado.
- `npm run lint` deve passar.
</requirements>

## Subtarefas

- [ ] 9.1 Levantar lista de termos candidatos via grep (ex.: `\bnao\b`, `\bproxima\b`, `\bacao\b`, `\bhistorico\b`, `\bconclucoes\b`, `\busuario\b`, `\bconcluido\b`, `\be\b(?= )` em JSX).
- [ ] 9.2 Varrer página a página (pages/main/*.tsx) aplicando correções apenas em strings visíveis.
- [ ] 9.3 Varrer componentes em `src/shared/ui/**` (calendar, aside, modal, table, video, button, input, gauge, etc.).
- [ ] 9.4 Varrer hooks/serviços que expõem mensagens em `Swal.fire`.
- [ ] 9.5 Revisão manual página a página após a varredura.
- [ ] 9.6 `npm run lint`.

## Detalhes de Implementação

Referência: seção **Funcionalidades Principais → 4** do `prd.md`. Em caso de dúvida se uma string é visível ao usuário, consultar onde ela é usada; se for consumida por um componente de UI (prop `label`, `title`, `text`, `header`, etc.) ou renderizada em JSX, é elegível.

## Critérios de Sucesso

- Ao abrir as telas principais (MainPage, DashboardPage, NextActionsPage, TrainingsPage, CompletedCoursesPage, MyResponsibilityPage, NoNextActionPage, SystemSettingsPage, LoginPage), todas as palavras em português aparecem com acentuação correta.
- Nenhum identificador foi alterado (diff não muda imports/exports).
- `npm run lint` passa.

## Testes da Tarefa

- [ ] Teste de unidade: snapshot de 3 páginas-chave (`MainPage`, `DashboardPage`, `TrainingsPage`).
- [ ] Teste E2E (Playwright MCP): inspeção visual rápida de 3 páginas em busca de palavras desacentuadas residuais (lista do PRD).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- Todos os `.tsx/.ts` em `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/**`.
