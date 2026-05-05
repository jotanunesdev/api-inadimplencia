# PRD — Módulo GLPI (api-inadimplencia)

## Visão Geral

O **Módulo GLPI** é um novo módulo da `api-inadimplencia` cujo objetivo é expor, via HTTP REST, dados operacionais do sistema de gestão de chamados **GLPI** (chamados, inventário de ativos e custos de atendimento) para consumo por dashboards corporativos, painéis de BI e ferramentas internas de acompanhamento.

Hoje essas informações só estão disponíveis através de consultas SQL diretas ao banco do GLPI, o que dificulta o consumo por aplicações modernas (Fluig, dashboards web, planilhas integradas) e centraliza o acesso ao banco em poucos analistas. O módulo resolve esse gargalo entregando três endpoints **GET somente leitura** que executam as consultas oficiais já validadas pela equipe e devolvem JSON normalizado.

O módulo terá **configuração isolada** (arquivo `.env` próprio com prefixo dedicado) para que credenciais e allowlist de CORS do GLPI não sejam misturadas com as demais integrações já existentes na API.

## Objetivos

- Disponibilizar **3 endpoints GET** públicos (controlados por CORS) cobrindo: Chamados, Inventário e Custos de atendimento.
- Permitir que cada endpoint seja consumido com filtro **por empresa** (DW, DECODIFICAR, ESSOLUCAO, JOTANUNES) — opcional, executado pelo consumidor a partir do campo retornado.
- Eliminar a necessidade de acesso direto ao banco do GLPI por usuários de negócio.
- Tempo de resposta do endpoint **< 5 s** em condições normais (volume atual ~50k tickets, ~5k ativos).
- Não permitir nenhum tipo de escrita (módulo 100% read-only).
- Configuração de conexão e CORS **totalmente parametrizável** via variáveis de ambiente.

## Histórias de Usuário

- Como **analista de BI**, quero consumir os chamados do GLPI via API JSON para alimentar dashboards do Power BI sem depender de acesso direto ao banco.
- Como **gestor de TI**, quero filtrar chamados e custos por empresa parceira (DW, Decodificar, ESSolução) para conferir o faturamento mensal de cada fornecedora.
- Como **coordenador de infraestrutura**, quero listar o inventário consolidado (computadores, equipamentos de rede e linhas) para conciliar com o controle patrimonial.
- Como **desenvolvedor front-end** do portal interno, quero chamar a API somente do domínio liberado por CORS, garantindo que dados sensíveis não vazem para origens externas.
- Como **administrador da API**, quero apontar a aplicação para um banco GLPI de homologação ou produção apenas trocando variáveis no `.env`, sem alterar código.

## Funcionalidades Principais

### 1. Endpoint GET de Chamados

- **O que faz:** retorna a lista de chamados (incidentes e requisições) do GLPI com técnico responsável, categoria, grupo de equipe derivado, empresa do técnico, SLAs, localização e etiquetas.
- **Por quê:** é a principal fonte para acompanhamento operacional e cobrança de fornecedoras.
- **Como funciona:** executa a consulta oficial de chamados já homologada (vide anexo de regras) e devolve JSON.

**Requisitos funcionais:**
1. O endpoint **DEVE** ser exposto em `GET /glpi/chamados`.
2. O endpoint **DEVE** retornar todos os campos da consulta oficial, incluindo `grupo_equipe` e `grupo_empresa` derivados via CASE.
3. O endpoint **DEVE** aceitar filtro por período via query params `data_inicio` e `data_fim` (formato `YYYY-MM-DD`), aplicados sobre `data_abertura`.
4. O endpoint **DEVE** aceitar filtro `status` (lista textual: Novo, Atribuido, Planejado, BackLog, Em Validacao, Fechado).
5. O endpoint **DEVE** aceitar filtro `tipo` (Incidente, Requisicao).
6. O endpoint **NÃO DEVE** retornar registros com `is_deleted = 1`.
7. O endpoint **NÃO DEVE** retornar registros dos usuários `priscilla.ribeiro` e `fabio.machado` (regra herdada da consulta oficial).
8. Quando nenhum filtro for informado, o endpoint **DEVE** retornar a base completa ordenada por `id` ascendente.

