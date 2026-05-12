# Tarefa 7.0: Webhooks de sucesso/erro para principal e avalista/fiador com conciliacao por `uuid`

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>HIGH</complexity>

Implementar o processamento dos webhooks assincronos da Serasa, conciliando `payload.uuid` com `TRANSACTION_ID`, atualizando status final da solicitacao e preservando eventos sem match para investigacao.

<requirements>
- Implementar `handleWebhook({ eventType, payload })` no service.
- Tratar eventos de inclusao principal com sucesso e erro.
- Tratar eventos de avalista/fiador com sucesso e erro.
- Usar `uuid` do webhook como `transactionId`.
- Atualizar solicitacao encontrada para `NEGATIVADO_SUCESSO` ou `NEGATIVADO_ERRO`.
- Quando houver `error`, persistir mensagem e `statusCode` para consulta operacional.
- Registrar todo webhook bruto/sanitizado em `SERASA_PEFIN_WEBHOOKS`.
- Webhook sem solicitacao correspondente deve responder como processado pelo service, registrar `matched=false` e nao derrubar futuras mensagens.
- Nao exigir autenticacao de aplicacao nesta entrega, conforme decisao da tech spec; seguranca fica em HTTPS/rede/IPs.
- Garantir idempotencia basica: o mesmo webhook repetido nao deve corromper historico nem regredir status final indevidamente.
</requirements>

## Subtarefas

- [ ] 7.1 Criar testes red para webhook sucesso principal, erro principal, sucesso garantidor e erro garantidor.
- [ ] 7.2 Criar teste red para webhook sem match retornando sucesso operacional e gravando investigacao.
- [ ] 7.3 Implementar extracao robusta de `uuid`, erro, mensagem e status code do payload Serasa.
- [ ] 7.4 Implementar mapeamento de `eventType` para status final.
- [ ] 7.5 Implementar atualizacao por `transactionId` usando o model.
- [ ] 7.6 Implementar registro de webhook bruto/sanitizado, matched e mensagem de processamento.
- [ ] 7.7 Implementar idempotencia para repeticao do mesmo evento.
- [ ] 7.8 Garantir retorno pronto para controller responder `200 { data }`.

## Detalhes de Implementacao

Usar as secoes "Webhook de retorno da Serasa", "Endpoints de API" e "Modelos de Dados" do `techspec.md`. Esta task e de alta complexidade porque define o resultado final de negocio; usar red-green-refactor com service e model fake antes de integrar com HTTP.

O webhook e obrigatorio para confirmar sucesso ou erro real. O envio inicial nao deve ser tratado como negativacao concluida.

## Criterios de Sucesso

- `uuid` recebido pela Serasa atualiza a solicitacao correta.
- Eventos de erro ficam visiveis no historico e detalhe.
- Eventos sem match ficam gravados sem falhar o endpoint.
- Reprocessamento do mesmo webhook nao gera regressao de status nem duplicidade critica.
- O service fica pronto para ser exposto nas quatro rotas da task 8.0.

## Testes da Tarefa

- [ ] Testes de unidade: sucesso/erro principal, sucesso/erro garantidor, webhook sem match, payload sem `uuid`, repeticao de evento e erro persistido.
- [ ] Testes de integracao: rota real sera coberta na task 8.0/9.0 com supertest.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\docs\sql\2026-05-11-serasa-pefin.sql`
