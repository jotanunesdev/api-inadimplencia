# PRD — Dashboard: Filtro de Período, Fiadores da Venda e Script "Alteração de Data"

## Visão Geral

A carteira de inadimplência da JotaNunes é operada pelo produto `jnc_inadimplencia` (frontend React embarcado em layout Fluig) consumindo a API Node.js `api-inadimplencia` (módulo `/inadimplencia`). Hoje a operação tem três lacunas que estão sendo tratadas nesta entrega:

1. **Análise temporal dos gráficos de ocorrências/atendimentos do Dashboard é rígida**: os gráficos mostram sempre o acumulado total, sem permitir recorte por período. Isso dificulta a avaliação de produtividade do time (ocorrências por dia/hora/usuário, próximas ações agendadas, atendentes ativos).
2. **Falta de visão dos fiadores do cliente**: ao abrir o detalhe de uma venda o operador não enxerga os "associados" (cônjuge, cessionário, fiador) cadastrados no DW. Essas pessoas são frequentemente o canal de contato mais efetivo nas ações de cobrança.
3. **Script de ocorrência "Alteração de Data"**: operadores precisam registrar mudanças de data prometida/agendada sem um template específico para isso.

Adicionalmente, há pontos de UI com português grafado sem acentuação (resíduo do desenvolvimento inicial) que precisam ser corrigidos para reforçar a qualidade percebida do produto.

Esta entrega é direcionada a **operadores da carteira** e **administradores** da área de cobrança/inadimplência da JotaNunes.

## Objetivos

- Permitir que o dashboard apresente os gráficos de ocorrências/atendimentos filtrados por um intervalo arbitrário (data inicial e data final), sem perder a visão total nos demais painéis (KPIs, aging, saldo, perfil de risco, empreendimentos, etc.).
- Expor em todas as telas que abrem o "detalhe da venda" um bloco consistente com os fiadores da venda, reaproveitando um único componente de UI e um único endpoint.
- Disponibilizar um novo script de ocorrência chamado **"Alteração de Data"** com descrição livre, para registro padronizado de mudanças de data.
- Elevar a qualidade textual do frontend corrigindo pontuação/acentuação nas strings visíveis ao usuário.

### Métricas de sucesso

- 100% dos 9 endpoints `/dashboard/*` relativos a ocorrências/próximas ações aceitam e honram `dataInicio`/`dataFim`.
- 100% das telas listadas em "Funcionalidades Principais" (item 2) exibem o `FiadoresPanel` quando o detalhe da venda é aberto.
- 0 ocorrência de lint (`npm run lint`) após a refatoração de português.
- Tempo médio de resposta dos endpoints filtrados ≤ tempo médio atual + 10% (filtro aplicado via índice/predicate no próprio SQL, sem full scan adicional).

## Histórias de Usuário

- **Como operador de cobrança**, quero filtrar os gráficos de ocorrências por um intervalo de datas para analisar minha produtividade (ocorrências por dia/hora, próximas ações agendadas) em uma janela específica (ex.: última semana, fechamento do mês).
- **Como gestor da carteira**, quero comparar o volume de ocorrências entre dois períodos do ano aplicando datas diferentes, para medir sazonalidade e impacto de campanhas.
- **Como operador**, ao abrir o atendimento/ficha de uma venda, quero ver os associados daquela venda (cônjuge, cessionários, fiadores) com nome, data de cadastro, renda familiar, tipo da associação e endereço para acionar o contato certo sem precisar consultar outro sistema.
- **Como operador**, quero registrar uma ocorrência do tipo "Alteração de Data" com texto livre quando o cliente solicita a remarcação de um compromisso ou pagamento, sem ter que improvisar num dos scripts atuais.
- **Como usuário final**, quero ler as telas do sistema em português correto, com acentuação adequada, para ter uma experiência profissional e sem ambiguidades.

## Funcionalidades Principais

### 1. Filtro de período na seção de Ocorrências/Atendimentos do Dashboard

