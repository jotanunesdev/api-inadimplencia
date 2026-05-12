# Tarefa 10.0: Corrigir contratos Serasa de autenticacao e retorno inicial

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>HIGH</complexity>

Corrigir a compatibilidade do backend com os contratos documentados pela Serasa para autenticacao e resposta inicial de inclusao. Hoje o cliente HTTP espera campos em `snake_case` no login e o service espera `uuid` no retorno inicial de inclusao, mas a documentacao informa `accessToken`, `expiresIn` e `transactionId`. Esta tarefa deve garantir que a integracao autentique corretamente e persista o identificador usado depois pelos webhooks.

<requirements>
- Ler `tasks/prd-integracao-serasa-pefin/prd.md`, `tasks/prd-integracao-serasa-pefin/techspec.md` e `documentos/documentacao-serasa-pefin-v8.md`.
- Em `serasaPefinHttpClient.js`, aceitar a resposta de autenticacao documentada pela Serasa: `accessToken`, `tokenType` e `expiresIn`.
- Manter compatibilidade defensiva com `access_token` e `expires_in`, desde que isso nao esconda erro quando nenhum token vier.
- Interpretar corretamente o tempo de expiracao do token e manter o buffer de renovacao ja existente.
- Em `serasaPefinService.js`, persistir `transactionId` retornado no `HTTP 200` inicial de `postDebt` e `postGuarantor`.
- Nao tratar o `HTTP 200` inicial como sucesso final da negativacao; o status deve continuar `AGUARDANDO_RETORNO`.
- Aceitar `cadusKey`/`cadusSerie` quando vierem em camelCase e `CADUS_KEY`/`CADUS_SERIE` se algum fake legado ainda usar esse formato.
- Garantir que webhook continue conciliando por `payload.uuid`, conforme documentacao.
- Nao expor `clientSecret`, Basic Auth ou Bearer Token em erros, logs ou respostas.
</requirements>

## Subtarefas

- [x] 10.1 Revisar a secao de autenticacao e resposta inicial em `documentos/documentacao-serasa-pefin-v8.md`.
- [x] 10.2 Ajustar `fetchBearerToken` para ler `accessToken` e `expiresIn`, mantendo fallback controlado para nomes antigos.
- [x] 10.3 Ajustar testes do HTTP client para usar o contrato real da Serasa em pelo menos um caso feliz.
- [x] 10.4 Criar helper pequeno no service, se necessario, para extrair `transactionId`, `cadusKey` e `cadusSerie` sem duplicacao.
- [x] 10.5 Corrigir envio principal para gravar `principalResponse.transactionId`.
- [x] 10.6 Corrigir envio de garantidores para gravar `guarantorResponse.transactionId`.
- [x] 10.7 Garantir que erro claro seja lancado se a Serasa responder `200` sem `transactionId`.
- [x] 10.8 Garantir que webhooks continuem usando `uuid` como chave de conciliacao.
- [x] 10.9 Atualizar ou criar testes para provar que `TRANSACTION_ID` fica preenchido com `transactionId`.

## Detalhes de Implementacao

Seguir as secoes "Autenticacao", "Bearer Token", "Response das Requisicoes de Inclusao" e "Payload de Resposta - Inclusao" da documentacao Serasa. No `techspec.md`, seguir "Pontos de Integracao" e "Fluxo" da arquitetura.

O fluxo correto e:

- Login Serasa retorna `accessToken`.
- POST de inclusao retorna `transactionId`.
- Banco grava `TRANSACTION_ID = transactionId`.
- Webhook posterior retorna `uuid`, que deve bater com o `TRANSACTION_ID` persistido.

## Criterios de Sucesso

- Autenticacao funciona com payload Serasa `{ accessToken, tokenType, expiresIn }`.
- Envios principal e garantidor gravam `TRANSACTION_ID` com o valor de `transactionId`.
- Uma resposta inicial sem `transactionId` falha de forma explicita antes de deixar solicitacao como aguardando retorno sem chave.
- Webhook de sucesso/erro encontra solicitacao persistida pelo `uuid`.
- Nenhum segredo aparece em erro ou resposta de teste.

## Testes da Tarefa

- [x] Testes de unidade: `serasaPefinHttpClient.test.js` cobrindo `accessToken`/`expiresIn`, cache de token e ausencia de token.
- [x] Testes de unidade: service cobrindo principal e garantidor com resposta `{ transactionId }`.
- [x] Testes de integracao: fluxo com fake HTTP retornando `transactionId` e webhook posterior com `uuid` conciliando a solicitacao.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinHttpClient.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinHttpClient.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\serasaPefin.integration.test.js`
- `c:\api-inadimplencia\documentos\documentacao-serasa-pefin-v8.md`
