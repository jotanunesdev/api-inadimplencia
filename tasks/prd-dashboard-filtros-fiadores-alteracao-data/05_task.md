# Tarefa 5.0: Frontend — Componente `FiadoresPanel` + hook `useFiadores` + tipos

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Construir no frontend o componente reutilizável `<FiadoresPanel numVenda={...} />` com loading/empty/error states, hook `useFiadores(numVenda)` via `apiFetch`, CSS Module dedicado e tipos canônicos em `src/shared/types/fiador.ts`.

<requirements>
- Colunas exibidas: **Nome**, **Data de Cadastro** (formato BR), **Renda Familiar** (formato BRL, com fallback "Não informado" para valores ≤ 1,00), **Tipo de Associação** (badge), **Endereço**.
- Fallback "Sem fiadores cadastrados para esta venda." quando vazio.
- Estado de loading com `role="status"` + `aria-live="polite"`.
- Reutilizar `apiFetch`; nada de `fetch` cru.
- Respeitar tokens CSS e tema dark/light.
- Não usar pasta `shered/`.
</requirements>

## Subtarefas

- [x] 5.1 Criar `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/types/fiador.ts` com `FiadorRecord`, `FiadorRow`, `FiadorResponse`.
- [x] 5.2 Criar `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/hooks/useFiadores.ts` com `{ data, loading, error, reload }` e abort na desmontagem.
- [x] 5.3 Criar `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/fiadores/FiadoresPanel.tsx` + `fiadoresPanel.module.css`.
- [x] 5.4 Definir paleta de cores por `TIPO_ASSOCIACAO` (pragmática, reaproveitando tokens existentes).
- [x] 5.5 Escrever testes unitários do componente e do hook.

## Detalhes de Implementação

Referência: seção **Arquitetura do Sistema → Componentes** do `techspec.md` (tipos + hook + componente).

## Critérios de Sucesso

- Componente renderiza corretamente com 0, 1 e N fiadores.
- Hook cancela request ao desmontar (sem warning `Can't perform a React state update on an unmounted component`).
- Renda `0.01` é exibida como "Não informado".
- `npm run lint` passa.

## Testes da Tarefa

- [x] Testes de unidade (Vitest + RTL): renderização dos 4 estados (loading, empty, error, ok); formatação BRL; formatação data BR; fallback de renda.
- [x] Teste de integração leve: hook `useFiadores` com `apiFetch` mockado (sucesso + erro).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/types/fiador.ts` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/hooks/useFiadores.ts` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/fiadores/FiadoresPanel.tsx` *(novo)*
- `@c:/fluig/trenamento/wcm/layout/jnc_inadimplencia/src/main/jnc_inadimplencia/src/shared/ui/fiadores/fiadoresPanel.module.css` *(novo)*
