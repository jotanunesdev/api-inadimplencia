# Checklist de Homologação UAT - Integracao Serasa PEFIN

## Variáveis de Ambiente (.env)

Configure as seguintes variáveis no arquivo `src/modules/inadimplencia/.env`:

```bash
# Credenciais Serasa UAT (fornecidas pela Serasa)
INAD_SERASA_CLIENT_ID=<client_id_fornecido_pela_serasa>
INAD_SERASA_CLIENT_SECRET=<client_secret_fornecido_pela_serasa>

# Documento do credor (CNPJ da JotaNunes)
INAD_SERASA_CREDITOR_DOCUMENT=62173620000180

# Área informante (código fornecido pela Serasa)
INAD_SERASA_AREA_INFORMANTE=SP

# Ambiente
INAD_SERASA_ENVIRONMENT=uat
INAD_SERASA_UAT_ENABLED=true
INAD_SERASA_USE_UAT_DEFAULTS=true

# Timeout HTTP (opcional, padrão 10000ms)
INAD_SERASA_HTTP_TIMEOUT_MS=10000
```

## IPs e URLs de Saída

### IPs de Saída (Whitelist Serasa)
- **Requisito**: IP do servidor de saída deve estar liberado na whitelist da Serasa
- **Ação**: Solicitar à equipe de infraestrutura que libere o IP público do servidor UAT na Serasa
- **Contato**: Equipe técnica da Serasa Experian

### URLs Públicas de Webhook
Cadastre as seguintes URLs na Serasa para recebimento de webhooks:

```
# Webhook de sucesso da divida principal
https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/inclusao/sucesso

# Webhook de erro da divida principal
https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/inclusao/erro

# Webhook de sucesso de avalista/fiador
https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/avalista/sucesso

# Webhook de erro de avalista/fiador
https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/avalista/erro
```

**Nota**: Substitua `<dominio-uat>` pelo domínio público do ambiente de UAT.

### URLs de Chamada Serasa (UAT)
- **Auth**: `https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login`
- **Debt**: `https://api.serasa.dev/collection/debt/`
- **Guarantor**: `https://api.serasa.dev/collection/debt/guarantor`

## Massa de Documentos de Teste

A Serasa fornece uma massa de documentos autorizados para ambiente UAT. Use apenas estes documentos:

### Documentos devedor autorizados (exemplo)
- CPF: `00001209523`
- CPF: `07420565899`
- CNPJ: `62173620000180` (credor)

**IMPORTANTE**: Não envie documentos reais de clientes em UAT. A aplicação bloqueará documentos fora da massa autorizada.

## Passos de Smoke Test

### 1. Verificação de Configuração
```bash
# Verificar se o módulo está configurado
curl https://<dominio-uat>/inadimplencia/health

# Expected: { "status": "ok" }
```

### 2. Preview de Negativação (Happy Path)
```bash
# Solicitar preview de uma venda elegível
curl -X GET https://<dominio-uat>/inadimplencia/serasa-pefin/vendas/<NUM_VENDA_TESTE>/preview

# Expected:
# - status: 200
# - elegivel: true
# - blocks: null
# - documentoDevedor mascarado (***)
# - garantidores com elegivel: true
```

### 3. Preview Bloqueado por Endereço Incompleto
```bash
# Solicitar preview de venda com endereço incompleto
curl -X GET https://<dominio-uat>/inadimplencia/serasa-pefin/vendas/<NUM_VENDA_ENDERECO_INCOMPLETO>/preview

# Expected:
# - status: 200
# - elegivel: false
# - missingFields: ['endereco.zipCode', 'endereco.city', ...]
```

### 4. Preview Bloqueado por Documento Fora da Massa
```bash
# Solicitar preview com documento não autorizado
curl -X GET https://<dominio-uat>/inadimplencia/serasa-pefin/vendas/<NUM_VENDA_DOCUMENTO_REAL>/preview

# Expected:
# - status: 400
# - error: "Documento não autorizado para ambiente UAT"
```

### 5. Envio de Negativação (Principal + 2 Garantidores)
```bash
# Enviar negativação com garantidores
curl -X POST https://<dominio-uat>/inadimplencia/serasa-pefin/vendas/<NUM_VENDA_TESTE>/negativacoes \
  -H "Content-Type: application/json" \
  -d '{
    "operador": "operador.teste",
    "garantidoresSelecionados": ["<ID_ASSOCIADO_1>", "<ID_ASSOCIADO_2>"]
  }'

# Expected:
# - status: 201
# - data.principal.status: "AGUARDANDO_RETORNO"
# - data.principal.transactionId: <uuid_distinto>
# - data.garantidores[0].transactionId: <uuid_distinto_do_principal>
# - data.garantidores[1].transactionId: <uuid_distinto_dos_outros>
# - mensagem: "Solicitação enviada para Serasa. Aguardando retorno assíncrono."
```

