# PRD - Integracao Serasa PEFIN para Negativacao

## Visao Geral

O modulo `inadimplencia` precisa permitir que a equipe de cobranca envie solicitacoes de negativacao PEFIN para a Serasa Experian a partir da carteira inadimplente ja operada no sistema. A integracao deve ocorrer primeiro no ambiente UAT, usando as credenciais de homologacao configuradas no `.env` do modulo, e deve respeitar o modelo assincrono da API: o `HTTP 200` inicial com `transactionId` confirma apenas recebimento, enquanto o resultado real chega depois por webhook.

O valor de negocio e reduzir operacao manual, criar rastreabilidade das negativacoes e permitir que operadores e gestores acompanhem o ciclo completo: solicitacao, envio, retorno, sucesso ou erro.

Fontes usadas para este PRD: solicitacao do usuario, `documentos/documentacao-serasa-pefin-v8.md` e `src/modules/inadimplencia/docs/techspec-codebase.md`.

## Objetivos

- Permitir envio de negativacao PEFIN de uma venda inadimplente elegivel para a Serasa em ambiente UAT.
- Registrar `transactionId`, status interno, payload minimo de auditoria e retorno de webhook para conciliacao.
- Evitar exposicao de `clientID`, `clientSecret` ou Bearer Token no frontend.
- Impedir uso de documentos reais em UAT, aceitando apenas a massa de teste informada pela Serasa.
- Disponibilizar ao usuario operacional uma visao clara do status da negativacao e mensagens de erro retornadas.

Metricas de sucesso:

- 100% das solicitacoes aceitas pela Serasa em UAT ficam registradas com `transactionId`.
- 100% dos webhooks recebidos atualizam a solicitacao correspondente pelo `transactionId`/`uuid`.
- 0 chamada direta do frontend para endpoints da Serasa.
- 0 envio em lote, pois a API Serasa exige uma divida por requisicao.
- 0 negativacao UAT com CPF/CNPJ fora da massa de teste homologada.

## Historias de Usuario

- Como operador de cobranca, quero solicitar a negativacao de uma venda inadimplente a partir do sistema para nao precisar operar manualmente em canais externos.
- Como operador, quero revisar dados do devedor, contrato, valor, vencimento e natureza da divida antes do envio para reduzir erros.
- Como operador, quero acompanhar o status "aguardando retorno", "negativado com sucesso" ou "erro" para saber se a acao foi concluida.
- Como gestor, quero consultar historico de envios e retornos por venda, cliente e operador para auditoria e acompanhamento da carteira.
- Como administrador tecnico, quero configurar credenciais e endpoints por ambiente sem alterar codigo e sem expor segredos ao frontend.

## Funcionalidades Principais

### 1. Solicitacao de negativacao PEFIN

O sistema deve permitir que uma venda inadimplente gere uma solicitacao de inclusao de divida na Serasa. O usuario deve informar ou confirmar os dados exigidos: valor, `areaInformante`, data de vencimento, natureza da divida (`categoryId`), devedor, credor, numero do contrato e tipo da divida `PEFIN`.

Requisitos funcionais:

- **FR-1** O backend deve aceitar solicitacoes de negativacao apenas para registros de inadimplencia existentes no modulo.
- **FR-2** Cada solicitacao deve representar uma unica divida, sem envio em lote.
- **FR-3** O sistema deve validar campos obrigatorios antes de enviar a Serasa e retornar erro claro quando faltar dado.
- **FR-4** O ambiente UAT deve bloquear CPF/CNPJ fora da massa de teste definida na documentacao Serasa.
- **FR-5** O backend deve usar credenciais e URLs do ambiente configurado no `.env`, nunca valores enviados pelo frontend.
- **FR-6** A resposta inicial com `transactionId` deve criar/atualizar o status interno como `AGUARDANDO_RETORNO`.
- **FR-7** O usuario deve conseguir consultar o historico de solicitacoes por venda e visualizar status, data de envio, operador, contrato, valor e mensagem de erro quando houver.

### 2. Webhook de retorno da Serasa

A integracao deve receber os eventos assincronos da Serasa para confirmar sucesso ou erro da inclusao. O campo `uuid` do webhook corresponde ao `transactionId` recebido no envio.

Requisitos funcionais:

- **FR-8** O backend deve disponibilizar endpoint(s) de webhook para eventos de inclusao de divida com sucesso e com erro.
- **FR-9** Todo webhook valido deve atualizar a solicitacao correspondente para `NEGATIVADO_SUCESSO` ou `NEGATIVADO_ERRO`.
- **FR-10** Quando o webhook trouxer `error`, a mensagem e o statusCode devem ficar disponiveis para consulta pelo usuario.
- **FR-11** Webhooks sem solicitacao correspondente devem ser registrados para investigacao, sem quebrar o processamento de novas mensagens.
- **FR-12** O sistema deve suportar autenticacao do webhook definida na homologacao com a Serasa, preferencialmente com HTTPS e credencial/tokens configuraveis.

