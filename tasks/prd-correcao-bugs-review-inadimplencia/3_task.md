# Tarefa 3.0: Correção de Stale Closure com useRef (F1)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Corrigir o bug de stale closure no callback `handleConfirmStartAttendance` do componente `InteractiveCalendar.tsx`. O callback atualmente captura versões obsoletas de `handleStartAttendance` e `isClientAdimplente`, podendo levar a decisões incorretas no fluxo de atendimento. A correção usa `useRef` para manter referência atualizada e adiciona `isClientAdimplente` ao array de dependências.

<requirements>
- RF-1.1: O callback `handleConfirmStartAttendance` deve sempre utilizar o valor atual de `isClientAdimplente` no momento da execução.
- RF-1.2: O callback `handleConfirmStartAttendance` deve sempre invocar a versão atual de `handleStartAttendance` no momento da execução.
- RF-1.3: A correção não deve introduzir re-renderizações desnecessárias no componente `InteractiveCalendar`.
</requirements>

## Subtarefas

- [ ] 3.1 Criar `useRef` para `handleStartAttendance` — declarar próximo aos outros refs do componente:
  ```tsx
  const handleStartAttendanceRef = useRef(handleStartAttendance)
  ```
- [ ] 3.2 Adicionar `useEffect` para manter o ref atualizado:
  ```tsx
  useEffect(() => {
    handleStartAttendanceRef.current = handleStartAttendance
  }, [handleStartAttendance])
  ```
- [ ] 3.3 Atualizar `handleConfirmStartAttendance` para:
  - Adicionar `isClientAdimplente` ao array de dependências do `useCallback`
  - Usar `handleStartAttendanceRef.current()` em vez de `handleStartAttendance()` direto
- [ ] 3.4 Criar e executar testes da tarefa

## Detalhes de Implementação

Consulte a seção **F1 — Stale Closure: `useRef` para `handleStartAttendance`** da `techspec.md` para:
- O código completo do ref + useEffect (linhas 32-37 da techspec)
- O callback corrigido (linhas 40-53 da techspec)
- A justificativa técnica de por que `useRef` é preferível a adicionar `handleStartAttendance` ao array de deps

**Pontos-chave**:
- `isClientAdimplente` é derivado de `clientDetail` (recalculado a cada render) — adicioná-lo ao array de deps não causa re-renderizações extras
- `handleStartAttendance` recria a cada render — `useRef` evita recriações em cascata do callback de confirmação

## Critérios de Sucesso

- Ao clicar "Confirmar Atendimento", o sistema usa o valor **atual** de `isClientAdimplente`
- `handleStartAttendance` invocado é sempre a versão mais recente
- Não há re-renderizações adicionais do componente (verificável via React DevTools Profiler)

## Testes da Tarefa

- [ ] **Teste unitário**: Verificar que `handleConfirmStartAttendance` lê `isClientAdimplente` do estado atual (não de uma closure obsoleta)
- [ ] **Teste unitário**: Verificar que `handleStartAttendanceRef.current` é atualizado quando `handleStartAttendance` muda
- [ ] **Teste manual**: Abrir modal de cliente → esperar mudança de adimplência → clicar "Confirmar Atendimento" → verificar que usa o status atualizado

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/shared/ui/calendar/InteractiveCalendar.tsx` (linhas ~1006-1035) — arquivo a modificar
- `src/shared/utils/clienteSituacao.ts` — referência para `isClientAdimplente` (somente leitura)
