# Tarefa 6.0: Fluxo de envio PEFIN: divida principal + garantidores sequenciais

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>HIGH</complexity>

Implementar o fluxo de negocio que solicita negativacao PEFIN: persistir a solicitacao local, enviar a divida principal para a Serasa, gravar `transactionId` e, em seguida, enviar garantidores selecionados sem sobrescrever o status da principal.

<requirements>
- Implementar `requestNegativacao({ numVenda, operador, garantidoresSelecionados, overrides })` no service.
- Validar venda e dados obrigatorios antes de qualquer envio externo.
- Criar solicitacao principal e registros de garantidores selecionados antes das chamadas HTTP, para rastreabilidade.
- Enviar uma unica divida por requisicao; envio em lote e proibido.
- Enviar garantidores apenas depois que a divida principal receber `transactionId`.
- Ao receber `HTTP 200` com `transactionId`, atualizar status interno para `AGUARDANDO_RETORNO`, nao para sucesso final.
- Persistir `transactionId`, `CADUS_KEY` e `CADUS_SERIE` quando retornados.
- Se o envio principal falhar, marcar a principal como erro apropriado e nao enviar garantidores.
- Se um garantidor falhar, marcar somente aquele garantidor como erro, mantendo o status da principal.
- Bloquear duplicidade ativa por transacao antes do envio.
- Usar payload de auditoria sanitizado.
</requirements>

## Subtarefas

- [ ] 6.1 Criar testes red para fluxo feliz: principal + dois garantidores selecionados.
- [ ] 6.2 Criar testes red para principal recusada, duplicidade ativa, documento UAT invalido e endereco incompleto.
- [ ] 6.3 Implementar orquestracao de `requestNegativacao` usando model, builder e HTTP client.
- [ ] 6.4 Persistir solicitacoes locais antes de chamar Serasa.
- [ ] 6.5 Enviar divida principal e atualizar `transactionId`/status.
- [ ] 6.6 Enviar garantidores selecionados sequencialmente, cada um com rastreio proprio.
- [ ] 6.7 Tratar falhas Serasa por registro, com `ERROR_MESSAGE` e `ERROR_STATUS_CODE`.
- [ ] 6.8 Garantir que retorno ao controller detalhe principal, garantidores, status e mensagem "aguardando retorno".
- [ ] 6.9 Refatorar mantendo funcoes pequenas e sem SQL/HTTP espalhados fora das camadas corretas.

## Detalhes de Implementacao

Usar as secoes "Interfaces Principais", "Fluxo", "Validacoes bloqueantes" e "Consideracoes Tecnicas" do `techspec.md`. Esta task e de alta complexidade e deve seguir red-green-refactor: primeiro testes de comportamento do service com model e HTTP client fake, depois implementacao.

Nao implementar retry automatico para POST em erro de rede/timeout. Se a Serasa recebeu a requisicao e a resposta se perdeu, reenviar automaticamente pode criar duplicidade externa.

## Criterios de Sucesso

- Fluxo principal persiste rastreabilidade local antes da chamada Serasa.
- `HTTP 200` inicial gera `AGUARDANDO_RETORNO`, nunca `NEGATIVADO_SUCESSO`.
- Garantidores sao enviados apenas depois do `transactionId` da principal.
- Erro de garantidor nao altera indevidamente o status da principal.
- Duplicidade ativa e bloqueada antes de enviar para fora.

## Testes da Tarefa

- [ ] Testes de unidade: service com model/client fake cobrindo fluxo feliz, principal recusada, garantidor recusado, duplicidade, UAT bloqueado e endereco faltante.
- [ ] Testes de integracao: rota de envio sera coberta na task 8.0/9.0 com supertest e cliente Serasa fake.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinHttpClient.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.js`
