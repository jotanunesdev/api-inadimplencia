# Guia de Testes - Integracao Serasa PEFIN

Este documento fornece instruções detalhadas sobre como testar a implementação da integração Serasa PEFIN, incluindo configuração de ambiente, execução de testes automatizados e testes manuais.

## Sumário

- [Visão Geral da Arquitetura de Testes](#visão-geral-da-arquitetura-de-testes)
- [Configuração de Ambiente](#configuração-de-ambiente)
- [Testes Automatizados](#testes-automatizados)
- [Execução de Testes](#execução-de-testes)
- [Testes de Integração](#testes-de-integração)
- [Testes Manuais](#testes-manuais)
- [Solução de Problemas](#solução-de-problemas)

## Visão Geral da Arquitetura de Testes

A integração Serasa PEFIN utiliza **dois runners de teste** por necessidade técnica:

### Vitest (Runner Padrão)
- **Uso**: Módulos que não dependem de CommonJS complexo (GLPI, treinamento, etc.)
- **Comando**: `npm test`
- **Configuração**: `vitest.config.ts`
- **Vantagens**: Mais rápido, melhor integração com TypeScript

### Jest (Runner para Inadimplência)
- **Uso**: Módulo inadimplência (incluindo Serasa PEFIN)
- **Comando**: `npm run test:jest` ou `npm run test:serasa`
- **Configuração**: `jest.config.js`
- **Motivo**: Suporte nativo para mocks de CommonJS

**Por que dois runners?**
O Vitest tem limitações com mocks de módulos CommonJS complexos. Como o módulo inadimplência usa CommonJS e requer mocks sofisticados para testar o fluxo de integração Serasa, o Jest foi escolhido para esse módulo específico.

## Configuração de Ambiente

### Variáveis de Ambiente Necessárias

Para executar os testes, você precisa configurar as seguintes variáveis de ambiente no arquivo `.env` na raiz do projeto:

```bash
# Configuração Serasa PEFIN
INAD_SERASA_IS_CONFIGURED=true
INAD_SERASA_AUTH_URL=https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login
INAD_SERASA_DEBT_URL=https://api.serasa.dev/collection/debt/
INAD_SERASA_GUARANTOR_URL=https://api.serasa.dev/collection/debt/guarantor
INAD_SERASA_CLIENT_ID=seu-client-id
INAD_SERASA_CLIENT_SECRET=seu-client-secret
INAD_SERASA_HTTP_TIMEOUT_MS=10000

# Configuração UAT (Ambiente de Teste)
INAD_SERASA_UAT_ENABLED=true

# Configuração de Banco de Dados
INAD_SQL_SERVER=seu-servidor-sql
INAD_SQL_DATABASE=seu-banco
INAD_SQL_USER=seu-usuario
INAD_SQL_PASSWORD=sua-senha
INAD_SQL_ENCRYPT=true
```

### Arquivo de Exemplo

Um arquivo de exemplo está disponível em `src/modules/inadimplencia/.env.example`. Copie e renomeie para `.env`:

```bash
cp src/modules/inadimplencia/.env.example .env
```

## Testes Automatizados

### Estrutura de Testes Serasa PEFIN

A suíte de testes Serasa PEFIN consiste em 6 arquivos de teste:

| Arquivo | Tipo | Descrição | Quantidade de Testes |
|---------|------|-----------|----------------------|
| `serasaPefin.integration.test.js` | Integração | Testa endpoints HTTP com fakes | 31 |
| `serasaPefinController.test.js` | Unitário | Testa lógica do controller | 21 |
| `serasaPefinService.test.js` | Unitário | Testa funções helper e orquestração | 22 |
| `serasaPefinHttpClient.test.js` | Unitário | Testa cliente HTTP e auth | 18 |
| `serasaPefinPayloadBuilder.test.js` | Unitário | Testa construção de payloads | 57 |
| `serasaPefinModel.test.js` | Unitário | Testa persistência no banco | 7 |

**Total**: 156 testes automatizados

## Execução de Testes

### 1. Teste Padrão (Vitest)

Executa todos os testes que não são do módulo inadimplência (GLPI, treinamento, etc.):

```bash
npm test
```

**Resultado esperado**: ~180 testes passando

**Quando usar**: 
- Durante desenvolvimento de módulos GLPI/treinamento
- Verificar que mudanças não quebram outros módulos
- CI/CD padrão

### 2. Teste Serasa Completo (Jest)

Executa todos os testes do módulo Serasa PEFIN:

```bash
npm run test:serasa
```

**Resultado esperado**: ~150 testes passando (6 testes do model podem falhar devido a issues preexistentes de mocks)

**Quando usar**:
- Durante desenvolvimento de funcionalidades Serasa PEFIN
- Verificar regressões na integração Serasa
- Antes de deploy para produção

**O que este comando faz**:
```bash
# Equivalente a executar cada arquivo individualmente:
npm run test:jest -- src/modules/inadimplencia/serasaPefin.integration.test.js --runInBand
npm run test:jest -- src/modules/inadimplencia/controllers/serasaPefinController.test.js --runInBand
npm run test:jest -- src/modules/inadimplencia/services/serasaPefinService.test.js --runInBand
npm run test:jest -- src/modules/inadimplencia/services/serasaPefinHttpClient.test.js --runInBand
npm run test:jest -- src/modules/inadimplencia/services/serasaPefinPayloadBuilder.test.js --runInBand
npm run test:jest -- src/modules/inadimplencia/models/serasaPefinModel.test.js --runInBand
```

A flag `--runInBand` garante que os testes rodem sequencialmente, evitando problemas de concorrência com mocks.

### 3. Teste Individual de Arquivo

Para testar um arquivo específico:

```bash
# Testar apenas o controller
npm run test:jest -- src/modules/inadimplencia/controllers/serasaPefinController.test.js

# Testar apenas o service
npm run test:jest -- src/modules/inadimplencia/services/serasaPefinService.test.js

# Testar apenas o integration test
npm run test:jest -- src/modules/inadimplencia/serasaPefin.integration.test.js
```

### 4. Teste com Watch Mode

Para re-executar testes automaticamente quando arquivos mudam:

```bash
# Vitest watch mode (para módulos não-inadimplência)
npm run test:watch

# Jest não tem watch mode configurado neste projeto
# Use os comandos individuais quando necessário
```

### 5. Teste com Coverage

Para gerar relatório de cobertura de código:

```bash
npm run test:coverage
```

**Nota**: A cobertura é gerada apenas para testes Vitest. Para cobertura de Serasa PEFIN, seria necessário configurar cobertura no Jest.

## Testes de Integração

### Como os Testes de Integração Funcionam

O arquivo `serasaPefin.integration.test.js` usa a abordagem de **fakes** (não mocks):

- **Fakes**: Implementações simplificadas que simulam o comportamento real
- **Não chamam Serasa real**: Todos os testes usam dados simulados
- **Testam orquestração**: Validam o fluxo completo de request → service → model → response

### Estrutura do Integration Test

```javascript
describe('Serasa PEFIN Integration Tests', () => {
  beforeEach(() => {
    // Configura fakes de service, model e HTTP client
    // Limpa mocks antes de cada teste
  });

  describe('Preview Endpoint', () => {
    it('should return preview data for eligible venda', async () => {
      // Simula requisição GET /inadimplencia/serasa-pefin/vendas/20988/preview
      // Verifica response 200 com dados de elegibilidade
    });
  });

  describe('Envio Endpoint', () => {
    it('should send principal debt and two guarantors', async () => {
      // Simula requisição POST /inadimplencia/serasa-pefin/vendas/20988/negativacoes
      // Verifica que transactionIds são distintos para principal e garantidores
    });
  });

  // ... mais testes
});
```

### Categorias de Testes de Integração

1. **Preview Endpoint** (4 testes)
   - Venda elegível
   - Venda não encontrada (404)
   - Bloqueio por endereço incompleto (400)
   - Bloqueio por documento UAT (400)

2. **Envio Endpoint** (4 testes)
   - Envio principal + 2 garantidores com transactionIds distintos
   - Operador ausente (400)
   - Bloqueio UAT antes de chamada HTTP
   - Endereço incompleto (400)

3. **Histórico Endpoint** (2 testes)
   - Retorno de histórico por venda
   - Histórico vazio quando não existem solicitações

4. **Detalhe Endpoint** (2 testes)
   - Retorno de detalhe por ID
   - Solicitação não encontrada (404)

5. **Webhook Endpoints** (6 testes)
   - Webhook sucesso principal
   - Webhook erro principal
   - Webhook sucesso avalista
   - Webhook erro avalista
   - Webhook sem solicitação correspondente (200 + log)
   - Webhook sem uuid (400)

6. **Security Tests** (5 testes)
   - Não expor clientSecret em preview
   - Não expor Bearer token em envio
   - Não expor clientSecret em histórico
   - Não expor clientSecret em detalhe
   - Mascarar documentos em todas as respostas

7. **Regression Tests** (6 testes)
   - Auth com accessToken/expiresIn (Task 10.0)
   - Persistência de transactionId (Task 10.0)
   - Persistência de documentoCredor (Task 11.0)
   - Bloqueio prévio de garantidor inválido (Task 12.0)
   - missingFields no controller (Task 13.0)
   - missingFields no preview (Task 13.0)

## Testes Manuais

### Checklist de Homologação UAT

Um checklist detalhado está disponível em `tasks/prd-integracao-serasa-pefin/homologacao-uat.md`.

### Passos para Teste Manual

#### 1. Configuração de Ambiente UAT

```bash
# Verifique que as variáveis de ambiente estão configuradas
echo $INAD_SERASA_IS_CONFIGURED  # Deve ser "true"
echo $INAD_SERASA_AUTH_URL       # URL de autenticação Serasa
echo $INAD_SERASA_DEBT_URL       # URL de envio de dívida
echo $INAD_SERASA_CLIENT_ID      # Seu client ID
```

#### 2. Iniciar o Servidor

```bash
# Modo desenvolvimento
npm run dev

# Ou modo produção
npm start
```

O servidor iniciará na porta 4000 (ou conforme configurado).

#### 3. Testar Preview de Venda

**Endpoint**: `GET /inadimplencia/serasa-pefin/vendas/{numVenda}/preview`

**Exemplo**:
```bash
curl -X GET http://localhost:4000/inadimplencia/serasa-pefin/vendas/20988/preview
```

**Resposta esperada**:
```json
{
  "data": {
    "numVenda": 20988,
    "elegivel": true,
    "cliente": "Nome do Cliente",
    "documentoDevedor": "000.***.***-23",
    "valor": 1000,
    "dataVencimento": "2026-05-11",
    "garantidores": [
      {
        "idAssociado": "ASSOC001",
        "nome": "Nome do Garantidor",
        "documentoGarantidor": "074.***.***-99",
        "elegivel": true,
        "missingFields": []
      }
    ]
  }
}
```

**Validações**:
- [ ] Status 200 para venda elegível
- [ ] Status 404 para venda não encontrada
- [ ] Status 400 com `missingFields` se endereço incompleto
- [ ] Documentos mascarados com `***`
- [ ] `elegivel` reflete apenas a dívida principal
- [ ] Garantidores têm seus próprios campos `elegivel` e `missingFields`

#### 4. Testar Envio de Negativação

**Endpoint**: `POST /inadimplencia/serasa-pefin/vendas/{numVenda}/negativacoes`

**Exemplo**:
```bash
curl -X POST http://localhost:4000/inadimplencia/serasa-pefin/vendas/20988/negativacoes \
  -H "Content-Type: application/json" \
  -d '{
    "operador": "joao.silva",
    "garantidoresSelecionados": ["ASSOC001"]
  }'
```

**Resposta esperada**:
```json
{
  "data": {
    "principal": {
      "id": "uuid-principal",
      "numVenda": 20988,
      "tipoRegistro": "PRINCIPAL",
      "status": "AGUARDANDO_RETORNO",
      "transactionId": "transaction-id-from-serasa"
    },
    "garantidores": [
      {
        "id": "uuid-garantidor",
        "idAssociado": "ASSOC001",
        "tipoRegistro": "GARANTIDOR",
        "status": "AGUARDANDO_RETORNO",
        "transactionId": "transaction-id-garantidor"
      }
    ],
    "mensagem": "Solicitação enviada para Serasa."
  }
}
```

**Validações**:
- [ ] Status 201 para envio bem-sucedido
- [ ] Status 400 se `operador` ausente
- [ ] Status 400 se garantidor selecionado tem campos faltantes
- [ ] `transactionId` presente para principal e garantidores
- [ ] `transactionId` são distintos entre principal e garantidores
- [ ] Não expor `clientSecret` ou Bearer token
- [ ] Garantidores não selecionados não são enviados

#### 5. Testar Histórico

**Endpoint**: `GET /inadimplencia/serasa-pefin/vendas/{numVenda}/negativacoes`

**Exemplo**:
```bash
curl -X GET http://localhost:4000/inadimplencia/serasa-pefin/vendas/20988/negativacoes
```

**Validações**:
- [ ] Status 200 para venda com histórico
- [ ] Status 400 para numVenda inválido
- [ ] Array vazio se não existirem solicitações
- [ ] Documentos mascarados
- [ ] Status atualizado (AGUARDANDO_RETORNO, NEGATIVADO_SUCESSO, etc.)

#### 6. Testar Detalhe

**Endpoint**: `GET /inadimplencia/serasa-pefin/negativacoes/{id}`

**Exemplo**:
```bash
curl -X GET http://localhost:4000/inadimplencia/serasa-pefin/negativacoes/123e4567-e89b-12d3-a456-426614174000
```

**Validações**:
- [ ] Status 200 para solicitação existente
- [ ] Status 400 para GUID inválido
- [ ] Status 404 para solicitação não encontrada
- [ ] `payloadAuditoria` presente (mas sem segredos)
- [ ] Documentos mascarados

#### 7. Testar Webhooks

Os webhooks são chamados pelo Serasa quando há atualizações de status.

**Webhook Sucesso Principal**:
```bash
curl -X POST http://localhost:4000/inadimplencia/serasa-pefin/webhooks/inclusao-sucesso \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "transaction-id-from-serasa",
    "debtorDocument": "00001209523",
    "creditorDocument": "62173620000180",
    "contract": "20988",
    "cadusKey": "cadus-key",
    "cadusSerie": "cadus-serie"
  }'
```

**Validações**:
- [ ] Status 200
- [ ] Solicitação atualizada para `NEGATIVADO_SUCESSO`
- [ ] `CADUS_KEY` e `CADUS_SERIE` persistidos
- [ ] Webhook idempotente (reenvio não causa erro)

**Webhook Erro Principal**:
```bash
curl -X POST http://localhost:4000/inadimplencia/serasa-pefin/webhooks/inclusao-erro \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "transaction-id-from-serasa",
    "debtorDocument": "00001209523",
    "creditorDocument": "62173620000180",
    "contract": "20988",
    "errorMessage": "Erro de validação",
    "statusCode": 400
  }'
```

**Validações**:
- [ ] Status 200
- [ ] Solicitação atualizada para `NEGATIVADO_ERRO`
- [ ] `ERROR_MESSAGE` e `ERROR_STATUS_CODE` persistidos
- [ ] Log de investigação criado se não houver match

#### 8. Testar Documentação OpenAPI

Acesse a documentação Swagger:
```
http://localhost:4000/api-docs
```

**Validações**:
- [ ] Tag `Serasa PEFIN` presente
- [ ] Todos os 8 endpoints documentados
- [ ] Exemplos de request/response
- [ ] Documentação de erros 400 com `missingFields` e `blockedDocuments`
- [ ] Não exposição de credenciais na documentação

## Solução de Problemas

### Erro: "ReferenceError: jest is not defined"

**Causa**: Tentando rodar testes Serasa com Vitest.

**Solução**: Use `npm run test:serasa` ou `npm run test:jest` para testes Serasa, não `npm test`.

### Erro: "vi is not defined"

**Causa**: Teste ainda usando APIs Vitest mas rodando com Jest.

**Solução**: Converta `vi.fn()` para `jest.fn()` e `vi.clearAllMocks()` para `jest.clearAllMocks()`.

### Erro: Cannot read properties of undefined (reading 'inputs')

**Causa**: Mock de banco mal configurado em testes de model.

**Solução**: Verifique se `dbMock.requests` está sendo populado corretamente nos testes.

### Erro: SERASA_PEFIN_NOT_CONFIGURED

**Causa**: Variáveis de ambiente não configuradas.

**Solução**: Configure `INAD_SERASA_IS_CONFIGURED=true` e outras variáveis necessárias no `.env`.

### Erro: SERASA_PEFIN_AUTH_FAILED

**Causa**: Credenciais inválidas ou URL de autenticação incorreta.

**Solução**: Verifique `INAD_SERASA_CLIENT_ID`, `INAD_SERASA_CLIENT_SECRET` e `INAD_SERASA_AUTH_URL`.

### Testes Lentos

**Causa**: Muitos testes rodando em paralelo com banco de dados real.

**Solução**: Use `--runInBand` para rodar sequencialmente (já configurado no comando `test:serasa`).

## Melhores Práticas

### Durante Desenvolvimento

1. **Rode testes relevantes frequentemente**:
   - Mudou controller? Rode `npm run test:jest -- src/modules/inadimplencia/controllers/serasaPefinController.test.js`
   - Mudou service? Rode `npm run test:jest -- src/modules/inadimplencia/services/serasaPefinService.test.js`
   - Mudou endpoint? Rode o integration test

2. **Use testes de regressão**:
   - Os 6 testes de regressão (Tasks 10.0-13.0) garantem que bugs corrigidos não retornem
   - Sempre rode `npm run test:serasa` antes de commit

3. **Não chame Serasa real em testes**:
   - Todos os testes automatizados usam fakes
   - Para testes manuais, use ambiente UAT com massa de teste específica

### Antes de Deploy

1. **Rode suíte completa Serasa**:
   ```bash
   npm run test:serasa
   ```

2. **Rode testes padrão**:
   ```bash
   npm test
   ```

3. **Verifique documentação OpenAPI**:
   - Acesse `/api-docs` localmente
   - Confirme que todos os endpoints estão documentados

4. **Execute checklist de homologação**:
   - Siga `tasks/prd-integracao-serasa-pefin/homologacao-uat.md`

## Referências

- **Nota Técnica**: `documentos/nota-tecnica-mocks-vitest-commonjs.md` - Explica decisão de dois runners
- **Task 14.0**: `tasks/prd-integracao-serasa-pefin/14_task.md` - Detalhes da padronização de testes
- **Homologação UAT**: `tasks/prd-integracao-serasa-pefin/homologacao-uat.md` - Checklist operacional
- **Documentação Serasa**: `documentos/documentacao-serasa-pefin-v8.md` - Documentação da API Serasa v8
