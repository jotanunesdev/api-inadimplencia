# Tarefa 14.0: Padronizar suite de testes Serasa PEFIN e cobrir regressoes criticas

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Padronizar a execucao dos testes Serasa PEFIN e adicionar cobertura para as regressoes encontradas no review. Hoje `package.json` possui chave `test` duplicada e parte dos testes usa Jest enquanto `test:run` executa Vitest. Isso faz a suite de integracao falhar no comando padrao e reduz a confiabilidade da entrega.

<requirements>
- Ler `prd.md`, `techspec.md` e a nota tecnica de mocks, se aplicavel.
- Remover ambiguidade causada por scripts `test` duplicados no `package.json`.
- Definir scripts claros para rodar testes Vitest, testes Jest e/ou suite Serasa.
- Migrar testes Serasa para um runner unico quando for viavel sem grande refatoracao.
- Se mantiver dois runners, documentar e garantir comandos separados funcionando.
- Garantir que a suite padrao do projeto nao falhe por `ReferenceError: jest is not defined`.
- Adicionar testes que cubram os bugs corrigidos nas tasks 10.0 a 13.0.
- Evitar testes que chamem Serasa real ou dependam de credenciais.
- Garantir que testes de integracao usem fakes que exercitem mais do que apenas controller mockado quando o objetivo for fluxo real.
</requirements>

## Subtarefas

- [ ] 14.1 Revisar `package.json`, `vitest.config.ts`, `jest.config.js` e arquivos de teste Serasa.
- [ ] 14.2 Corrigir scripts duplicados e definir comandos oficiais de teste.
- [ ] 14.3 Decidir se os testes Serasa ficam em Vitest ou Jest, priorizando consistencia com o restante do modulo.
- [ ] 14.4 Ajustar `serasaPefin.integration.test.js` para rodar no comando oficial escolhido.
- [ ] 14.5 Adicionar teste para auth com `accessToken`/`expiresIn`.
- [ ] 14.6 Adicionar teste para persistencia de `transactionId` da resposta inicial.
- [ ] 14.7 Adicionar teste para `documentoCredor` persistido corretamente.
- [ ] 14.8 Adicionar teste para bloqueio previo quando garantidor selecionado e invalido.
- [ ] 14.9 Adicionar teste para erro com `missingFields` no controller.
- [ ] 14.10 Atualizar documentacao ou nota tecnica se houver decisao de manter dois runners.
- [ ] 14.11 Executar os comandos oficiais e registrar resultado na task ao finalizar.

## Detalhes de Implementacao

Esta tarefa deve ser executada depois das tasks 10.0 a 13.0 ou em paralelo apenas para a parte de padronizacao dos scripts. As novas coberturas devem provar os comportamentos corrigidos, nao apenas mocks superficiais.

Quando usar fakes, preferir fakes de fronteira externa (`fetch`, cliente Serasa, banco/model) e manter a orquestracao real do service sempre que possivel.

## Criterios de Sucesso

- O comando oficial de testes do projeto nao possui chave duplicada nem falha por runner incorreto.
- Existe um comando claro para rodar a suite Serasa PEFIN.
- Testes pegariam novamente os bugs de `accessToken`, `transactionId`, `documentoCredor`, validacao previa de garantidor e resposta com `missingFields`.
- Testes nao chamam Serasa real.
- Resultado dos comandos executados fica registrado no fechamento da task.

## Testes da Tarefa

- [ ] Testes de unidade: todos os testes Serasa relevantes passam no runner escolhido.
- [ ] Testes de integracao: suite Serasa PEFIN passa no comando oficial, com fakes e sem credenciais.
- [ ] Verificacao de regressao: executar tambem a suite existente do modulo inadimplencia ou justificar limitacao.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\package.json`
- `c:\api-inadimplencia\vitest.config.ts`
- `c:\api-inadimplencia\jest.config.js`
- `c:\api-inadimplencia\documentos\nota-tecnica-mocks-vitest-commonjs.md`
- `c:\api-inadimplencia\src\modules\inadimplencia\serasaPefin.integration.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\controllers\serasaPefinController.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinHttpClient.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\models\serasaPefinModel.test.js`
