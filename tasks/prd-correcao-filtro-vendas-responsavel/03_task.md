# Tarefa 3.0: Testes — Testes de unidade e integração para o filtro

## Visão Geral

<complexity>MEDIUM</complexity>

Criar e executar testes completos para garantir que o filtro de período no endpoint `/vendas-por-responsavel` funcione corretamente, cobrindo casos válidos, inválidos e edge cases.

<requirements>
- Testes de unidade para o controller: validação de parâmetros, parse de datas
- Testes de unidade para o model: geração correta do SQL com e sem filtro
- Testes de integração: chamadas HTTP completas validando status e resposta
- Cobertura dos casos de erro (400) e sucesso (200)
</requirements>

## Subtarefas

- [ ] 3.1 Criar/Atualizar testes de unidade em `dashboardController.test.ts` para `getVendasPorResponsavel`
- [ ] 3.2 Criar/Atualizar testes de unidade em `dashboardModel.test.ts` para `vendasPorResponsavel`
- [ ] 3.3 Criar testes de integração para o endpoint com filtros
- [ ] 3.4 Executar todos os testes e garantir que passam

## Detalhes de Implementação

### Testes do Controller

Exemplos de casos de teste:

```typescript
describe('GET /dashboard/vendas-por-responsavel', () => {
  it('deve retornar 200 com dados quando filtro não é informado', async () => {
    // Mock model retornando dados
    // Verificar que parseDateRange foi chamado
    // Verificar resposta 200 com { data: [...] }
  });

  it('deve aplicar filtro quando dataInicio e dataFim são informados', async () => {
    // Query: ?dataInicio=2026-01-01&dataFim=2026-01-31
    // Verificar que model.vendasPorResponsavel foi chamado com range correto
  });

  it('deve retornar 400 quando apenas dataInicio é informado', async () => {
    // Query: ?dataInicio=2026-01-01
    // Verificar resposta 400 com mensagem de erro
  });

  it('deve retornar 400 quando apenas dataFim é informado', async () => {
    // Query: ?dataFim=2026-01-31
    // Verificar resposta 400 com mensagem de erro
  });

  it('deve retornar 400 quando dataFim < dataInicio', async () => {
    // Query: ?dataInicio=2026-01-31&dataFim=2026-01-01
    // Verificar resposta 400
  });

  it('deve retornar 400 quando formato de data é inválido', async () => {
    // Query: ?dataInicio=invalid&dataFim=2026-01-31
    // Verificar resposta 400
  });
});
```

### Testes do Model

```typescript
describe('vendasPorResponsavel model', () => {
  it('deve gerar SQL sem filtro de data quando range não é informado', async () => {
    // Chamar vendasPorResponsavel() sem parâmetros
    // Verificar que query não contém BETWEEN
  });

  it('deve gerar SQL com filtro VENCIMENTO_MAIS_ANTIGO quando range é informado', async () => {
    // Chamar vendasPorResponsavel({ hasRange: true, dataInicio: '2026-01-01', dataFim: '2026-01-31' })
    // Verificar que query contém "VENCIMENTO_MAIS_ANTIGO BETWEEN @dataInicio AND @dataFim"
    // Verificar que inputs @dataInicio e @dataFim foram definidos
  });

  it('deve incluir condição VENCIMENTO_MAIS_ANTIGO IS NOT NULL quando range é informado', async () => {
    // Verificar que NULLs são excluídos quando há filtro de data
  });
});
```

## Critérios de Sucesso

- [ ] Todos os testes de unidade passam
- [ ] Todos os testes de integração passam
- [ ] Cobertura de código > 80% para as linhas modificadas
- [ ] Testes validam tanto o sucesso quanto os casos de erro
- [ ] Testes verificam a segurança (parametrização SQL, não concatenação)

## Testes da Tarefa

- [ ] Executar `npm test` no backend — todos os testes do módulo inadimplência devem passar
- [ ] Executar `npm run test:unit` no frontend — verificar hooks e components relacionados
- [ ] Teste manual via Swagger ou frontend para confirmar comportamento end-to-end

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `@c:/api-inadimplencia/src/modules/inadimplencia/controllers/dashboardController.test.ts`
- `@c:/api-inadimplencia/src/modules/inadimplencia/models/dashboardModel.test.ts`