### 6. Consulta de Histórico
```bash
# Consultar histórico após envio
curl -X GET https://<dominio-uat>/inadimplencia/serasa-pefin/vendas/<NUM_VENDA_TESTE>/negativacoes

# Expected:
# - status: 200
# - Array com 3 registros (1 principal + 2 garantidores)
# - Todos com status "AGUARDANDO_RETORNO" ou atualizado pelo webhook
# - Documentos mascarados
```

### 7. Consulta de Detalhe
```bash
# Consultar detalhe de uma solicitação
curl -X GET https://<dominio-uat>/inadimplencia/serasa-pefin/negativacoes/<ID_SOLICITACAO>

# Expected:
# - status: 200
# - payloadAuditoria presente com dados mascarados
# - webhookPayload presente (se já recebido)
# - Sem exposição de segredos
```

### 8. Simulação de Webhook de Sucesso
```bash
# Simular webhook de sucesso (pode ser feito via Serasa ou manualmente)
curl -X POST https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/inclusao/sucesso \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "<transactionId_do_envio>",
    "debtorDocument": "00001209523",
    "creditorDocument": "62173620000180",
    "contract": "<NUM_VENDA_TESTE>",
    "debtValue": 1000.00,
    "debtDate": "2026-05-11",
    "cadusKey": "CADUS123",
    "cadusSerie": "SERIE456",
    "debtType": "PEFIN",
    "creditorArea": "SP",
    "categoryId": "FI",
    "error": null
  }'

# Expected:
# - status: 200
# - matched: true
# - solicitation.status atualizado para "NEGATIVADO_SUCESSO"
```

### 9. Simulação de Webhook de Erro
```bash
# Simular webhook de erro
curl -X POST https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/inclusao/erro \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "<transactionId_do_envio>",
    "error": {
      "message": "Documento inválido",
      "statusCode": 400
    }
  }'

# Expected:
# - status: 200
# - matched: true
# - solicitation.status atualizado para "NEGATIVADO_ERRO"
# - solicitation.errorMessage: "Documento inválido"
# - solicitation.errorStatusCode: 400
```

### 10. Webhook Sem Correspondência
```bash
# Enviar webhook com transactionId inexistente
curl -X POST https://<dominio-uat>/inadimplencia/serasa-pefin/webhooks/inclusao/sucesso \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "transaction-inexistente-12345",
    "error": null
  }'

# Expected:
# - status: 200 (não deve quebrar)
# - matched: false
# - webhook.PROCESSADO: false
# - webhook.MENSAGEM_ERRO: "SOLICITACAO_NAO_ENCONTRADA"
```

## Validação de Segurança

### Verificação de Exposição de Segredos
1. **Nas respostas da API**: Verificar se `clientSecret`, `Bearer token`, ou credenciais aparecem em qualquer resposta
2. **Nos logs**: Verificar logs da aplicação para garantir que segredos não são logados
3. **Mascaramento de documentos**: Verificar que todos os CPF/CNPJ estão mascarados com `***`

### Validação de CORS e Origin Guard
- Verificar que requests sem `Origin` passam (webhooks Serasa)
- Verificar que requests com origens não autorizadas são bloqueados (403)
- Verificar que Swagger UI é acessível

## Critérios de Aceite da Homologação

- [ ] Todas as variáveis de ambiente estão configuradas
- [ ] IP de saída está liberado na whitelist Serasa
- [ ] URLs de webhook estão cadastradas na Serasa
- [ ] Smoke tests 1-10 passaram com sucesso
- [ ] Nenhum segredo é exposto em respostas ou logs
- [ ] Documentos estão mascarados em todas as respostas
- [ ] Webhooks sem correspondência são gravados para investigação (200, não erro)
- [ ] Envio principal + 2 garantidores geram transactionIds distintos
- [ ] Bloqueio por documento fora da massa funciona antes de qualquer chamada HTTP
- [ ] Bloqueio por endereço incompleto retorna 400 com missingFields

## Dependências Externas

### Requer Ação Prévia
1. **Credenciais Serasa UAT**: Solicitar à equipe técnica da Serasa
2. **Liberação de IP**: Solicitar à equipe de infraestrutura
3. **Cadastro de Webhooks**: Fornecer URLs públicas à Serasa
4. **Massa de Documentos**: Obter lista de documentos autorizados com a Serasa

### Pode Ser Feito em Paralelo
1. **Configuração de .env**: Técnico pode configurar enquanto aguarda liberação
2. **Deploy da Aplicação**: Pode ser feito antes das credenciais (módulo retorna 503 se não configurado)
3. **Testes Automatizados**: Podem rodar com mocks (já implementados)

## Contatos

- **Suporte Técnico Serasa**: [email fornecido pela Serasa]
- **Equipe de Infraestrutura**: [contato interno]
- **Equipe de Cobrança**: [contato interno para validação funcional]
