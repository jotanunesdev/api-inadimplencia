# Tarefa 13.0: Melhorar respostas operacionais de erro e elegibilidade do preview

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Melhorar a experiencia operacional do fluxo Serasa PEFIN. O backend ja calcula `missingFields` e `blockedDocuments`, mas os controllers devolvem apenas `{ error }`. Alem disso, o preview marca a venda inteira como inelegivel se qualquer garantidor tiver dados incompletos, mesmo quando o usuario pode enviar somente a divida principal.

<requirements>
- Ler `prd.md` e `techspec.md`, especialmente as secoes de experiencia do usuario e validacoes bloqueantes.
- Padronizar resposta de erro de dominio incluindo `error`, `code`, `missingFields` e `blockedDocuments` quando existirem.
- Aplicar esse padrao nos endpoints Serasa PEFIN de preview, envio, historico, detalhe e webhooks sem expor dados sensiveis.
- Separar elegibilidade da divida principal da elegibilidade dos garantidores no preview.
- Garantir que `preview.elegivel` represente a elegibilidade da divida principal para envio.
- Garantir que cada item em `preview.garantidores` tenha `elegivel` e `missingFields` proprios.
- Garantir que campos faltantes de um garantidor nao sejam atribuidos incorretamente a todos os garantidores.
- Atualizar OpenAPI para documentar respostas de erro acionaveis.
</requirements>

## Subtarefas

- [x] 13.1 Criar helper de serializacao de erro de dominio no controller ou em modulo local do Serasa PEFIN.
- [x] 13.2 Incluir `code`, `missingFields` e `blockedDocuments` quando presentes no erro.
- [x] 13.3 Garantir mascaramento/normalizacao dos documentos bloqueados se forem retornados ao usuario.
- [x] 13.4 Refatorar `validatePreviewData` ou o consumo dela para separar validacao principal de validacao dos garantidores.
- [x] 13.5 Corrigir a montagem de `guarantoresPreview` para preservar `missingFields` por garantidor.
- [x] 13.6 Ajustar `preview.elegivel` para nao depender de garantidor nao selecionado.
- [x] 13.7 Atualizar Swagger com exemplos de `400` contendo `missingFields` e `blockedDocuments`.
- [x] 13.8 Cobrir casos de preview com principal valido e garantidor incompleto.

## Detalhes de Implementacao

Seguir a secao "Experiencia do Usuario" do `prd.md`: mensagens de erro devem indicar campo ausente, documento nao permitido em UAT, falha de autenticacao, erro Serasa ou retorno pendente.

O preview deve ajudar o operador a decidir o envio. A divida principal e cada garantidor precisam ter estados de elegibilidade claros e independentes.

## Criterios de Sucesso

- Erros de validacao retornam dados acionaveis para o frontend.
- Preview de venda com principal valido e garantidor incompleto permite identificar que a divida principal e elegivel.
- Cada garantidor mostra seus proprios campos faltantes.
- OpenAPI documenta os novos campos de erro.
- Nenhuma resposta retorna credenciais ou token Serasa.

## Testes da Tarefa

- [x] Testes de unidade: controller serializa `missingFields`, `blockedDocuments` e `code`.
- [x] Testes de unidade: preview separa elegibilidade principal e garantidor.
- [x] Testes de unidade: garantidores diferentes recebem `missingFields` distintos.
- [x] Testes de integracao: endpoint de envio com endereco incompleto retorna `400 { error, code, missingFields }`.
- [x] Testes de integracao: endpoint de preview retorna principal elegivel com garantidor inelegivel sem bloquear a venda inteira.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\controllers\serasaPefinController.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\swagger.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\controllers\serasaPefinController.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\serasaPefin.integration.test.js`
