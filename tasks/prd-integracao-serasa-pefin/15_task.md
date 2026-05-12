# Tarefa 15.0: Endpoint de Testes de Integração Serasa PEFIN

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Criar endpoint dedicado para testes manuais da integração Serasa PEFIN utilizando a massa de teste de homologação fornecida pela Serasa. O endpoint deve permitir testar autenticação, envio de negativação com documentos autorizados e simulação de webhooks para validação completa do fluxo assíncrono.

<requirements>
- Endpoint deve expor funcionalidades de teste sem afetar endpoints operacionais
- Deve utilizar apenas documentos da massa de teste de homologação definida pela Serasa
- Deve permitir simulação de webhooks de sucesso e erro
- Deve listar documentos autorizados para referência rápida
- Deve ser protegido para uso apenas em ambiente de desenvolvimento/homologação
</requirements>

## Subtarefas

- [ ] 15.1 Criar controller de testes Serasa PEFIN com métodos de autenticação, envio de teste e simulação de webhook
- [ ] 15.2 Criar rotas de testes sob `/inadimplencia/serasa-pefin/testes/*`
- [ ] 15.3 Implementar validação de ambiente para bloquear uso em produção
- [ ] 15.4 Criar testes unidade e integração para o endpoint de testes
- [ ] 15.5 Atualizar documentação OpenAPI com endpoints de teste

## Detalhes de Implementação

Referenciar `techspec.md` para arquitetura geral do módulo Serasa PEFIN. A implementação deve seguir o padrão MVC existente:

**Controller (`serasaPefinTestController.js`)**:
- `testAuth()`: testa autenticação com credenciais configuradas, retorna token e expiração
- `testDebt()`: envia negativação de teste usando documento da massa de teste (ex: 168.816.700-52 - TST PEFIN)
- `simulateWebhook()`: permite disparar webhook de sucesso/erro manualmente para testar conciliação
- `listTestDocuments()`: retorna lista de documentos autorizados pela Serasa para homologação

**Rotas (`serasaPefinTestRoutes.js`)**:
- `GET /inadimplencia/serasa-pefin/testes/auth`: teste de autenticação
- `POST /inadimplencia/serasa-pefin/testes/debt`: envio de negativação de teste
- `POST /inadimplencia/serasa-pefin/testes/webhook/simular`: simulação de webhook
- `GET /inadimplencia/serasa-pefin/testes/documentos`: lista documentos autorizados

**Validação de ambiente**:
- Verificar `NODE_ENV` ou variável específica para bloquear em produção
- Retornar 403 se ambiente for produção

**Massa de teste** (de `documentacao-serasa-pefin-v8.md`):
- 000.012.095-23 | CLIENTE TESTE ABCB
- 000.084.414-48 | BJRNRNSD OIOIE
- 074.205.658-99 | TESTE CPF SEM POSITIVO
- 042.367.984-84 | NCUH KLCOHKKHH ECAJAE NCGMLU
- 43.557.445/0001-80 | ESFERA ARENA E NEGOCIOS SPE LTDA
- 00.079.854/0001-05 | U F NXALWPULN ZK EWCQIXG
- 168.816.700-52 | TST PEFIN
- 115.724.678-86 | TST FLEX

## Critérios de Sucesso

- Endpoint de autenticação retorna token válido e tempo de expiração
- Endpoint de envio de teste utiliza documento da massa autorizada e retorna transactionId
- Simulação de webhook atualiza solicitação correspondente no banco
- Lista de documentos autorizados está completa e atualizada
- Endpoints são bloqueados em ambiente de produção
- Testes unidade e integração cobrem todos os cenários
- Documentação OpenAPI reflete os novos endpoints

## Testes da Tarefa

- [ ] Testes unidade do controller de testes (mock de service e http client)
- [ ] Testes de integração dos endpoints de teste com supertest
- [ ] Teste de bloqueio em ambiente de produção
- [ ] Teste de simulação de webhook com conciliação

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/inadimplencia/controllers/serasaPefinTestController.js` (novo)
- `src/modules/inadimplencia/routes/serasaPefinTestRoutes.js` (novo)
- `src/modules/inadimplencia/__tests__/serasaPefinTestController.test.js` (novo)
- `src/modules/inadimplencia/serasaPefinTest.integration.test.js` (novo)
- `src/modules/inadimplencia/index.js` (atualizar - montar router de testes)
- `src/modules/inadimplencia/legacyApp.js` (atualizar - montar router de testes)
- `src/modules/inadimplencia/swagger.js` (atualizar - documentar endpoints de teste)
- `documentos/documentacao-serasa-pefin-v8.md` (referência - massa de teste)