### 2. Endpoint GET de Inventário

- **O que faz:** retorna a união consolidada de **Computadores**, **Equipamentos de Rede** e **Linhas** do GLPI com localização, tipo, responsável, status, etiqueta e custo.
- **Por quê:** é a base patrimonial do parque tecnológico — usada por TI, Compras e Contabilidade.
- **Como funciona:** executa a consulta oficial de inventário (UNION ALL das três fontes) e devolve JSON unificado.

**Requisitos funcionais:**
9. O endpoint **DEVE** ser exposto em `GET /glpi/inventario`.
10. O endpoint **DEVE** retornar a estrutura unificada com colunas: `id`, `ativo`, `serial`, `comment`, `localizacao`, `cidade`, `estado`, `tipo`, `lotado_para`, `status`, `date_creation`, `date_mod`, `last_inventory_update`, `etiqueta`, `custo`.
11. O endpoint **DEVE** incluir um campo discriminador `origem` com valores `Computer`, `NetworkEquipment` ou `Line` para facilitar a separação no consumidor.
12. O endpoint **DEVE** aceitar filtro `tipo_origem` (`computer`, `network`, `line`) para retornar apenas uma das fontes.
13. O endpoint **DEVE** aceitar filtro por período via `data_inicio` e `data_fim`, aplicados sobre `date_creation`.
14. O endpoint **NÃO DEVE** retornar registros com `is_deleted = 1` em qualquer das três fontes.

### 3. Endpoint GET de Custos

- **O que faz:** retorna os custos lançados em chamados pelas equipes terceiras (DW, DECODIFICAR, ESSOLUCAO).
- **Por quê:** insumo direto para conferência de faturas de fornecedoras de TI.
- **Como funciona:** executa a consulta oficial de custos, já filtrada para grupos das três empresas e custo total ≠ 0.

**Requisitos funcionais:**
15. O endpoint **DEVE** ser exposto em `GET /glpi/custos`.
16. O endpoint **DEVE** retornar todos os campos da consulta oficial: `id`, `tickets_id`, `grupo`, `titulo`, `comment`, `data_atendimento`, `custo_total`.
17. O endpoint **DEVE** aceitar filtro por período via `data_inicio` e `data_fim`, aplicados sobre `data_atendimento`.
18. O endpoint **DEVE** aceitar filtro `grupo` (substring case-insensitive sobre o nome do grupo, ex.: `DW`, `DECODIFICAR`, `ESSOLUCAO`).
19. O endpoint **NÃO DEVE** retornar registros com `custo_total = 0`.

### 4. Configuração isolada via `.env`

- **O que faz:** disponibiliza um arquivo `.env` exclusivo do módulo (ou bloco dedicado no `.env` raiz com prefixo `GLPI_`) contendo conexão, allowlist de CORS e flags operacionais.
- **Por quê:** isola credenciais do GLPI das demais integrações e permite ativar/desativar o módulo sem afetar o restante da API.

**Requisitos funcionais:**
20. O módulo **DEVE** carregar suas variáveis com prefixo `GLPI_` (ex.: `GLPI_DB_HOST`, `GLPI_DB_PORT`, `GLPI_DB_USER`, `GLPI_DB_PASSWORD`, `GLPI_DB_NAME`).
21. O módulo **DEVE** expor variável `GLPI_CORS_ORIGINS` (lista separada por vírgula) consumida por middleware de CORS específico das rotas `/glpi/*`.
22. O módulo **DEVE** expor variável `GLPI_ENABLED` (boolean) que, quando `false`, não registra as rotas.
23. O módulo **DEVE** expor variável `GLPI_QUERY_TIMEOUT_MS` (default 30000) para evitar travamento por consulta lenta.
24. Um arquivo `.env.example` (ou seção dedicada) **DEVE** documentar todas as variáveis com valores fictícios.

### 5. Resposta padronizada

