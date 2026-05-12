# Tarefa 2.0: Model/repository `serasaPefinModel` com consultas, transacoes, dedupe e auditoria

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>HIGH</complexity>

Implementar a camada de persistencia da integracao Serasa PEFIN em `models/serasaPefinModel.js`, mantendo todo SQL dentro do model, usando queries parametrizadas e transacoes para garantir rastreabilidade e bloqueio de duplicidades.

<requirements>
- Criar `src/modules/inadimplencia/models/serasaPefinModel.js`.
- Consultar venda inadimplente existente em `DW.fat_analise_inadimplencia_v4` por `NUM_VENDA`.
- Consultar garantidores elegiveis em `DW.vw_fiadores_por_venda`, filtrando fiador, conjuge, cessionario e coobrigado.
- Criar solicitacao principal e solicitacoes de garantidores em transacao.
- Bloquear duplicidade ativa para o mesmo `NUM_VENDA`, contrato, documento do devedor e documento do garantidor quando aplicavel.
- Usar isolamento/hints compativeis com a tech spec: transacao `SERIALIZABLE` e lock `UPDLOCK,HOLDLOCK` no ponto de dedupe.
- Atualizar `transactionId`, `CADUS_KEY`, `CADUS_SERIE`, status e payload de auditoria apos retorno Serasa.
- Listar historico por venda e buscar detalhe por ID.
- Atualizar solicitacao por `TRANSACTION_ID` recebido em webhook.
- Registrar todo webhook recebido, inclusive sem solicitacao correspondente, em `SERASA_PEFIN_WEBHOOKS`.
- Nunca concatenar valores de usuario em SQL; usar `request.input`.
</requirements>

## Subtarefas

- [x] 2.1 Revisar `prd.md`, `techspec.md` e models existentes do modulo para seguir estilo local.
- [x] 2.2 Implementar `findInadimplenciaByNumVenda(numVenda)` com retorno normalizado.
- [x] 2.3 Implementar `findGuarantorsByNumVenda(numVenda)` com filtro por tipos permitidos.
- [x] 2.4 Implementar criacao transacional de solicitacao principal e garantidores em status `PENDENTE_ENVIO`.
- [x] 2.5 Implementar checagem de duplicidade ativa com lock transacional.
- [x] 2.6 Implementar updates de envio: `ENVIADO_SERASA`, `AGUARDANDO_RETORNO`, `TRANSACTION_ID`, `CADUS_KEY`, `CADUS_SERIE`.
- [x] 2.7 Implementar updates de resultado por webhook: `NEGATIVADO_SUCESSO`, `NEGATIVADO_ERRO`, `WEBHOOK_PAYLOAD`, `ERROR_MESSAGE`, `ERROR_STATUS_CODE`.
- [x] 2.8 Implementar queries de historico por venda e detalhe por ID.
- [x] 2.9 Implementar registro de webhook matched/unmatched com `PROCESSADO` e mensagem de erro.
- [x] 2.10 Criar testes em red-green-refactor para transacao, dedupe, update por `transactionId` e webhook sem match.

## Detalhes de Implementacao

Seguir as secoes "Modelos de Dados", "Validacoes bloqueantes" e "Conformidade com Padroes" do `techspec.md`. O model deve usar `getPool()` de `src/modules/inadimplencia/config/db.js`, tipos do pacote `mssql` e padrao de erro com `err.statusCode` quando a falha for de dominio.

Como esta task e de alta complexidade, iniciar por testes que descrevam o comportamento esperado do repository antes de implementar o SQL final. Mocks de `mssql` podem ser usados para unidade; integracao real depende de banco de desenvolvimento.

## Criterios de Sucesso

- Nenhuma regra SQL da Serasa fica em controller.
- Criacao de principal e garantidores e atomica ate o ponto de persistencia local.
- Dedupe impede negativacao ativa duplicada antes do envio externo.
- Webhooks sem match sao preservados para investigacao e nao quebram o fluxo.
- Historico e detalhe retornam dados suficientes para operacao e auditoria.

## Testes da Tarefa

- [x] Testes de unidade: repository com pool/request/transaction mockados, cobrindo parametros SQL, dedupe, updates por `transactionId` e registro de webhook.
- [x] Testes de integracao: SQL Server de desenvolvimento/UAT nao executado neste ambiente; validacao real de criacao/listagem/update depende da aplicacao controlada da migration em banco disponivel.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\config\db.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\inadimplenciaModel.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\fiadoresModel.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\docs\sql\2026-05-11-serasa-pefin.sql`
