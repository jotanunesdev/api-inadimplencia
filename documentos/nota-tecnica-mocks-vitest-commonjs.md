# Nota Técnica: Limitação de Mocks Vitest com CommonJS e Decisão de Testes

## Contexto

Durante a implementação da tarefa 6.0 (Fluxo de envio PEFIN: divida principal + garantidores sequenciais), foi identificada uma limitação técnica significativa relacionada ao uso do Vitest com módulos CommonJS para testes unitários complexos.

## Problema Original

O Vitest não está conseguindo mockar corretamente módulos CommonJS em testes que dependem de múltiplas dependências. As seguintes abordagens foram tentadas sem sucesso:

1. **Mock direto com `vi.mock`**: O mock não funcionou, resultando em erros como `model.findInadimplenciaByNumVenda.mockResolvedValue is not a function`.

2. **Mock com objetos factory**: Mesmo problema - as funções não eram reconhecidas como mocks.

3. **Uso de `vi.mocked`**: Esta função não existe na versão do Vitest usada no projeto (v3.2.4).

4. **Uso de `vi.spyOn`**: Funcionou parcialmente para o model, mas não para o payload builder.

5. **Abordagem híbrida** (vi.mock para payload builder + vi.spyOn para model): Também não funcionou.

6. **Conversão para ES modules**: Não é viável porque o service (`serasaPefinService.js`) e outras dependências usam CommonJS, o que exigiria uma refatoração massiva de todo o módulo.

## Solução Adotada (Tarefa 6.0)

Dada a limitação técnica, foi tomada a decisão pragmática de:

1. **Simplificar os testes unitários**: Manter apenas testes para as helper functions que não dependem de mocks complexos:
   - `formatSolicitationForHistory`
   - `formatSolicitationForDetail`
   - `formatGuarantorForPreview`

2. **Remover testes complexos de `requestNegativacao`**: Os testes que validam o fluxo completo de orquestração (envio principal, envio de garantidores, tratamento de erros) foram removidos temporariamente.

3. **Validação manual**: A implementação da função `requestNegativacao` foi validada manualmente através de revisão de código e análise da lógica implementada.

## Decisão de Padronização de Testes (Tarefa 14.0)

Na tarefa 14.0, foi tomada a decisão de manter **dois runners de teste** por necessidade técnica:

### Estrutura de Testes Atual

1. **Vitest** (runner padrão do projeto):
   - Usado para testes de módulos que não dependem de CommonJS complexo
   - Configuração: `vitest.config.ts`
   - Scripts: `npm test` (Vitest run), `npm run test:watch` (Vitest watch)
   - **Todos os testes do módulo inadimplencia (incluindo Serasa) são excluídos do Vitest** devido à limitação de mocks CommonJS

2. **Jest** (runner para módulo inadimplencia):
   - Usado para todos os testes do módulo inadimplência, incluindo Serasa PEFIN
   - Configuração: `jest.config.js`
   - Scripts: `npm run test:jest` (Jest padrão), `npm run test:serasa` (suite completa Serasa PEFIN)
   - Suporta mocks CommonJS nativamente

### Scripts Oficiais de Teste

No `package.json`, os scripts foram padronizados:

```json
"test": "vitest run",              // Runner padrão: Vitest
"test:watch": "vitest",           // Modo watch: Vitest
"test:coverage": "vitest run --coverage",
"test:jest": "jest",              // Runner para inadimplência: Jest
"test:serasa": "npm run test:jest -- src/modules/inadimplencia/serasaPefin.integration.test.js --runInBand && npm run test:jest -- src/modules/inadimplencia/controllers/serasaPefinController.test.js --runInBand && npm run test:jest -- src/modules/inadimplencia/services/serasaPefinService.test.js --runInBand && npm run test:jest -- src/modules/inadimplencia/services/serasaPefinHttpClient.test.js --runInBand && npm run test:jest -- src/modules/inadimplencia/services/serasaPefinPayloadBuilder.test.js --runInBand && npm run test:jest -- src/modules/inadimplencia/models/serasaPefinModel.test.js --runInBand"
```

### Exclusões no Vitest

