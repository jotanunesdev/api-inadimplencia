# Guia de Integração Serasa PEFIN

**Versão:** 1.0  
**Data:** Maio 2026  
**Módulo:** inadimplência  
**Status:** Homologação UAT

---

## Sumário

1. [Introdução](#introdução)
2. [Arquitetura](#arquitetura)
3. [Componentes Técnicos](#componentes-técnicos)
4. [Fluxos de Integração](#fluxos-de-integração)
5. [Configuração de Ambiente](#configuração-de-ambiente)
6. [Modelo de Dados](#modelo-de-dados)
7. [Validações e Regras de Negócio](#validações-e-regras-de-negócio)
8. [Processo Operacional](#processo-operacional)
9. [Troubleshooting](#troubleshooting)
10. [Exemplos Práticos](#exemplos-práticos)
11. [Apêndices](#apêndices)

---

## Introdução

### Objetivo da Integração

A integração Serasa PEFIN permite que a equipe de cobrança envie solicitações de negativação PEFIN para a Serasa Experian a partir da carteira inadimplente operada no sistema. A integração opera de forma assíncrona: o envio inicial retorna um `transactionId` confirmando apenas o recebimento, enquanto o resultado final (sucesso ou erro) chega via webhook.

### Escopo e Limitações

**Escopo atual:**
- Envio de dívida principal PEFIN
- Envio de avalistas/fiadores vinculados à venda
- Ambiente de homologação UAT
- Webhooks para confirmação de sucesso/erro
- Histórico e detalhamento operacional
- Bloqueio de duplicidade ativa
- Validação de documentos UAT

**Fora do escopo:**
- Baixa/exclusão de negativação
- Envio para produção
- Envio de boleto ou contato digital
- Envio em lote
- Autenticação de webhooks (sem autenticação por ambiente controlado)

### Referências

- **PRD:** `tasks/prd-integracao-serasa-pefin/prd.md`
- **Tech Spec:** `tasks/prd-integracao-serasa-pefin/techspec.md`
- **Documentação Serasa:** `documentos/documentacao-serasa-pefin-v8.md`
- **Guia de Testes:** `documentos/guia-testes-serasa-pefin.md`
- **Checklist Homologação:** `tasks/prd-integracao-serasa-pefin/homologacao-uat.md`

---

## Arquitetura

### Visão Geral dos Componentes

```
Frontend → Routes → Controller → Service → Model → SQL Server
                     ↓              ↓         ↓
                  HTTP Client  Payload  Webhook
                                Builder  Handler
```

**Componentes:**
- **serasaPefinRoutes.js**: 8 endpoints REST
- **serasaPefinController.js**: Validação HTTP e serialização
- **serasaPefinService.js**: Orquestração de negócio
- **serasaPefinHttpClient.js**: Comunicação com Serasa
- **serasaPefinPayloadBuilder.js**: Construção de payloads
- **serasaPefinModel.js**: Persistência SQL Server
- **config/env.js**: Configuração de ambiente

### Padrões Utilizados

- **MVC**: Separação clara de responsabilidades
- **Injeção de Dependências**: Services aceitam `dependencies = {}`
- **Transações ACID**: `SERIALIZABLE` com `UPDLOCK,HOLDLOCK`
- **Mascaramento de Dados**: Documentos e segredos nunca expostos

---

## Componentes Técnicos

### Endpoints

```
GET  /inadimplencia/serasa-pefin/vendas/:numVenda/preview
POST /inadimplencia/serasa-pefin/vendas/:numVenda/negativacoes
GET  /inadimplencia/serasa-pefin/vendas/:numVenda/negativacoes
GET  /inadimplencia/serasa-pefin/negativacoes/:id
POST /inadimplencia/serasa-pefin/webhooks/inclusao/sucesso
POST /inadimplencia/serasa-pefin/webhooks/inclusao/erro
POST /inadimplencia/serasa-pefin/webhooks/avalista/sucesso
POST /inadimplencia/serasa-pefin/webhooks/avalista/erro
POST /inadimplencia/serasa-pefin/webhooks/baixa/sucesso
POST /inadimplencia/serasa-pefin/webhooks/baixa/erro
```

### Responsabilidades

**Controller**: Valida parâmetros HTTP, serializa erros, mascara documentos
**Service**: Orquestra elegibilidade, envio, webhooks e conciliação
**HTTP Client**: Auth Bearer, cache token, timeout, refresh 401
**Payload Builder**: Validações, normalização, construção de payloads
**Model**: SQL parametrizado, transações, dedupe, persistência

---

## Fluxos de Integração

### Fluxo de Inclusão Principal

1. Frontend solicita negativação
2. Controller valida parâmetros
3. Service consulta DW e valida dados
4. Model persiste em transação SERIALIZABLE
5. HTTP Client envia para Serasa
6. Serasa retorna transactionId
7. Model atualiza status para AGUARDANDO_RETORNO
8. Service envia garantidores sequencialmente
9. Response 201 com transactionIds

### Fluxo de Webhook

1. Serasa dispara webhook
2. Controller recebe payload
3. Service extrai uuid como transactionId
4. Model busca solicitação por transactionId
5. Model atualiza status (SUCESSO ou ERRO)
6. Model registra webhook para auditoria
7. Response 200

### Conciliação

- transactionId é chave de conciliação
- uuid do webhook = transactionId
- Webhook sem match é registrado mas não falha
- Idempotente: reenvio não causa erro

---

## Configuração de Ambiente

### Variáveis de Ambiente

**Obrigatórias:**
```bash
INAD_SERASA_CLIENT_ID=seu-client-id
INAD_SERASA_CLIENT_SECRET=seu-client-secret
INAD_SERASA_CREDITOR_DOCUMENT=seu-cnpj
INAD_SERASA_AREA_INFORMANTE=ABCD
```

**Opcionais (defaults UAT):**
```bash
INAD_SERASA_AUTH_URL=https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login
INAD_SERASA_DEBT_URL=https://api.serasa.dev/collection/debt/
INAD_SERASA_GUARANTOR_URL=https://api.serasa.dev/collection/debt/guarantor
INAD_SERASA_UAT_ENABLED=true
INAD_SERASA_HTTP_TIMEOUT_MS=10000
```

### URLs por Ambiente

**UAT:**
- Auth: `https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login`
- Debt: `https://api.serasa.dev/collection/debt/`
- Guarantor: `https://api.serasa.dev/collection/debt/guarantor`

**Produção:** (configurar manualmente)
- Auth: `https://api.serasaexperian.com.br/security/iam/v1/client-identities/login`
- Debt: `https://api.serasa.com.br/collection/debt/`
- Guarantor: `https://api.serasa.com.br/collection/debt/guarantor`

### Liberação de IPs

**Serasa IPs (webhooks):**
- UAT: `34.193.175.234`, `52.20.7.153`, `35.175.32.186`
- Produção: `52.1.15.220`, `34.231.117.105`

**Contato para liberação:** `suporteapicollection@experian.com`

---

## Modelo de Dados

### SERASA_PEFIN_SOLICITACOES

**Campos principais:**
- `ID`: GUID único
- `NUM_VENDA_FK`: Referência venda
- `TIPO_REGISTRO`: PRINCIPAL ou GARANTIDOR
- `DOCUMENTO_DEVEDOR`: CPF/CNPJ devedor
- `DOCUMENTO_GARANTIDOR`: CPF/CNPJ garantidor (null se principal)
- `CONTRACT_NUMBER`: Número contrato (NUM_VENDA)
- `STATUS`: PENDENTE_ENVIO, ENVIADO_SERASA, AGUARDANDO_RETORNO, NEGATIVADO_SUCESSO, NEGATIVADO_ERRO
- `TRANSACTION_ID`: ID retornado Serasa
- `CADUS_KEY`: Chave CADUS
- `CADUS_SERIE`: Série CADUS
- `PAYLOAD_AUDITORIA`: Payload enviado (mascarado)
- `WEBHOOK_PAYLOAD`: Payload recebido
- `ERROR_MESSAGE`: Mensagem de erro
- `OPERADOR`: Usuário solicitante

### SERASA_PEFIN_WEBHOOKS

**Campos principais:**
- `ID`: GUID único
- `EVENT_TYPE`: Tipo de evento
- `TRANSACTION_ID`: UUID do payload
- `PAYLOAD`: Payload completo
- `MATCHED_SOLICITACAO_ID`: ID solicitação encontrada
- `PROCESSADO`: Flag se processado
- `MENSAGEM_ERRO`: Erro se não encontrado

### Status

- **PENDENTE_ENVIO**: Criado, não enviado
- **ENVIADO_SERASA**: Enviado, aguardando transactionId
- **AGUARDANDO_RETORNO**: transactionId recebido, aguardando webhook
- **NEGATIVADO_SUCESSO**: Webhook sucesso
- **NEGATIVADO_ERRO**: Webhook erro ou erro envio
- **BAIXA_ENVIADA**: Solicitacao de baixa enviada
- **BAIXA_AGUARDANDO_RETORNO**: Aguardando webhook de baixa
- **BAIXADO_SUCESSO**: Baixa processada com sucesso
- **BAIXADO_ERRO**: Baixa processada com erro

---

## Validações e Regras de Negócio

### Documentos UAT

**Massa de teste autorizada:**
- CPF: `000.012.095-23`, `000.084.414-48`, `074.205.658-99`, `042.367.984-84`, `168.816.700-52`, `115.72467886`
- CNPJ: `43.557.445/0001-80`, `00.079.854/0001-05`

**Regra:** Se `INAD_SERASA_UAT_ENABLED=true`, apenas documentos da massa são permitidos

### Valor Mínimo

**Regra:** Valor >= R$ 10,00

### Endereço Completo

**Campos obrigatórios:** zipCode, addressLine, district, city, state

### Duplicidade Ativa

**Regra:** Bloquear se mesma combinação (NUM_VENDA, CONTRACT_NUMBER, DOCUMENTO_DEVEDOR, TIPO_REGISTRO) já estiver ativa

**Status ativos:** PENDENTE_ENVIO, ENVIADO_SERASA, AGUARDANDO_RETORNO

### Garantidores

**Tipos aceitos:** FIADOR, CONJUGE, CESSINARIO, COOBRIGADO

**Regras:**
- Endereço completo obrigatório
- Documento na massa UAT (em ambiente UAT)
- Erro em garantidor não afeta principal
- Cada garantidor tem transactionId próprio

---

## Processo Operacional

### Como Solicitar

1. Acessar detalhe da venda
2. Chamar preview: `GET /vendas/{numVenda}/preview`
3. Revisar dados e selecionar garantidores
4. Enviar: `POST /vendas/{numVenda}/negativacoes`
5. Aguardar webhook assíncrono

### Como Acompanhar

**Histórico:** `GET /vendas/{numVenda}/negativacoes`
**Detalhe:** `GET /negativacoes/{id}`
**Por transactionId/uuid:** `GET /acompanhamento/{transactionId}`

O endpoint por `transactionId` consulta o status interno atualizado pelos webhooks. Enquanto a Serasa nao enviar webhook, o status permanece `AGUARDANDO_RETORNO`; apos o webhook, o acompanhamento retorna `finalizado: true` com `NEGATIVADO_SUCESSO` ou `NEGATIVADO_ERRO`.

### Interpretação de Erros

- **400**: Validação (missingFields, blockedDocuments)
- **409**: Duplicidade ativa
- **503**: Erro Serasa (auth, HTTP, timeout)
- **504**: Timeout na chamada

### Checklist Homologação UAT

- [x] Credenciais configuradas
- [ ] IPs liberados
- [ ] Webhooks cadastrados
- [x] Preview funcionando
- [x] Envio principal + garantidores
- [ ] Webhooks recebidos
- [x] Segurança verificada (sem exposição)

---

## Troubleshooting

### Erros Comuns

**SERASA_PEFIN_NOT_CONFIGURED (503)**: Configurar credenciais
**SERASA_PEFIN_AUTH_FAILED (503)**: Verificar credenciais e URL
**SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED (400)**: Usar documentos da massa
**SERASA_PEFIN_MISSING_REQUIRED_FIELDS (400)**: Verificar missingFields
**SERASA_PEFIN_DUPLICATE_ACTIVE (409)**: Aguardar conclusão da existente
**SERASA_PEFIN_HTTP_TIMEOUT (504)**: Aumentar timeout ou verificar rede

### Logs

**Local:** `logs/api.log`
**Níveis:** INFO (solicitações, webhooks), WARN (bloqueios), ERROR (falhas)
**Importante:** Credenciais nunca logadas, documentos mascarados

### Debug Webhook

1. Consultar `SERASA_PEFIN_WEBHOOKS`
2. Verificar `PROCESSADO` e `MENSAGEM_ERRO`
3. Comparar `TRANSACTION_ID` com solicitação
4. Simular manualmente com curl

### Suporte Serasa

**Email:** `suporteapicollection@experian.com`

---

## Exemplos Práticos

### Payload Inclusão Principal

```json
{
  "value": 15000.00,
  "areaInformante": "ABCD",
  "dueDate": "2026-06-15",
  "categoryId": "FI",
  "debtor": {
    "documentNumber": "00001209523",
    "name": "CLIENTE TESTE ABCB",
    "address": {
      "zipCode": "01310930",
      "addressLine": "Av Paulista 1000",
      "complement": "Apto 101",
      "district": "Bela Vista",
      "city": "Sao Paulo",
      "state": "SP"
    }
  },
  "creditor": {
    "documentNumber": "00000000000191"
  },
  "contractNumber": "20988",
  "debtType": "PEFIN"
}
```

### Webhook Sucesso

```json
{
  "uuid": "f1d11b18-b459-4f11-97a8-8143a6c392e4",
  "debtorDocument": "00001209523",
  "creditorDocument": "00000000000191",
  "contract": "20988",
  "cadusKey": "008080948A",
  "cadusSerie": "2026",
  "error": null
}
```

### Webhook Erro

```json
{
  "uuid": "f1d11b18-b459-4f11-97a8-8143a6c392e4",
  "debtorDocument": "00001209523",
  "creditorDocument": "00000000000191",
  "contract": "20988",
  "error": {
    "message": "Documento inválido",
    "statusCode": 400
  }
}
```

### cURL Examples

**Preview:**
```bash
curl -X GET http://localhost:4000/inadimplencia/serasa-pefin/vendas/20988/preview
```

**Envio:**
```bash
curl -X POST http://localhost:4000/inadimplencia/serasa-pefin/vendas/20988/negativacoes \
  -H "Content-Type: application/json" \
  -d '{"operador":"joao.silva","garantidoresSelecionados":["ASSOC001"]}'
```

**Histórico:**
```bash
curl -X GET http://localhost:4000/inadimplencia/serasa-pefin/vendas/20988/negativacoes
```

---

## Apêndices

### Massa de Teste Homologação

**CPF:**
- 000.012.095-23 (CLIENTE TESTE ABCB)
- 000.084.414-48 (BJRNRNSD OIOIE)
- 074.205.658-99 (TESTE CPF SEM POSITIVO)
- 042.367.984-84 (NCUH KLCOHKKHH ECAJAE NCGMLU)
- 168.816.700-52 (TST PEFIN)
- 115.724678-86 (TST FLEX)

**CNPJ:**
- 43.557.445/0001-80 (ESFERA ARENA E NEGOCIOS SPE LTDA)
- 00.079.854/0001-05 (U F NXALWPULN ZK EWCQIXG)

### Tabela Natureza da Dívida

| Código | Descrição |
|--------|-----------|
| FI | FINANCIAMENTO |
| IM | OPER IMOBILI |
| TC | CONFISS DIV |
| CP | CRED PESSOAL |
| DP | DUPLICATA |
| ... | (ver documentação Serasa completa) |

### Tabela Motivo de Baixas

| Código | Descrição |
|--------|-----------|
| 01 | PAGAMENTO DA DÍVIDA |
| 02 | RENEGOCIACAO DA DÍVIDA |
| 03 | POR SOLICITACAO DO CLIENTE |
| ... | (ver documentação Serasa completa) |

### Glossário Serasa

- **transactionId**: ID retornado pela Serasa no envio
- **uuid**: Campo no webhook que corresponde ao transactionId
- **CADUS_KEY**: Chave de identificação CADUS
- **CADUS_SERIE**: Série CADUS
- **PEFIN**: Tipo de dívida (Protesto de Entidades Financeiras)

### Estrutura de Arquivos

```
src/modules/inadimplencia/
├── controllers/
│   └── serasaPefinController.js
├── services/
│   ├── serasaPefinService.js
│   ├── serasaPefinHttpClient.js
│   └── serasaPefinPayloadBuilder.js
├── models/
│   └── serasaPefinModel.js
├── routes/
│   └── serasaPefinRoutes.js
├── config/
│   └── env.js
└── constants/
    └── serasaPefin.js
```

### SQL Queries Úteis

**Histórico por Venda:**
```sql
SELECT * FROM dbo.SERASA_PEFIN_SOLICITACOES
WHERE NUM_VENDA_FK = 20988
ORDER BY DT_CRIACAO DESC;
```

**Webhooks por TransactionId:**
```sql
SELECT * FROM dbo.SERASA_PEFIN_WEBHOOKS
WHERE TRANSACTION_ID = 'transaction-id'
ORDER BY DT_RECEBIMENTO DESC;
```

**Solicitações Aguardando Retorno:**
```sql
SELECT * FROM dbo.SERASA_PEFIN_SOLICITACOES
WHERE STATUS = 'AGUARDANDO_RETORNO'
ORDER BY DT_CRIACAO;
```

**Webhooks Sem Match:**
```sql
SELECT * FROM dbo.SERASA_PEFIN_WEBHOOKS
WHERE PROCESSADO = 0
ORDER BY DT_RECEBIMENTO DESC;
```

---

## Checklist de Validação

### Seções Obrigatórias

- [x] Introdução
- [x] Arquitetura
- [x] Componentes Técnicos
- [x] Fluxos de Integração
- [x] Configuração de Ambiente
- [x] Modelo de Dados
- [x] Validações e Regras de Negócio
- [x] Processo Operacional
- [x] Troubleshooting
- [x] Exemplos Práticos
- [x] Apêndices

### Consistência com Código

- [x] Endpoints documentados correspondem a serasaPefinRoutes.js
- [x] Componentes descritos correspondem a arquivos reais
- [x] Variáveis de ambiente correspondem a config/env.js
- [x] Status correspondem a constants/serasaPefin.js
- [x] Tabelas correspondem a schema SQL

### Consistência com Documentação Serasa

- [x] URLs UAT corretas
- [x] Massa de teste completa
- [x] Contratos de payload corretos
- [x] Contratos de webhook corretos
- [x] Tabelas de natureza e motivo referenciadas

### Clareza e Completude

- [x] Documento auto-contido (referências externas mínimas)
- [x] Português claro para desenvolvedores júnior
- [x] Exemplos executáveis (cURL, JSON)
- [x] Troubleshooting prático e acionável
- [x] Diagramas ASCII para visualização

---

**Fim do Documento**