- **O que faz**: adiciona um componente de filtro (`DateRangeFilter`) no topo da seção de gráficos de ocorrências/atendimentos do Dashboard com dois campos (`Data inicial`, `Data final`), presets (Hoje, 7 dias, 30 dias, Mês atual, Ano atual) e um botão "Limpar".
- **Por que é importante**: dá autonomia analítica para a equipe e torna os gráficos operacionais úteis fora do modo "totais".
- **Como funciona em alto nível**:
  - Os valores escolhidos são persistidos em `searchParams` da URL (`?dtIni=YYYY-MM-DD&dtFim=YYYY-MM-DD`) para permitir deep-link e preservar o estado em refresh.
  - O estado é propagado para todos os `fetchDashboard(...)` dos endpoints afetados, que passam `dataInicio`/`dataFim` como querystring.
  - O backend aplica o filtro via `OCORRENCIAS.DT_OCORRENCIA BETWEEN @dataInicio AND @dataFim` somente quando os dois parâmetros forem informados.
- **Endpoints afetados** (9):
  - `GET /dashboard/ocorrencias`
  - `GET /dashboard/ocorrencias-por-usuario`
  - `GET /dashboard/ocorrencias-por-venda`
  - `GET /dashboard/ocorrencias-por-dia`
  - `GET /dashboard/ocorrencias-por-hora`
  - `GET /dashboard/ocorrencias-por-dia-hora`
  - `GET /dashboard/proximas-acoes-por-dia`
  - `GET /dashboard/acoes-definidas`
  - `GET /dashboard/atendentes-proxima-acao`

#### Requisitos Funcionais (FR)

- **FR-1.1** O componente de filtro fica ancorado **dentro** da seção de gráficos de ocorrências/atendimentos, não no topo global da página.
- **FR-1.2** Os demais gráficos do Dashboard (KPIs, aging, saldo por mês, perfil de risco, empreendimentos, parcelas, score x saldo, status de repasse, blocos, unidades, usuários ativos) **não** são afetados pelo filtro.
- **FR-1.3** O filtro aceita apenas `dataFim >= dataInicio`. Tentativas inválidas são rejeitadas com feedback visual no próprio componente (sem chamada ao backend).
- **FR-1.4** Os presets preenchem os dois campos com o intervalo correspondente calculado em `America/Sao_Paulo`.
- **FR-1.5** O botão "Limpar" remove os parâmetros da URL e volta os gráficos ao modo "sem filtro" (total histórico).
- **FR-1.6** Formato de data aceito pelo backend: `YYYY-MM-DD`. Validação no backend via helper central (`parseDateRange`).
- **FR-1.7** Quando apenas um dos parâmetros é informado, a requisição retorna `400` com mensagem clara.
- **FR-1.8** Requests sem `dataInicio`/`dataFim` continuam funcionando exatamente como hoje (compatibilidade retroativa).

### 2. Painel de Fiadores (`FiadoresPanel`) no detalhe da venda

- **O que faz**: exibe um painel com a lista de associados de uma venda (cônjuge, cessionário, fiador, etc.) sempre que o usuário abrir o detalhe da venda de um cliente.
- **Por que é importante**: reduz o _multi-window_ na rotina de cobrança e acelera a ação do operador (mais canais de contato à mão).
- **Como funciona em alto nível**:
  - Um novo recurso REST `/inadimplencia/fiadores` consulta a view `DW.vw_fiadores_por_venda` (já criada no banco) e retorna a lista associada.
  - Um componente único `<FiadoresPanel numVenda={...} />` é plugado nos 5 pontos listados abaixo, sempre agrupado visualmente com as "outras informações do cliente".

#### Telas em que o painel aparece

- **TR-2.1** `TrainingsPage` — ao iniciar/consultar um atendimento (detalhe da venda selecionada).
- **TR-2.2** `NoNextActionPage` — ao expandir o card/linha da venda sem próxima ação.
- **TR-2.3** `MyResponsibilityPage` — detalhe da venda dentro da carteira pessoal.
- **TR-2.4** `InteractiveCalendar` — dentro do `EventModal`/`CardModal` do Kanban/Calendário.
- **TR-2.5** Modais de drill-down do Dashboard (`/aging-detalhes`, `/parcelas-detalhes`, `/score-saldo-detalhes`) — ao abrir o detalhe de um cliente na tabela.

