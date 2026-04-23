# Tarefa 8.0: Frontend — Script "Alteração de Data" no modal de nova ocorrência

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Adicionar o item `"Alteração de Data"` em `OCCURRENCE_STATUS_OPTIONS` e garantir que, quando selecionado, a descrição continua sendo texto livre (não adicionar entrada em `OCCURRENCE_STATUS_TEMPLATES`).

<requirements>
- Disponível para qualquer usuário (sem guard).
- Descrição livre (sem template).
- Fluxo de salvar reutiliza `POST /inadimplencia/ocorrencias` sem mudanças de contrato.
</requirements>

## Subtarefas

- [ ] 8.1 Adicionar `"Alteração de Data"` ao final do array `OCCURRENCE_STATUS_OPTIONS` em `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/constants/occurrence.ts`.
- [ ] 8.2 Confirmar que os selects que usam `OCCURRENCE_STATUS_OPTIONS` (modal de nova ocorrência em `InteractiveCalendar.tsx`, `TrainingsPage.tsx`, etc.) expõem o novo item automaticamente.
- [ ] 8.3 Teste E2E: criar ocorrência com o script, salvar, recarregar e confirmar persistência.

## Detalhes de Implementação

Referência: seção **Funcionalidades Principais → 3** do `prd.md`.

## Critérios de Sucesso

- Novo item aparece no select de qualquer modal de nova ocorrência.
- Textarea permanece livre (sem pré-preenchimento).
- Ocorrência criada persiste com `STATUS_OCORRENCIA = "Alteração de Data"` e pode ser lida via `GET /inadimplencia/ocorrencias/:id`.

## Testes da Tarefa

- [ ] Teste de unidade: assert de presença da string no array exportado.
- [ ] Teste de integração: submissão do modal com o novo script + mock da API (`201`).
- [ ] Teste E2E (Playwright MCP): fluxo completo de criação.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/constants/occurrence.ts`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/calendar/InteractiveCalendar.tsx`
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/pages/main/TrainingsPage.tsx`