### 3. Controle operacional e auditoria

A negativacao deve ter rastreabilidade suficiente para atendimento, suporte e conciliacao.

Requisitos funcionais:

- **FR-13** O sistema deve evitar duplicidade de negativacao ativa para o mesmo devedor, contrato e venda.
- **FR-14** O sistema deve manter trilha de status: `PENDENTE_ENVIO`, `ENVIADO_SERASA`, `AGUARDANDO_RETORNO`, `NEGATIVADO_SUCESSO`, `NEGATIVADO_ERRO`.
- **FR-15** Dados sensiveis devem ser mascarados em logs e respostas quando nao forem necessarios para a operacao.
- **FR-16** A documentacao OpenAPI do modulo deve refletir endpoints internos de solicitacao, consulta e webhook.

### 4. Inclusao de avalista/fiador

A entrega deve tratar tambem a inclusao de avalista, coobrigado ou fiador. A API Serasa exige que essa inclusao seja enviada apos a inclusao da divida principal, referenciando o mesmo `contractNumber` e mantendo rastreabilidade propria do retorno.

Requisitos funcionais:

- **FR-17** O fluxo de negativacao deve permitir incluir avalistas/fiadores vinculados a venda inadimplente.
- **FR-18** A inclusao de avalista/fiador deve ocorrer somente depois que a divida principal for enviada e receber `transactionId`.
- **FR-19** Cada avalista/fiador enviado deve ter rastreio proprio de `transactionId`, status e retorno de webhook.
- **FR-20** O usuario deve conseguir revisar os dados do avalista/fiador antes do envio, incluindo documento, nome, endereco, valor, vencimento, contrato e documento do devedor principal.
- **FR-21** Erros de inclusao de avalista/fiador nao devem apagar nem sobrescrever o status da divida principal; o historico deve diferenciar principal e garantidores.

## Experiencia do Usuario

O operador deve iniciar a acao a partir do detalhe da venda inadimplente. Antes do envio, o sistema deve apresentar uma revisao objetiva dos dados que serao usados na Serasa, com destaque para valor, vencimento, contrato, documento do devedor, documento do credor, natureza da divida e avalistas/fiadores selecionados.

Depois do envio, a tela deve comunicar que a solicitacao foi recebida pela Serasa e que o resultado final depende do webhook. A interface nao deve tratar `HTTP 200` como sucesso de negativacao. Historico e status devem ser visiveis no contexto da venda para reduzir duvidas operacionais.

Mensagens de erro devem ser acionaveis: indicar campo ausente, documento nao permitido em UAT, falha de autenticacao, erro Serasa ou retorno pendente.

## Restricoes Tecnicas de Alto Nivel

- A API Serasa PEFIN e assincrona; webhook e obrigatorio para resultado final.
- UAT usa autenticacao em `https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login` e inclusao em `https://api.serasa.dev/collection/debt/`.
- O token Bearer expira em curto prazo e deve ser tratado apenas no backend.
- Credenciais devem ficar no `.env` do modulo `src/modules/inadimplencia/.env`, com prefixo `INAD_`.
- Em UAT, somente documentos da massa de teste Serasa podem ser enviados.
- A infraestrutura deve considerar restricao de IPs brasileiros para chamadas Serasa e eventual liberacao de IPs para recebimento de webhooks.
- Dados pessoais e financeiros devem seguir principios de minimizacao, mascaramento em logs e acesso restrito.

## Fora de Escopo

- Baixa/exclusao de negativacao nesta primeira entrega.
- Envio para producao com credenciais definitivas.
- Cadastro operacional dos endpoints de webhook junto a Serasa, embora a entrega dependa dele para homologacao completa.
- Envio de boleto (`bankSlip`) ou contato digital (`debtorDigitalContact`) se nao houver confirmacao contratual.
- Envio em lote.
- Chamada direta da Serasa pelo frontend.
- Automacao do processo de liberacao de IPs com a Serasa.

## Questoes em Aberto

- Qual `categoryId` padrao deve ser usado para dividas imobiliarias da JotaNunes: `IM`, `FI`, `TC` ou outro definido pelo negocio?
- O campo `areaInformante` tera valor fixo por contrato, por empreendimento ou por unidade operacional?
- Qual sera o formato oficial do `contractNumber`: `NUM_VENDA`, contrato RM ou outro identificador?
- Quais tipos de associado devem ser enviados como avalista/fiador: somente `FIADOR` ou tambem conjuge, cessionario e coobrigado?
- Qual origem sera considerada autoritativa para endereco completo do avalista/fiador quando o DW estiver incompleto?
- Qual autenticacao a Serasa deve usar ao chamar nosso webhook: Basic, OAuth, Basic com JWT ou outra camada corporativa?
- Quais URLs publicas de webhook e IPs de saida/entrada serao informados para cadastro na Serasa?