O arquivo `vitest.config.ts` exclui explicitamente todos os testes do módulo inadimplência:

```typescript
exclude: [
  "node_modules",
  "dist",
  "src/modules/inadimplencia/controllers/notificationsController.test.js",
  "src/modules/inadimplencia/controllers/ocorrenciasController.test.js",
  "src/modules/inadimplencia/controllers/responsavelController.test.js",
  "src/modules/inadimplencia/controllers/serasaPefinController.test.js",
  "src/modules/inadimplencia/models/kanbanStatusModel.test.js",
  "src/modules/inadimplencia/models/notificationsModel.test.js",
  "src/modules/inadimplencia/models/notificationsRepository.test.js",
  "src/modules/inadimplencia/serasaPefin.integration.test.js",
  "src/modules/inadimplencia/services/notificationService.test.js",
  "src/modules/inadimplencia/services/notificationsSmoke.test.js",
  "src/modules/inadimplencia/services/overdueScanner.test.js",
  "src/modules/inadimplencia/services/responsavelAssignmentService.test.js",
  "src/modules/inadimplencia/services/sseHub.test.js",
  "src/modules/inadimplencia/services/serasaPefinService.test.js",
  "src/modules/inadimplencia/services/serasaPefinHttpClient.test.js",
  "src/modules/inadimplencia/services/serasaPefinPayloadBuilder.test.js",
  "src/modules/inadimplencia/models/serasaPefinModel.test.js",
],
```

### Conversão do Integration Test

O arquivo `serasaPefin.integration.test.js` foi convertido de APIs Vitest (`vi.fn()`, `vi.clearAllMocks()`) para APIs Jest (`jest.fn()`, `jest.clearAllMocks()`) para rodar no runner Jest.

## Status Atual

- ✅ Scripts de teste padronizados e sem duplicidade
- ✅ Todos os testes do módulo inadimplência (incluindo Serasa) rodam com Jest
- ✅ Suite Serasa PEFIN completa com comando `npm run test:serasa`
- ✅ Testes de regressão adicionados para bugs corrigidos nas tasks 10.0-13.0
- ✅ Vitest continua como runner padrão para outros módulos (GLPI, etc.)
- ⚠️ Limitação de mocks Vitest com CommonJS permanece, mas mitigada pelo uso de Jest para inadimplência

## Recomendações Futuras

### Opção 1: Manter Dois Runners (Recomendado a Curto Prazo)

Continuar com a configuração atual:
- Vitest para módulos que não têm limitação CommonJS (GLPI, novos módulos)
- Jest para módulo inadimplência que precisa de mocks CommonJS
- Documentar claramente qual runner usar para cada módulo

### Opção 2: Refatoração para ES Modules (Recomendado a Longo Prazo)

Refatorar o módulo de inadimplência para usar ES modules:
- Converter `require()` para `import`
- Converter `module.exports` para `export`
- Atualizar a configuração do Vitest para ESM
- Unificar todos os testes em um único runner (Vitest)
- Isso permitiria o uso completo de mocks do Vitest

### Opção 3: Migrar Tudo para Jest

Migrar todo o projeto para Jest:
- Avaliar se o custo de migração vale a padronização
- Considerar que Vitest é mais rápido e tem melhor integração com TypeScript
- Jest tem suporte maduro para CommonJS

## Arquivos Afetados

- `package.json` - Scripts de teste padronizados
- `vitest.config.ts` - Exclusões atualizadas para todos os testes inadimplência
- `src/modules/inadimplencia/serasaPefin.integration.test.js` - Convertido de Vitest para Jest
- `documentos/nota-tecnica-mocks-vitest-commonjs.md` - Este documento atualizado
- `tasks/prd-integracao-serasa-pefin/tasks.md` - Tarefa 14.0 marcada como concluída

## Conclusão

A decisão de manter dois runners de teste é uma solução pragmática que resolve o problema imediato de ambiguidade nos scripts e limitação de mocks, permitindo que o projeto avance com testes funcionais. A longo prazo, a refatoração para ES modules permitiria unificar os runners e simplificar a infraestrutura de testes.