#### Requisitos Funcionais (FR)

- **FR-2.1** O painel mostra as colunas: **Nome**, **Data de Cadastro** (formato BR), **Renda Familiar** (formato BRL), **Tipo de Associação** (com realce visual/badge) e **Endereço**.
- **FR-2.2** Quando a venda não tem associados, o painel exibe uma mensagem amigável ("Sem fiadores cadastrados para esta venda.") e ocupa o menor espaço possível.
- **FR-2.3** O painel respeita os estados: loading (skeleton/spinner), erro (mensagem + retry) e vazio.
- **FR-2.4** O painel reutiliza o mesmo componente em todos os pontos de uso (sem duplicação de código).
- **FR-2.5** Endpoint: `GET /inadimplencia/fiadores/num-venda/:numVenda` retorna `{ data: Fiador[] }`. Um endpoint acessório `GET /inadimplencia/fiadores/cpf/:cpf` é fornecido para casos em que o front já tem o CPF e não o número da venda.
- **FR-2.6** Ordenação default: `DATA_CADASTRO DESC, NOME ASC`.
- **FR-2.7** Dados de entrada são apenas leitura; não há mutations neste recurso.

### 3. Script de ocorrência "Alteração de Data"

- **O que faz**: adiciona um novo item ao select de status/script do modal de nova ocorrência.
- **Como funciona em alto nível**: é um novo valor textual em `OCCURRENCE_STATUS_OPTIONS` (sem template pré-preenchido, descrição 100% livre), salvo em `OCORRENCIAS.STATUS_OCORRENCIA` como qualquer outro status.

#### Requisitos Funcionais (FR)

- **FR-3.1** O script "Alteração de Data" aparece na lista de scripts/status disponíveis para qualquer usuário (sem guard de perfil).
- **FR-3.2** O campo de descrição é livre (textarea sem template).
- **FR-3.3** A criação da ocorrência reutiliza o fluxo atual (`POST /inadimplencia/ocorrencias`), sem alteração de contrato.
- **FR-3.4** O Swagger do backend passa a documentar o enum ampliado de status (informativo, não quebra retrocompatibilidade — o backend continua aceitando qualquer string).

### 4. Refatoração de português (strings visíveis ao usuário)

- **O que faz**: corrige acentuação, pontuação e concordância em todas as strings renderizadas ao usuário final.
- **Escopo** (estrito): `JSX text nodes`, atributos `label`, `placeholder`, `aria-label`, `title`, `alt`, mensagens do `Swal.fire` e strings passadas a componentes de UI (ex.: `title` do `Modal`, `header` de colunas do `Table`).
- **Fora de escopo**: comentários `//`/JSDoc, nomes de variáveis/funções/arquivos/rotas/colunas SQL, mensagens em `throw new Error(...)`, backend (mensagens de API, Swagger).

#### Requisitos Funcionais (FR)

- **FR-4.1** Palavras com acentuação faltando devem ser corrigidas (ex.: `historico` → `histórico`, `proxima` → `próxima`, `acao` → `ação`, `conclucoes` → `conclusões`, `nao` → `não`, `e` → `é`, `usuario` → `usuário`).
- **FR-4.2** A varredura deve cobrir todos os `.tsx/.ts` em `src/` do projeto `jnc_inadimplencia`.
- **FR-4.3** Após a refatoração, `npm run lint` deve continuar sem erros e a aplicação deve continuar renderizando corretamente.
- **FR-4.4** Nenhum identificador (variável/função/arquivo/chave de objeto/rota/classe CSS) é alterado.

## Experiência do Usuário

### Jornadas principais

1. **Analisar produtividade da semana**
   - Operador abre Dashboard → localiza a seção de gráficos de ocorrências/atendimentos → clica no preset "7 dias" → todos os gráficos da seção recarregam com o recorte. KPIs e demais painéis permanecem com totais.
   - URL atualizada para `/home/dashboard?dtIni=2026-04-15&dtFim=2026-04-22` (copiar/compartilhar).
