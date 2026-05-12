# Tech Spec - Integracao Serasa PEFIN

## Resumo Executivo

A integracao sera implementada dentro do modulo `inadimplencia`, mantendo o padrao MVC existente: `routes/ -> controllers/ -> services/ -> models/`. O backend sera o unico ponto de contato com a Serasa, armazenando credenciais no `.env` com prefixo `INAD_`, enviando uma divida por requisicao, persistindo `transactionId` e conciliando o resultado final por webhooks.

A primeira entrega cobre UAT, inclusao PEFIN da divida principal e envio sequencial de garantidores. Decisoes fechadas: `categoryId=FI`, `contractNumber=NUM_VENDA`, webhooks sem autenticacao por ambiente controlado, inclusao de `FIADOR`, conjuge, cessionario e coobrigado, e bloqueio do envio quando qualquer endereco obrigatorio estiver incompleto.

## Arquitetura do Sistema

### Visao Geral dos Componentes

- **`serasaPefinRoutes.js`**: novo router em `/serasa-pefin`, montado em `index.js` e `legacyApp.js`.
- **`serasaPefinController.js`**: valida parametros HTTP, preserva envelope `{ data }` e delega erros com `next(err)`.
- **`serasaPefinService.js`**: orquestra elegibilidade, validacao, dedupe, envio principal, envio de garantidores e tratamento de webhook.
- **`serasaPefinHttpClient.js`**: integra com Serasa usando `fetch`/`node-fetch`, token Bearer cacheado, timeout com `AbortController` e refresh em 401.
- **`serasaPefinPayloadBuilder.js`**: monta payloads Serasa para divida e garantidor a partir da venda, credor, devedor e garantidores.
- **`serasaPefinModel.js`**: SQL Server. Consulta venda/garantidores, cria solicitacoes, atualiza status por `transactionId`, registra webhooks.
- **`config/env.js`**: adiciona configs `SERASA_*`, sempre resolvidas de `INAD_SERASA_*`.
- **`swagger.js`**: documenta endpoints internos e webhooks.
- **SQL migration**: cria `dbo.SERASA_PEFIN_SOLICITACOES` e `dbo.SERASA_PEFIN_WEBHOOKS`.

Fluxo: frontend solicita preview/envio -> service valida venda e dados obrigatorios -> repository cria registros `PENDENTE_ENVIO` em transacao -> cliente Serasa envia divida principal -> grava `transactionId` e `AGUARDANDO_RETORNO` -> envia garantidores selecionados -> webhook atualiza cada solicitacao por `uuid`.

## Design de Implementacao

### Interfaces Principais

```js
async function createPreview({ numVenda }) // retorna dados, garantidores e missingFields
async function requestNegativacao({ numVenda, operador, garantidoresSelecionados, overrides })
async function handleWebhook({ eventType, payload }) // uuid -> transactionId
```

```js
async function postDebt(payload) // POST /collection/debt/
async function postGuarantor(payload) // POST /collection/debt/guarantor
async function getBearerToken({ forceRefresh = false })
```

### Modelos de Dados

Tabela `dbo.SERASA_PEFIN_SOLICITACOES`:

- `ID uniqueidentifier`, `NUM_VENDA_FK int`, `TIPO_REGISTRO varchar(20)` (`PRINCIPAL|GARANTIDOR`)
- `ID_SOLICITACAO_PRINCIPAL uniqueidentifier null`, `ID_ASSOCIADO varchar(64) null`, `TIPO_ASSOCIACAO varchar(64) null`
- `DOCUMENTO_DEVEDOR varchar(20)`, `DOCUMENTO_GARANTIDOR varchar(20) null`, `DOCUMENTO_CREDOR varchar(20)`
- `CONTRACT_NUMBER varchar(20)`, `CATEGORY_ID char(2)`, `AREA_INFORMANTE varchar(4)`
- `VALOR decimal(15,2)`, `DATA_VENCIMENTO date`, `STATUS varchar(32)`
- `TRANSACTION_ID varchar(64) null`, `CADUS_KEY varchar(64) null`, `CADUS_SERIE varchar(64) null`
- `PAYLOAD_AUDITORIA nvarchar(max)`, `WEBHOOK_PAYLOAD nvarchar(max)`, `ERROR_MESSAGE nvarchar(1000)`, `ERROR_STATUS_CODE int`
- `OPERADOR varchar(255)`, `DT_CRIACAO datetime2`, `DT_ATUALIZACAO datetime2`

Tabela `dbo.SERASA_PEFIN_WEBHOOKS`:

- `ID uniqueidentifier`, `EVENT_TYPE varchar(64)`, `TRANSACTION_ID varchar(64) null`
- `PAYLOAD nvarchar(max)`, `MATCHED_SOLICITACAO_ID uniqueidentifier null`
- `PROCESSADO bit`, `MENSAGEM_ERRO nvarchar(1000) null`, `DT_RECEBIMENTO datetime2`

Status internos: `PENDENTE_ENVIO`, `ENVIADO_SERASA`, `AGUARDANDO_RETORNO`, `NEGATIVADO_SUCESSO`, `NEGATIVADO_ERRO`.

Validacoes bloqueantes:

- `NUM_VENDA` existente em `DW.fat_analise_inadimplencia_v4` e inadimplente.
- UAT permite apenas documentos da massa Serasa em todos os participantes enviados.
- Valor minimo `10.00`, `dueDate` em `YYYY-MM-DD`, `categoryId=FI`, `contractNumber=String(NUM_VENDA)`.
- Endereco do devedor e de cada garantidor deve conter `zipCode`, `addressLine`, `district`, `city`, `state`. Se faltar, retornar `400 { error, missingFields }`.
- Duplicidade ativa para mesmo `NUM_VENDA`, contrato, devedor e garantidor deve ser bloqueada em transacao `SERIALIZABLE` com `UPDLOCK,HOLDLOCK`.

### Endpoints de API

- `GET /inadimplencia/serasa-pefin/vendas/:numVenda/preview`: retorna dados de revisao, garantidores elegiveis e lacunas.
- `POST /inadimplencia/serasa-pefin/vendas/:numVenda/negativacoes`: solicita negativacao da divida e garantidores selecionados.
- `GET /inadimplencia/serasa-pefin/vendas/:numVenda/negativacoes`: historico por venda.
- `GET /inadimplencia/serasa-pefin/negativacoes/:id`: detalhe tecnico-operacional.
- `POST /inadimplencia/serasa-pefin/webhooks/inclusao/sucesso`: webhook Serasa para divida principal com sucesso.
- `POST /inadimplencia/serasa-pefin/webhooks/inclusao/erro`: webhook Serasa para divida principal com erro.
- `POST /inadimplencia/serasa-pefin/webhooks/avalista/sucesso`: webhook Serasa para garantidor com sucesso.
- `POST /inadimplencia/serasa-pefin/webhooks/avalista/erro`: webhook Serasa para garantidor com erro.

Os webhooks nao terao autenticacao na aplicacao. Requests server-to-server sem `Origin` ja passam pelo `originGuard`; a protecao fica na rede/infra controlada.

## Pontos de Integracao

- **Serasa Auth**: `POST INAD_SERASA_AUTH_URL`, Basic gerado a partir de `INAD_SERASA_CLIENT_ID` e `INAD_SERASA_CLIENT_SECRET`.
- **Serasa Inclusao**: `POST INAD_SERASA_DEBT_URL`, default UAT `https://api.serasa.dev/collection/debt/`.
- **Serasa Garantidor**: `POST INAD_SERASA_GUARANTOR_URL`, default UAT `https://api.serasa.dev/collection/debt/guarantor`.
- **SQL Server**: persistencia via `mssql` e `getPool()`, todas as queries parametrizadas.
- **DW Fiadores**: `DW.vw_fiadores_por_venda`, filtrando `TIPO_ASSOCIACAO` para fiador, conjuge, cessionario e coobrigado.

Nao fazer retry automatico de `POST` de inclusao em timeout ou erro de rede, para evitar duplicidade quando a Serasa recebeu a requisicao mas a resposta se perdeu. Retry automatico permitido apenas para token expirado antes do envio efetivo.

## Abordagem de Testes

### Testes Unidade

- Validators: documentos UAT, valor minimo, datas, endereco incompleto com `missingFields`, tipos de garantidor.
- Payload builder: divida principal e garantidor com `categoryId=FI`, `contractNumber=NUM_VENDA` e `debtType=PEFIN`.
- Http client: cache de token, timeout, refresh em 401, mascaramento de logs.
- Service: principal aceito, principal recusado, garantidor recusado sem alterar status principal, dedupe ativo.
- Model: SQL parametrizado, transacao de criacao, update por `transactionId`.
- Controller: envelopes `{ data }`, `400` validavel, erros inesperados via `next(err)`.

### Testes de Integracao

- Rotas com `supertest`/Vitest e cliente Serasa fake: envio principal + dois garantidores, historico e webhook.
- Webhook sem solicitacao correspondente: deve gravar em `SERASA_PEFIN_WEBHOOKS` e responder `200`.
- UAT com documento fora da massa: `400` antes de chamar o cliente HTTP.