**Requisitos funcionais:**
25. Toda resposta de sucesso **DEVE** seguir o formato `{ "data": [...], "count": <int>, "filters": {...} }`.
26. Toda resposta de erro **DEVE** seguir o padrão atual da `api-inadimplencia` (`{ "error": "<mensagem>", "code": "<codigo>" }`).
27. Erros de conexão com o GLPI **DEVEM** retornar HTTP `503` com mensagem genérica (sem expor host/usuário).
28. Parâmetros inválidos (datas mal formadas, status desconhecido) **DEVEM** retornar HTTP `400` com descrição clara.

## Experiência do Usuário

- **Persona primária:** desenvolvedores e analistas que consomem a API para popular dashboards e relatórios.
- **Fluxo principal:** consumidor faz `GET /glpi/<recurso>?data_inicio=...&data_fim=...` a partir de origem listada no CORS → API responde JSON em < 5 s.
- **Tratamento de erros:** mensagens objetivas em português, códigos HTTP corretos (`200`, `400`, `503`).
- **Documentação:** README do módulo com exemplos `curl` para cada endpoint e descrição de cada filtro.
- **Acessibilidade:** não aplicável (sem UI). Garantir que a documentação seja legível em Markdown.

## Restrições Técnicas de Alto Nível

- **Banco de dados:** SQL Server (réplica do GLPI já disponível no ambiente). As consultas oficiais usam sintaxe compatível com SQL Server; nomes qualificados (`glpi.glpi_*`) devem ser ajustados para `<schema>.<tabela>` conforme o servidor de destino — detalhes ficam para a Tech Spec.
- **Somente leitura:** o módulo **NÃO PODE** executar `INSERT`, `UPDATE`, `DELETE` ou DDL no GLPI. Recomenda-se que o usuário do `.env` tenha permissão apenas de `SELECT`.
- **CORS:** restrito à allowlist do `.env`; sem autenticação JWT/API-Key (decisão explícita do produto).
- **Idioma das colunas:** preservar nomes em português conforme as consultas oficiais (`titulo`, `solicitante`, etc.).
- **Performance:** as três consultas devem responder em até 5 s p95. Se o tempo passar, a Tech Spec deve avaliar índices/cache.
- **Compatibilidade:** seguir a estrutura padrão dos demais módulos em `src/modules/*` (controllers, services, routes, validators).
- **Logs:** registrar tempo de execução de cada consulta no logger padrão da API, sem logar dados sensíveis.

## Fora de Escopo

- **Endpoints POST/PUT/DELETE** sobre dados do GLPI (módulo 100% leitura).
- **Autenticação JWT** ou API-Key (controle apenas via CORS).
- **Cache em Redis/memória** (avaliar em iteração futura se necessário).
- **Webhooks** ou notificações em tempo real do GLPI.
- **Painel front-end** consumindo o módulo (responsabilidade de outras aplicações).
- **Integração com a API REST nativa do GLPI** (a integração será exclusivamente via SQL Server).
- **Endpoints separados por empresa** (`/chamados/dw`, etc.) — a separação será feita pelo consumidor a partir do campo `grupo_empresa` retornado.
- **Exportação em CSV/Excel** diretamente pela API.

## Questões em Aberto

1. As consultas originais foram escritas em sintaxe MySQL; é necessário confirmar que a réplica em SQL Server preserva exatamente os mesmos nomes de tabelas/colunas e funções (`LIKE`, `CASE`, `UNION ALL`) sem ajustes adicionais.
2. Existe necessidade de paginação (`page`, `pageSize`) caso o volume de chamados ultrapasse, no futuro, ~100k linhas? Decisão atual: **não paginar**, mas vale revisitar se p95 ultrapassar 5 s.
3. As empresas relevantes para `grupo_empresa` são fixas (DW, ESSOLUCAO, DECODIFICAR, Jotanunes). Pode haver novas empresas terceirizadas? Caso positivo, a regra do CASE deve virar configuração.
4. O campo `custo_total` em Custos sai sempre em BRL? Confirmar para evitar ambiguidade no consumo.
5. Existe SLA específico de disponibilidade do banco GLPI replicado (janelas de manutenção) que justifique implementar retry automático no módulo?
