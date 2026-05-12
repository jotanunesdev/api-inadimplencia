# Tarefa 11.0: Corrigir dados obrigatorios de envio e persistencia da solicitacao

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>HIGH</complexity>

Garantir que a solicitacao PEFIN consiga ser criada e enviada com todos os dados obrigatorios. O review encontrou dois bloqueios concretos: a venda principal nao carrega endereco estruturado para o devedor, e o service usa `documentoCreditor` em vez de `documentoCredor` ao persistir a solicitacao. Ambos impedem o fluxo essencial de envio.

<requirements>
- Ler `prd.md`, `techspec.md` e a documentacao Serasa antes de alterar codigo.
- Corrigir o typo `documentoCreditor` para `documentoCredor` no principal e nos garantidores.
- Garantir que `createPendingSolicitations` receba `documentoCredor` preenchido para todos os registros.
- Identificar a fonte correta de endereco do devedor principal no banco ou em fonte existente do modulo.
- Alterar `findInadimplenciaByNumVenda` para retornar endereco estruturado do devedor quando a fonte existir.
- O endereco do devedor deve conter, no minimo, `zipCode`, `addressLine`, `district`, `city` e `state`.
- Se a fonte nao possuir endereco estruturado suficiente, manter bloqueio explicito com `missingFields`, sem tentar enviar payload incompleto para Serasa.
- Nao criar parsing fragil de endereco textual se a origem nao trouxer os campos obrigatorios de forma confiavel.
- Manter `DOCUMENTO_CREDOR` mascarado nas respostas e completo apenas no payload enviado ao backend/Serasa.
</requirements>

## Subtarefas

- [x] 11.1 Revisar o fluxo `requestNegativacao -> createPendingSolicitations -> insertSolicitation`.
- [x] 11.2 Corrigir os acessos `principalParams.documentoCreditor` e `g.documentoCreditor`.
- [x] 11.3 Criar teste que falhe antes da correcao quando `documentoCredor` chega vazio ao model.
- [x] 11.4 Mapear a fonte real dos campos de endereco do devedor no SQL Server ou em model existente.
- [x] 11.5 Atualizar `findInadimplenciaByNumVenda` para retornar `address` com os campos obrigatorios.
- [x] 11.6 Garantir que `createPreview` exiba endereco normalizado quando a fonte estiver completa.
- [x] 11.7 Garantir que `requestNegativacao` consiga montar `buildMainDebtPayload` com endereco completo.
- [x] 11.8 Garantir que endereco ausente continue retornando erro controlado, nao erro 500.
- [x] 11.9 Atualizar testes de model/payload/service para cobrir venda com endereco completo e venda sem endereco.

## Detalhes de Implementacao

Seguir "Validacoes bloqueantes" em `techspec.md`: endereco do devedor e de cada garantidor deve conter `zipCode`, `addressLine`, `district`, `city` e `state`. Seguir tambem "Payload de Inclusao de Divida" na documentacao Serasa.

O objetivo nao e forcar envio com dados ruins. Se o banco nao tiver os campos necessarios, o comportamento correto e bloquear com uma resposta operacional clara.

## Criterios de Sucesso

- `DOCUMENTO_CREDOR` e persistido para principal e garantidores.
- Solicitacao nao falha por `SERASA_PEFIN_SOLICITACAO_INVALIDA` quando todos os dados obrigatorios existem.
- Preview mostra endereco normalizado para venda com dados completos.
- Envio monta payload principal com endereco valido e sem campos obrigatorios vazios.
- Venda sem endereco estruturado retorna erro acionavel, com `missingFields`.

## Testes da Tarefa

- [x] Testes de unidade: service garantindo que `documentoCredor` e repassado corretamente ao model.
- [x] Testes de unidade: model normalizando endereco do devedor quando a query retornar campos completos.
- [x] Testes de unidade: payload builder bloqueando endereco incompleto com lista de campos.
- [x] Testes de integracao: preview e envio com venda fake contendo endereco completo.
- [x] Testes de integracao: envio bloqueado por endereco ausente sem chamar HTTP Serasa.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.test.js`
