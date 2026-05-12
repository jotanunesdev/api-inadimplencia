# Tarefa 3.0: Validacoes UAT, normalizacao/mascaramento e builders de payload principal/garantidor

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Implementar regras de validacao e montagem de payloads Serasa em arquivos de servico isolados, garantindo que documentos UAT, endereco, valor, contrato, credor, devedor e garantidores sejam validados antes do envio HTTP.

<requirements>
- Criar `src/modules/inadimplencia/services/serasaPefinPayloadBuilder.js`.
- Centralizar validacoes Serasa usadas por preview e envio, sem depender de controller.
- Validar `NUM_VENDA` existente e inadimplente a partir dos dados retornados pelo model.
- Validar valor minimo `10.00`.
- Validar `dueDate` em `YYYY-MM-DD`.
- Validar `categoryId=FI`, `contractNumber=String(NUM_VENDA)` e `debtType=PEFIN`.
- Bloquear UAT quando qualquer documento enviado nao estiver na massa de teste autorizada pela Serasa.
- Validar endereco obrigatorio do devedor e de cada garantidor: `zipCode`, `addressLine`, `district`, `city`, `state`.
- Retornar `missingFields` acionaveis para o usuario quando faltar dado.
- Montar payload de divida principal para `POST /collection/debt/`.
- Montar payload de garantidor para `POST /collection/debt/guarantor`, referenciando o mesmo `contractNumber`.
- Criar funcoes de mascaramento para logs/respostas quando documentos ou dados financeiros completos nao forem necessarios.
</requirements>

## Subtarefas

- [ ] 3.1 Revisar `prd.md`, `techspec.md` e `documentos/documentacao-serasa-pefin-v8.md` para confirmar campos obrigatorios.
- [ ] 3.2 Implementar normalizacao de CPF/CNPJ, moeda, datas e campos de endereco.
- [ ] 3.3 Implementar validacao de massa UAT para todos os participantes enviados.
- [ ] 3.4 Implementar validacao de endereco e retorno padronizado de `missingFields`.
- [ ] 3.5 Implementar builder do payload de divida principal.
- [ ] 3.6 Implementar builder do payload de garantidor/avalista.
- [ ] 3.7 Implementar sanitizacao/mascaramento de payload para auditoria e logs.
- [ ] 3.8 Criar testes cobrindo payload feliz, UAT bloqueado, endereco incompleto, valor minimo e garantidor.

## Detalhes de Implementacao

Usar as secoes "Interfaces Principais", "Validacoes bloqueantes" e "Pontos de Integracao" do `techspec.md`. Esta task deve produzir funcoes pequenas e testaveis, com nomes de dominio Serasa PEFIN, evitando um arquivo generico de helpers.

Os builders devem receber dados ja consultados pelo model e configuracoes vindas de `env`; o frontend nunca deve enviar credenciais, URL, documento do credor ou segredo.

## Criterios de Sucesso

- Dados invalidos sao rejeitados antes de qualquer chamada HTTP externa.
- Payload principal e payload de garantidor seguem a estrutura esperada pela documentacao Serasa.
- UAT nao permite documento fora da massa homologada.
- Campos ausentes sao retornados de forma objetiva para exibicao no frontend.
- Logs e payloads de auditoria nao expõem documentos sem necessidade.

## Testes da Tarefa

- [ ] Testes de unidade: builders e validators para divida principal, garantidor, massa UAT, endereco incompleto, data invalida, valor abaixo de `10.00` e mascaramento.
- [ ] Testes de integracao: nao obrigatorios nesta task; a integracao com service/rotas sera coberta nas tasks 5.0, 6.0 e 9.0.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\config\env.js`
- `c:\api-inadimplencia\documentos\documentacao-serasa-pefin-v8.md`
- `c:\api-inadimplencia\tasks\prd-integracao-serasa-pefin\techspec.md`
