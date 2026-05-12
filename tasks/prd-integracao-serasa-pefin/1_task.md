# Tarefa 1.0: Configuracao Serasa, status internos e migration SQL das tabelas de solicitacoes/webhooks

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Visao Geral

<complexity>MEDIUM</complexity>

Criar a base configuravel e persistente da integracao Serasa PEFIN no modulo `inadimplencia`: variaveis `INAD_SERASA_*`, status internos padronizados e script SQL versionado para armazenar solicitacoes e webhooks.

<requirements>
- Atualizar `src/modules/inadimplencia/config/env.js` para expor as configuracoes Serasa a partir de variaveis `INAD_SERASA_*`, sem valores sensiveis hardcoded.
- Configuracoes minimas: ambiente, URLs de auth/divida/garantidor, `clientId`, `clientSecret`, documento do credor, `areaInformante`, timeout HTTP e flag/controle de UAT.
- Manter defaults UAT somente para URLs publicas definidas na tech spec; credenciais e documento do credor devem continuar obrigatorios via `.env`.
- Definir status internos aceitos: `PENDENTE_ENVIO`, `ENVIADO_SERASA`, `AGUARDANDO_RETORNO`, `NEGATIVADO_SUCESSO`, `NEGATIVADO_ERRO`.
- Criar migration idempotente `src/modules/inadimplencia/docs/sql/2026-05-11-serasa-pefin.sql`.
- A migration deve criar `dbo.SERASA_PEFIN_SOLICITACOES` e `dbo.SERASA_PEFIN_WEBHOOKS` conforme `techspec.md`.
- Incluir indices/constraints necessarios para busca por `NUM_VENDA_FK`, `TRANSACTION_ID`, `CONTRACT_NUMBER`, `STATUS` e dedupe de solicitacao ativa.
- Nao executar SQL em producao; versionar o script para aplicacao controlada em ambiente apropriado.
</requirements>

## Subtarefas

- [x] 1.1 Revisar `prd.md`, `techspec.md` e o padrao atual de `src/modules/inadimplencia/config/env.js`.
- [x] 1.2 Adicionar leitura das variaveis `INAD_SERASA_*` usando o padrao de `resolvePrefixedEnv('INAD')`.
- [x] 1.3 Expor no objeto `env` somente nomes sem prefixo, como `SERASA_AUTH_URL`, `SERASA_DEBT_URL`, `SERASA_GUARANTOR_URL`, `SERASA_CLIENT_ID`, `SERASA_CLIENT_SECRET`.
- [x] 1.4 Criar constantes de status/tipos de registro em local consumivel pelas proximas tasks, evitando strings soltas.
- [x] 1.5 Criar migration SQL idempotente com as tabelas `SERASA_PEFIN_SOLICITACOES` e `SERASA_PEFIN_WEBHOOKS`.
- [x] 1.6 Adicionar constraints de dominio para `TIPO_REGISTRO` e `STATUS`, e indices para conciliacao por `TRANSACTION_ID`.
- [x] 1.7 Garantir que campos sensiveis tenham tamanho suficiente, mas que payloads de auditoria sejam armazenados em JSON sanitizado.
- [x] 1.8 Criar testes de unidade para parsing/configuracao Serasa e validacao das constantes de status.

## Detalhes de Implementacao

Usar como referencia as secoes "Modelos de Dados", "Pontos de Integracao" e "Dependencias Tecnicas" do `techspec.md`. A configuracao deve seguir o padrao documentado em `src/modules/inadimplencia/docs/techspec-codebase.md`: modulo com prefixo `INAD_`, sem segredo no frontend e sem SQL fora de `models/`.

Para a migration, preferir `IF NOT EXISTS` antes de criar tabelas/indices/constraints. O nome do arquivo deve seguir o padrao cronologico ja usado em `src/modules/inadimplencia/docs/sql/`.

## Criterios de Sucesso

- `env` passa a expor todas as configuracoes Serasa necessarias sem vazar `clientSecret` em logs ou respostas.
- Migration SQL existe, e rodar o script duas vezes nao deve quebrar por objetos ja existentes.
- Tabelas contemplam todos os campos descritos na tech spec, incluindo auditoria, erro e webhook.
- Status e tipos de registro ficam centralizados para uso por model/service.
- A task deixa o projeto pronto para persistir solicitacoes antes de qualquer chamada Serasa.

## Testes da Tarefa

- [x] Testes de unidade: cobrir env completo, env sem credenciais obrigatorias, defaults UAT de URL e exposicao dos status validos.
- [x] Testes de integracao: migration nao executada localmente; aplicacao depende de SQL Server de desenvolvimento/homologacao disponivel.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\inadimplencia\config\env.js`
- `c:\api-inadimplencia\src\modules\inadimplencia\docs\sql\2026-05-11-serasa-pefin.sql`
- `c:\api-inadimplencia\tasks\prd-integracao-serasa-pefin\prd.md`
- `c:\api-inadimplencia\tasks\prd-integracao-serasa-pefin\techspec.md`
