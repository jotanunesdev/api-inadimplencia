# Tarefa 10.0: Documentação operacional (`README.md`)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Escrever a documentação operacional do módulo GLPI para um desenvolvedor júnior conseguir configurar o `.env`, subir o servidor e consumir os três endpoints sem ajuda externa. Complementa o Swagger (tarefa 9.0) com guia narrativo, comandos e troubleshooting.

<requirements>
- `src/modules/glpi/README.md` autossuficiente, em português, com as seguintes seções:
  1. **Visão geral** do módulo (1 parágrafo, propósito e endpoints).
  2. **Pré-requisitos** (Node, acesso ao MySQL do GLPI, usuário read-only).
  3. **Configuração do `.env`** — copiar de `.env.example`, descrição linha a linha de cada variável `GLPI_*`.
  4. **Comandos** — `npm install`, `npm run dev:glpi`, `npm run start:glpi`, link para o Swagger UI (`/docs` e `/docs-json/glpi`).
  5. **Exemplos `curl`** — pelo menos um exemplo para cada endpoint:
     - `GET /glpi/health`
     - `GET /glpi/chamados` (sem filtros e com `data_inicio`, `data_fim`, `status`, `tipo`)
     - `GET /glpi/inventario` (sem filtros e com `tipo_origem=computer`)
     - `GET /glpi/custos` (sem filtros e com `grupo=DW`)
  6. **Formato de resposta** — exemplo JSON real `{ data, count, filters }` para um dos endpoints.
  7. **Códigos de erro** — tabela com 400 (`INVALID_FILTER`), 403 (`FORBIDDEN_ORIGIN`), 503 (`GLPI_NOT_CONFIGURED`, `GLPI_DISABLED`, `DB_UNAVAILABLE`).
  8. **Troubleshooting** — diagnósticos para os 3 problemas mais comuns: módulo retorna 503, CORS bloqueado (403), filtro de data malformado (400).
  9. **Limitações conhecidas** — somente leitura, dependência do plugin Tag, datas como string ISO, sem paginação.
- Linkar o `prd.md` e o `techspec.md` no rodapé.
</requirements>

## Subtarefas

- [ ] 10.1 Esboçar índice e seções do README seguindo a estrutura acima.
- [ ] 10.2 Coletar exemplos `curl` reais executando o servidor local (tarefa 7.0 já concluída) e copiando outputs.
- [ ] 10.3 Escrever a tabela de códigos de erro consultando os retornos definidos nas tarefas 2.0–6.0.
- [ ] 10.4 Revisar com leitura externa: pedir a um colega para seguir o passo a passo do zero (ou simular essa revisão fazendo o mesmo em uma máquina limpa) e ajustar pontos de fricção.
- [ ] 10.5 Adicionar referência ao README na raiz do projeto (`c:\api-inadimplencia\README.md`) listando o novo módulo, se já existir um índice de módulos.

## Detalhes de Implementação

Sem componentes de código. O README deve referenciar o Swagger gerado em 9.0 (`/docs` e `/docs-json/glpi`) e as variáveis documentadas no `.env.example` da tarefa 1.0. Reaproveitar fluxo de exemplos análogo ao que existe em `src/modules/estoque-online/docs/` (caso haja) ou no README raiz da `api-inadimplencia`.

## Critérios de Sucesso

- Um desenvolvedor júnior conseguir, seguindo apenas o README, copiar o `.env.example`, preencher com credenciais válidas, subir `npm run dev:glpi` e bater os três endpoints.
- Todos os exemplos `curl` funcionam quando colados no terminal (substituindo apenas host/porta).
- Tabela de erros cobre todos os `code` documentados nas tarefas anteriores, sem inventar códigos novos.
- Troubleshooting menciona explicitamente como verificar `GLPI_CORS_ORIGIN`, `GLPI_ENABLED` e conectividade com o MySQL.

## Testes da Tarefa

- [ ] Testes de unidade — não aplicável (documento Markdown).
- [ ] Testes de integração — validação manual: executar cada `curl` do README contra o servidor local e comparar saída com o exemplo documentado.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\src\modules\glpi\README.md`
- Referência: `c:\api-inadimplencia\src\modules\glpi\.env.example` (tarefa 1.0)
- Referência: `c:\api-inadimplencia\src\modules\glpi\docs\openapi.js` (tarefa 9.0)
- Referência: `c:\api-inadimplencia\README.md` (eventual atualização do índice)
- Dependências: tarefas 1.0–9.0
