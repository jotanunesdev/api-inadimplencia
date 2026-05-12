# Tarefa 5.0: Preview, historico e detalhe operacional das negativacoes

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Implementar no service o fluxo de consulta operacional antes e depois do envio: preview dos dados que serao enviados, historico por venda e detalhe tecnico-operacional de uma solicitacao.

<requirements>
- Criar `src/modules/inadimplencia/services/serasaPefinService.js` ou adicionar nele as funcoes desta task caso ja exista.
- Implementar `createPreview({ numVenda })`.
- O preview deve carregar venda inadimplente, devedor, credor, contrato, valor, vencimento, `categoryId`, `areaInformante`, garantidores elegiveis e `missingFields`.
- O preview deve indicar se a venda esta bloqueada por documento UAT, endereco incompleto, valor invalido ou duplicidade ativa.
- Implementar `listNegativacoesByVenda({ numVenda })`.
- Implementar `getNegativacaoById({ id })`.
- Historico deve expor status, data de envio, operador, contrato, valor, tipo de registro, garantidor quando houver e mensagem de erro quando houver.
- Detalhe deve expor payload/retorno em formato sanitizado para uso tecnico-operacional.
- Respostas do service devem estar prontas para controller retornar `{ data }`.
</requirements>

## Subtarefas

- [ ] 5.1 Revisar `prd.md`, `techspec.md`, model e payload builder criados nas tasks anteriores.
- [ ] 5.2 Implementar `createPreview({ numVenda })` compondo model, validators e config.
- [ ] 5.3 Mapear dados da venda para formato de revisao do usuario operacional.
- [ ] 5.4 Incluir garantidores elegiveis e lacunas por garantidor.
- [ ] 5.5 Incluir bloqueios acionaveis: UAT, endereco, valor minimo, duplicidade ativa.
- [ ] 5.6 Implementar historico por venda com ordenacao operacional.
- [ ] 5.7 Implementar detalhe por ID com payloads sanitizados.
- [ ] 5.8 Criar testes para preview feliz, preview bloqueado e historico/detalhe.

## Detalhes de Implementacao

Usar as secoes "Experiencia do Usuario", "Interfaces Principais" e "Endpoints de API" do `techspec.md`. Esta task ainda pode ser testada diretamente no service; a exposicao HTTP completa sera feita na task 8.0.

O preview deve deixar claro que nenhum envio foi feito. O operador precisa revisar dados antes de solicitar negativacao.

## Criterios de Sucesso

- Usuario consegue visualizar tudo que sera enviado antes do POST de negativacao.
- Preview informa lacunas sem fazer chamada Serasa.
- Historico e detalhe consultam dados persistidos e retornam status/mensagens de forma compreensivel.
- Dados sensiveis aparecem mascarados quando o detalhe completo nao for necessario.

## Testes da Tarefa

- [ ] Testes de unidade: `createPreview` com venda elegivel, documento UAT invalido, endereco incompleto, garantidor com lacuna, duplicidade ativa e venda inexistente.
- [ ] Testes de integracao: service com model fake ou banco de desenvolvimento para historico/detalhe.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.js`
- `c:\api-inadimplencia\tasks\prd-integracao-serasa-pefin\prd.md`
