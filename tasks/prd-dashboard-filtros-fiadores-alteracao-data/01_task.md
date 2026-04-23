# Tarefa 1.0: Versionar SQL aplicado (fiadores) e atualizar tech-spec do backend

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

O SQL que cria o índice e a view `DW.vw_fiadores_por_venda` já foi aplicado em produção pelo usuário. Esta task apenas **versiona o script** no repositório (para histórico/reprocesso) e atualiza o `techspec-codebase.md` do backend com a nova view e a nova tabela `DW.fat_associados_num_venda`.

<requirements>
- Não executar o SQL (já aplicado).
- Garantir que o arquivo `.sql` versionado é idempotente (`IF NOT EXISTS` para o índice, `CREATE OR ALTER VIEW` para a view).
- Atualizar apenas a seção relevante de `@c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md`.
</requirements>

## Subtarefas

- [ ] 1.1 Criar `@c:/api-inadimplencia/src/modules/inadimplencia/docs/sql/2026-04-22-fiadores-fat-associados.sql` com o script exato aplicado no banco.
- [ ] 1.2 Adicionar na seção "3.2. Tabelas e domínio" do `techspec-codebase.md` do backend a nova tabela `DW.fat_associados_num_venda` (com colunas e relação N:1 por `NUM_VENDA`) e a view `DW.vw_fiadores_por_venda`.
- [ ] 1.3 Validar localmente que o arquivo SQL roda sem erro (modo dry-run/plan) num ambiente de dev.

## Detalhes de Implementação

Referência completa: seção **Arquitetura do Sistema → Modelos de Dados** do `techspec.md`. O script segue o formato idempotente já adotado em `docs/sql/2026-04-01-ocorrencias-fk-v4-nocheck.sql`.

## Critérios de Sucesso

- Arquivo `.sql` presente em `docs/sql/` reproduz exatamente o estado do banco.
- `techspec-codebase.md` do backend cita `DW.fat_associados_num_venda` e `DW.vw_fiadores_por_venda` na tabela de domínio.
- Script é idempotente (rodar 2x não falha).

## Testes da Tarefa

- [ ] Teste de unidade: não aplicável (apenas arquivos de documentação).
- [ ] Teste de integração: executar o `.sql` em ambiente de homologação e confirmar que não quebra (idempotência).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/docs/sql/2026-04-22-fiadores-fat-associados.sql` *(novo)*
- `@c:/api-inadimplencia/src/modules/inadimplencia/docs/techspec-codebase.md`