### Testes de E2E

Quando o frontend consumir estes endpoints, validar com Playwright MCP: preview, bloqueio por endereco faltante, envio aceito com status "aguardando retorno" e atualizacao apos webhook simulado.

## Sequenciamento de Desenvolvimento

### Ordem de Construcao

1. SQL migration e model repository, pois o fluxo depende de persistencia antes do envio.
2. Validators e payload builder, isolando regras Serasa antes do HTTP.
3. Http client com token cacheado e timeout.
4. Service de preview/envio e tratamento de status.
5. Rotas/controllers e montagem em `index.js`/`legacyApp.js`.
6. Webhooks e conciliacao por `uuid`.
7. Swagger, testes e smoke em UAT.

### Dependencias Tecnicas

- Credenciais UAT Serasa e IP de saida liberado no Brasil.
- URLs publicas dos 4 webhooks cadastradas na Serasa.
- `INAD_SERASA_CREDITOR_DOCUMENT`, `INAD_SERASA_AREA_INFORMANTE`, `INAD_SERASA_CLIENT_ID`, `INAD_SERASA_CLIENT_SECRET`.
- Fonte estruturada de endereco para devedor e garantidores; se vier incompleta, o backend bloqueia o envio.

## Monitoramento e Observabilidade

- Logs `INFO`: solicitacao criada, `transactionId` recebido, webhook processado.
- Logs `WARN`: webhook sem solicitacao, documento bloqueado em UAT, endereco incompleto.
- Logs `ERROR`: falha Serasa, falha de token, falha de persistencia. Nunca logar `clientSecret`, Bearer Token ou payload com documentos sem mascaramento.
- Metricas desejadas: `serasa_pefin_requests_total{tipo,status}`, `serasa_pefin_webhooks_total{event_type,matched}`, `serasa_pefin_http_duration_seconds`, `serasa_pefin_token_refresh_total{status}`.

## Consideracoes Tecnicas

### Decisoes Principais

- Usar `fetch`/`node-fetch` como nas integracoes existentes do modulo, evitando adicionar novo padrao HTTP.
- Persistir antes de enviar para reduzir perda de rastreabilidade; atualizar `transactionId` imediatamente apos `HTTP 200`.
- Enviar garantidores somente depois do `transactionId` da divida principal, sem esperar webhook de sucesso.
- Webhook sem autenticacao por decisao de ambiente controlado; mitigacao por rede, HTTPS e cadastro de IPs.
- Sem retry automatico em `POST` de negocio para evitar duplicidade externa.

### Riscos Conhecidos

- Se o update do `transactionId` falhar apos `HTTP 200`, a conciliacao pode depender de log operacional; mitigar com alerta `ERROR` e investigacao manual.
- `DW.vw_fiadores_por_venda` hoje expoe `ENDERECO` como campo unico; se nao houver campos estruturados, o envio sera bloqueado ate a origem fornecer dados completos.
- Webhook sem autenticacao aumenta dependencia de controles de rede.
- Varias instancias PM2 terao cache de token separado; aceitavel em UAT, mas deve ser monitorado.

### Conformidade com Padroes

- `.windsurf/rules/techspec-codebase.md`: respeita MVC, `services/` para integracao externa, SQL apenas em `models/`, `getPool()`, env `INAD_`, resposta `{ data }`/`{ error }`, Swagger atualizado e origem sem `Origin` aceita.
- `src/modules/inadimplencia/docs/techspec-codebase.md`: mantem rotas prefixadas e legacy, queries parametrizadas, errors com `err.statusCode`, sem segredos em logs.
- `software-architecture`: separacao de dominio, infra e controllers; reutiliza stack existente em vez de introduzir dependencia sem necessidade.

### Arquivos relevantes e dependentes

- `src/modules/inadimplencia/routes/serasaPefinRoutes.js`
- `src/modules/inadimplencia/controllers/serasaPefinController.js`
- `src/modules/inadimplencia/services/serasaPefinService.js`
- `src/modules/inadimplencia/services/serasaPefinHttpClient.js`
- `src/modules/inadimplencia/services/serasaPefinPayloadBuilder.js`
- `src/modules/inadimplencia/models/serasaPefinModel.js`
- `src/modules/inadimplencia/config/env.js`
- `src/modules/inadimplencia/index.js`
- `src/modules/inadimplencia/legacyApp.js`
- `src/modules/inadimplencia/swagger.js`
- `src/modules/inadimplencia/docs/sql/2026-05-11-serasa-pefin.sql`
- `tasks/prd-integracao-serasa-pefin/prd.md`
- `documentos/documentacao-serasa-pefin-v8.md`
