# Tarefa 1.0: Correção de String UTF-8 Corrompida (F2)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Substituir o literal de string corrompido por dupla codificação UTF-8 (`possÃ­vel` → `possível`) na chamada `setClientDetailError` do componente `InteractiveCalendar.tsx`. Adicionalmente, realizar um grep por `Ã` em todo o projeto para identificar e corrigir outras strings potencialmente corrompidas.

<requirements>
- RF-2.1: A mensagem de erro `setClientDetailError` deve exibir o texto "Não foi possível carregar detalhes do cliente." corretamente codificado.
- RF-2.2: Nenhuma outra string do componente deve apresentar problemas de codificação.
</requirements>

## Subtarefas

- [ ] 1.1 Substituir o literal corrompido na linha ~1508 de `InteractiveCalendar.tsx`: trocar `"Não foi possÃ­vel carregar detalhes do cliente."` por `"Não foi possível carregar detalhes do cliente."`
- [ ] 1.2 Executar grep por `Ã` (padrão de dupla codificação UTF-8) em todo o projeto front-end para identificar outras ocorrências
- [ ] 1.3 Corrigir quaisquer outras strings corrompidas encontradas no grep (se houver)
- [ ] 1.4 Criar e executar testes da tarefa

## Detalhes de Implementação

Consulte a seção **F2 — String UTF-8 Corrompida** da `techspec.md` para o código exato da substituição.

**Causa raiz**: O arquivo foi salvo ou editado com dupla codificação UTF-8 (UTF-8 → Latin-1 → UTF-8), corrompendo `í` → `Ã­`.

A correção é uma substituição direta de 1 linha — zero risco de efeito colateral.

## Critérios de Sucesso

- A mensagem de erro exibe "Não foi possível carregar detalhes do cliente." sem caracteres corrompidos
- Nenhuma outra string no projeto apresenta o padrão `Ã` de dupla codificação UTF-8
- Verificação visual: forçar erro ao carregar detalhes do cliente → mensagem legível

## Testes da Tarefa

- [ ] **Teste unitário**: Verificar que a string passada a `setClientDetailError` no cenário de erro contém "possível" (sem caracteres corrompidos)
- [ ] **Teste manual/integração**: Forçar erro ao carregar detalhes do cliente no modal → confirmar visualmente que a mensagem está correta

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/shared/ui/calendar/InteractiveCalendar.tsx` (linha ~1508) — arquivo a modificar
