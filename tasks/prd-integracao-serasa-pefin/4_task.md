# Tarefa 4.0: Cliente HTTP Serasa com auth Bearer, cache de token, timeout e refresh em `401`

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Criar o cliente HTTP responsavel por autenticar na Serasa e enviar requisicoes de inclusao PEFIN, mantendo token Bearer apenas no backend, com timeout, cache controlado, refresh em `401` e sem retry automatico de POST de negocio.

<requirements>
- Criar `src/modules/inadimplencia/services/serasaPefinHttpClient.js`.
- Usar `fetch` nativo ou fallback ja usado no projeto, sem introduzir nova dependencia HTTP sem necessidade.
- Implementar `getBearerToken({ forceRefresh = false })`.
- Autenticar em `INAD_SERASA_AUTH_URL` com Basic derivado de `INAD_SERASA_CLIENT_ID` e `INAD_SERASA_CLIENT_SECRET`.
- Cachear token em memoria pelo tempo seguro retornado pela Serasa ou TTL conservador definido pela integracao.
- Implementar `postDebt(payload)` para `INAD_SERASA_DEBT_URL`.
- Implementar `postGuarantor(payload)` para `INAD_SERASA_GUARANTOR_URL`.
- Aplicar timeout com `AbortController`.
- Em `401`, renovar token e tentar uma unica vez quando a requisicao ainda puder ser considerada segura pelo fluxo.
- Nao fazer retry automatico em timeout, erro de rede ou erro 5xx de POST de negocio para evitar duplicidade externa.
- Nunca logar `clientSecret`, Basic, Bearer Token ou documentos sem mascaramento.
- Propagar erros com `statusCode`, codigo de integracao e corpo sanitizado suficiente para auditoria.
</requirements>

## Subtarefas

- [ ] 4.1 Revisar `prd.md`, `techspec.md` e integracoes HTTP existentes do modulo.
- [ ] 4.2 Implementar factory/cliente com injecao opcional de `fetch` para facilitar testes.
- [ ] 4.3 Implementar autenticacao Basic e cache de Bearer Token.
- [ ] 4.4 Implementar `postDebt(payload)` com headers e timeout.
- [ ] 4.5 Implementar `postGuarantor(payload)` com headers e timeout.
- [ ] 4.6 Implementar refresh controlado em `401` sem retry amplo de POST.
- [ ] 4.7 Implementar sanitizacao de erros/logs.
- [ ] 4.8 Criar testes de unidade com `fetch` fake para token cacheado, token expirado, `401`, timeout e erro Serasa.

## Detalhes de Implementacao

Seguir a secao "Pontos de Integracao" do `techspec.md`. A decisao tecnica e usar `fetch`/`node-fetch` como nas integracoes existentes, sem retry automatico de negocio. O client deve ser isolado para permitir que o service seja testado com fake client.

Quando o HTTP inicial retornar `200` com `transactionId`, isso significa apenas recebimento pela Serasa. O cliente nao deve traduzir isso para sucesso de negativacao; essa interpretacao pertence ao service e aos webhooks.

## Criterios de Sucesso

- Token Bearer nao sai do backend.
- Requisicoes usam URL, timeout e credenciais do `.env`.
- `401` renova token de forma controlada.
- Timeout/erro de rede nao gera reenvio automatico de divida.
- Erros sao uteis para suporte sem expor segredo.

## Testes da Tarefa

- [ ] Testes de unidade: auth Basic, cache de token, `forceRefresh`, timeout, erro `401` com refresh, erro 4xx/5xx sanitizado, ausencia de retry em timeout.
- [ ] Testes de integracao: nao chamar Serasa real nesta task; usar fake HTTP client ou servidor local controlado.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinHttpClient.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\fluigDataset.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\rmReportService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\config\env.js`
