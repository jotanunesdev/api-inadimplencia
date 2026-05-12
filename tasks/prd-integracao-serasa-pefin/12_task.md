# Tarefa 12.0: Validar garantidores selecionados antes de qualquer envio a Serasa

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Reordenar o fluxo de envio para validar todos os garantidores selecionados antes de qualquer POST externo. Hoje o principal pode ser enviado para Serasa e so depois o sistema descobre que um garantidor selecionado tem endereco, documento ou regra UAT invalida. Isso gera envio parcial inesperado e dificulta a operacao.

<requirements>
- Ler `prd.md`, `techspec.md` e documentacao Serasa antes de alterar codigo.
- Validar payload principal e todos os payloads de garantidores selecionados antes de criar registros pendentes e antes de chamar `postDebt`.
- Bloquear a operacao inteira se qualquer garantidor selecionado tiver campo obrigatorio ausente.
- Bloquear a operacao inteira se qualquer documento de participante selecionado estiver fora da massa UAT quando UAT estiver habilitado.
- Nao chamar `postDebt` nem `postGuarantor` quando a validacao previa falhar.
- Manter envio sequencial principal -> garantidores quando todos os payloads forem validos.
- Garantir que erro de HTTP no garantidor continue nao sobrescrevendo status da divida principal ja enviada.
- Preservar auditoria dos payloads validados, com documentos mascarados na persistencia de auditoria.
</requirements>

## Subtarefas

- [x] 12.1 Revisar o trecho de `requestNegativacao` que monta `principalPayload` e so depois valida garantidores.
- [x] 12.2 Criar uma etapa explicita de pre-validacao que construa `principalPayload` e `guarantorPayloads`.
- [x] 12.3 Garantir que a persistencia local so seja iniciada depois da pre-validacao completa.
- [x] 12.4 Garantir que `postDebt` so seja chamado depois da pre-validacao completa.
- [x] 12.5 Atualizar o loop de envio para reutilizar payloads ja validados, evitando divergencia entre validacao e envio.
- [x] 12.6 Definir resposta de erro com `missingFields` ou `blockedDocuments` para o garantidor especifico.
- [x] 12.7 Criar teste provando que garantidor invalido impede chamada de `postDebt`.
- [x] 12.8 Criar teste provando que garantidor valido ainda e enviado depois do principal.

## Detalhes de Implementacao

Seguir `techspec.md`, principalmente "Validacoes bloqueantes" e "Sequenciamento de Desenvolvimento". A regra de negocio e que a inclusao de avalista/fiador deve ocorrer somente depois da divida principal receber `transactionId`, mas isso nao impede validar os dados antes de enviar a divida principal.

O fluxo esperado apos a correcao:

1. Buscar venda e garantidores.
2. Filtrar garantidores selecionados.
3. Montar e validar payload principal.
4. Montar e validar todos os payloads de garantidores selecionados.
5. Persistir solicitacoes pendentes.
6. Enviar principal.
7. Enviar garantidores sequencialmente.

## Criterios de Sucesso

- Nenhum POST externo ocorre quando algum garantidor selecionado e invalido.
- O usuario recebe erro claro indicando qual participante/campo bloqueou o envio.
- Envio principal + garantidores validos continua funcionando.
- Erro HTTP posterior em um garantidor nao apaga nem altera indevidamente o status do principal.
- Testes demonstram que o bug de envio parcial foi eliminado.

## Testes da Tarefa

- [x] Testes de unidade: `requestNegativacao` com garantidor selecionado sem endereco nao chama `postDebt`.
- [x] Testes de unidade: `requestNegativacao` com garantidor fora da massa UAT nao chama `postDebt`.
- [x] Testes de unidade: fluxo valido chama `postDebt` antes de `postGuarantor`.
- [x] Testes de integracao: POST de negativacao com garantidor invalido retorna `400` e nao cria envio externo.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinPayloadBuilder.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\controllers\serasaPefinController.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\services\serasaPefinService.test.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\serasaPefin.integration.test.js`