2. **Acionar fiador**
   - Operador busca venda pelo CPF/número → abre o detalhe → o painel `Fiadores` aparece logo abaixo dos dados do cliente → operador copia o nome e endereço do cônjuge para acionamento.
3. **Registrar alteração de data**
   - Operador está em um atendimento → clica em "Nova ocorrência" → seleciona "Alteração de Data" no select → digita a justificativa/contexto livre → define nova `PROXIMA_ACAO` → salva.
4. **Experiência textual**
   - Usuário lê todas as páginas com português correto, sem distração visual por palavras desacentuadas.

### Considerações de UI/UX

- `DateRangeFilter` deve ser compacto (uma única linha em desktop, com colapso responsivo em telas <768px).
- Presets visíveis e acessíveis via teclado.
- `FiadoresPanel` deve ocupar visualmente o mesmo "card" onde as informações do cliente já aparecem (consistência visual).
- Badges de `Tipo de Associação` com paleta consistente com o design system atual (reaproveitar cores por categoria se fizer sentido — ex.: CÔNJUGE, CESSIONÁRIO, FIADOR).
- Refatoração de português **não** altera layout, espaçamentos nem hierarquia tipográfica.

### Acessibilidade

- Campos de data do filtro usam `<Input type="date">` nativos (já em uso no projeto) com `aria-label` traduzido.
- Ícones decorativos usam `aria-hidden`.
- `FiadoresPanel` em estado de loading expõe `role="status"` e `aria-live="polite"`.

## Restrições Técnicas de Alto Nível

- **SQL Server (DW)**: a tabela `DW.fat_associados_num_venda` e a view `DW.vw_fiadores_por_venda` **já foram criadas pelo usuário no banco**. Não há migração a executar; apenas versionar os scripts em `src/modules/inadimplencia/docs/sql/` para histórico.
- **Retrocompatibilidade**: os endpoints existentes de `/dashboard/*` não podem quebrar clientes atuais — o filtro é opcional (querystring) e, quando ausente, o comportamento é idêntico ao de hoje.
- **Segurança**: API continua sem autenticação por token; confiança em CORS + origem Fluig. Sem dados PII novos expostos — `fat_associados_num_venda` já é visível no DW.
- **Performance**: o filtro de data deve ser aplicado via predicate no SQL e aproveitar o índice existente em `OCORRENCIAS.DT_OCORRENCIA` (ou criar um se necessário — item da Tech Spec).
- **Stack mandatória**: continuar em Node 18+ CJS + Express 4 + mssql 10 no backend; React 19 + Vite 7 + MUI 7 + React Router 7 no frontend.
- **Timezone**: toda interpretação de data ocorre em `America/Sao_Paulo` (já convenção do projeto em `src/shared/constants/time.ts`).

## Fora de Escopo

- Alterar o comportamento dos demais gráficos do Dashboard (KPIs, aging, saldo por mês, perfil de risco, empreendimentos, parcelas, score x saldo, status de repasse, blocos, unidades, usuários ativos) — permanecem como totais.
- Criar CRUD para `fat_associados_num_venda` — é somente leitura.
- Templates pré-preenchidos para o script "Alteração de Data" (descrição é livre nesta entrega).
- Correção ortográfica em comentários, nomes de variáveis/arquivos, rotas, Swagger ou mensagens do backend.
- Autenticação/autorização granular para o novo recurso de fiadores.
- Cache de resposta dos endpoints com filtro de período.

## Questões em Aberto

- Existe algum mapeamento oficial de cores por `TIPO_ASSOCIACAO`? (Se não, será definido pragmáticamente na Tech Spec a partir da paleta existente.)
- Há regra de negócio para o caso `RENDA_FAMILIAR = 0.01` (placeholder "não informado")? (Assumiremos, por ora, que valores ≤ 1,00 são exibidos como "Não informado"; confirmar antes da release.)
- O `DT_OCORRENCIA` armazenado no banco é sempre em horário de Brasília? (Assumido pelo contexto atual — validar com amostra antes do merge.)
