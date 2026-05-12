# Tarefa 9.0: Suite de integracao, smoke UAT e checklist operacional de homologacao

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Fechar a entrega com cobertura integrada do fluxo Serasa PEFIN, smoke controlado em UAT e checklist operacional para homologacao com a Serasa e equipe de cobranca.

<requirements>
- Consolidar testes de integracao com `supertest`/Vitest cobrindo preview, envio, historico, detalhe e webhooks.
- Usar cliente Serasa fake nos testes automatizados; nao depender de Serasa real no CI/local.
- Cobrir envio principal + dois garantidores com `transactionId` distintos.
- Cobrir UAT bloqueado por documento fora da massa antes de qualquer chamada HTTP.
- Cobrir endereco incompleto retornando `400 { error, missingFields }`.
- Cobrir webhook de sucesso atualizando status final.
- Cobrir webhook de erro persistindo `ERROR_MESSAGE` e `ERROR_STATUS_CODE`.
- Cobrir webhook sem solicitacao correspondente retornando `200` e gravando investigacao.
- Criar checklist de homologacao UAT com variaveis `.env`, IPs, URLs publicas de webhook, massa de documentos e passos de smoke.
- Executar comandos de teste relevantes e registrar qualquer teste que nao puder rodar por dependencia externa.
</requirements>

## Subtarefas

- [ ] 9.1 Revisar `prd.md`, `techspec.md` e arquivos implementados nas tasks anteriores.
- [ ] 9.2 Criar ou completar suite `serasaPefin` com supertest e fakes de model/client quando necessario.
- [ ] 9.3 Testar preview feliz e preview bloqueado por endereco/documento.
- [ ] 9.4 Testar envio principal + garantidores com historico posterior.
- [ ] 9.5 Testar webhook sucesso/erro e webhook sem match via rota real.
- [ ] 9.6 Validar que nenhuma resposta ou log de teste expose segredo Serasa.
- [ ] 9.7 Criar checklist de homologacao UAT em arquivo de planejamento/documentacao.
- [ ] 9.8 Executar `npm test` ou comando seletivo de Vitest para o modulo e corrigir regressos da entrega.
- [ ] 9.9 Documentar no resultado da task quais passos dependem de credenciais/IPs/URLs externas.

## Detalhes de Implementacao

Usar a secao "Abordagem de Testes" e "Sequenciamento de Desenvolvimento" do `techspec.md`. Esta task nao substitui os testes unitarios das tasks anteriores; ela valida o fluxo completo com a composicao real de rotas/controllers/service e fakes controlados para Serasa.

O smoke UAT real so deve ser executado quando houver credenciais, IP de saida liberado, URLs publicas de webhook cadastradas e massa de teste confirmada.

## Criterios de Sucesso

- Fluxo completo tem cobertura automatizada de preview, envio, historico, detalhe e webhook.
- Testes automatizados nao chamam Serasa real.
- Checklist UAT permite homologar sem expor segredos.
- Comandos de teste relevantes foram executados ou a limitacao foi registrada.
- Entrega fica pronta para teste operacional controlado em UAT.

## Testes da Tarefa

- [ ] Testes de unidade: revisar que suites das tasks 1.0 a 8.0 continuam passando.
- [ ] Testes de integracao: supertest/Vitest cobrindo o fluxo end-to-end com Serasa fake e banco/model fake ou ambiente de desenvolvimento controlado.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\standaloneApp.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\swagger.test.ts`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\routes\serasaPefinRoutes.js`
- `c:\api-inadimplencia\tasks\prd-integracao-serasa-pefin\homologacao-uat.md`
