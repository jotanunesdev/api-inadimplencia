const jsonResponse = {
  '200': {
    description: 'Sucesso',
    content: {
      'application/json': {
        schema: {
          oneOf: [
            { type: 'object', additionalProperties: true },
            { type: 'array', items: {} },
          ],
        },
      },
    },
  },
};

const genericRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
};

const pathParam = (name, description, example) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
  example,
});

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'API Inadimplência',
    version: '1.0.0',
    description: 'Documentação da API de Inadimplência.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health', description: 'Monitoramento' },
    { name: 'Inadimplencia', description: 'Dados de inadimplência' },
    { name: 'ProximasAcoes', description: 'Próximas ações' },
    { name: 'Ocorrencias', description: 'Ocorrências' },
    { name: 'Usuarios', description: 'Usuários' },
    { name: 'Responsaveis', description: 'Responsáveis' },
    { name: 'Dashboard', description: 'Indicadores e agregações' },
    { name: 'KanbanStatus', description: 'Status do Kanban' },
    { name: 'Atendimentos', description: 'Atendimentos' },
    { name: 'Relatorios', description: 'Relatórios' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: jsonResponse,
      },
    },
    '/inadimplencia': {
      get: {
        tags: ['Inadimplencia'],
        summary: 'Lista inadimplências',
        responses: jsonResponse,
      },
    },
    '/inadimplencia/cpf/{cpf}': {
      get: {
        tags: ['Inadimplencia'],
        summary: 'Busca inadimplência por CPF',
        parameters: [pathParam('cpf', 'CPF do cliente', '00000000000')],
        responses: jsonResponse,
      },
    },
    '/inadimplencia/num-venda/{numVenda}': {
      get: {
        tags: ['Inadimplencia'],
        summary: 'Busca inadimplência por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
    },
    '/inadimplencia/responsavel/{nome}': {
      get: {
        tags: ['Inadimplencia'],
        summary: 'Busca inadimplencia por responsavel',
        parameters: [pathParam('nome', 'Nome do responsavel', 'joao')],
        responses: jsonResponse,
      },
    },
    '/proximas-acoes': {
      get: {
        tags: ['ProximasAcoes'],
        summary: 'Lista próximas ações',
        responses: jsonResponse,
      },
      post: {
        tags: ['ProximasAcoes'],
        summary: 'Cria próxima ação',
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    '/proximas-acoes/{numVenda}': {
      get: {
        tags: ['ProximasAcoes'],
        summary: 'Busca próxima ação por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
      put: {
        tags: ['ProximasAcoes'],
        summary: 'Atualiza próxima ação por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ['ProximasAcoes'],
        summary: 'Remove próxima ação por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
    },
    '/ocorrencias': {
      get: {
        tags: ['Ocorrencias'],
        summary: 'Lista ocorrências',
        responses: jsonResponse,
      },
      post: {
        tags: ['Ocorrencias'],
        summary: 'Cria ocorrência',
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    '/ocorrencias/num-venda/{numVenda}': {
      get: {
        tags: ['Ocorrencias'],
        summary: 'Busca ocorrências por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
    },
    '/ocorrencias/protocolo/{protocolo}': {
      get: {
        tags: ['Ocorrencias'],
        summary: 'Busca ocorrência por protocolo',
        parameters: [pathParam('protocolo', 'Número do protocolo', 'PROT-001')],
        responses: jsonResponse,
      },
    },
    '/ocorrencias/{id}': {
      get: {
        tags: ['Ocorrencias'],
        summary: 'Busca ocorrência por ID',
        parameters: [pathParam('id', 'ID da ocorrência', '1')],
        responses: jsonResponse,
      },
      put: {
        tags: ['Ocorrencias'],
        summary: 'Atualiza ocorrência por ID',
        parameters: [pathParam('id', 'ID da ocorrência', '1')],
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ['Ocorrencias'],
        summary: 'Remove ocorrência por ID',
        parameters: [pathParam('id', 'ID da ocorrência', '1')],
        responses: jsonResponse,
      },
    },
    '/usuarios': {
      get: {
        tags: ['Usuarios'],
        summary: 'Lista usuários',
        responses: jsonResponse,
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Cria usuário',
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    '/usuarios/{nome}': {
      get: {
        tags: ['Usuarios'],
        summary: 'Busca usuário por nome',
        parameters: [pathParam('nome', 'Nome do usuário', 'joao.silva')],
        responses: jsonResponse,
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Atualiza usuário por nome',
        parameters: [pathParam('nome', 'Nome do usuário', 'joao.silva')],
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ['Usuarios'],
        summary: 'Remove usuário por nome',
        parameters: [pathParam('nome', 'Nome do usuário', 'joao.silva')],
        responses: jsonResponse,
      },
    },
    '/responsaveis': {
      get: {
        tags: ['Responsaveis'],
        summary: 'Lista responsáveis',
        responses: jsonResponse,
      },
      post: {
        tags: ['Responsaveis'],
        summary: 'Cria responsável',
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    '/responsaveis/{numVenda}': {
      get: {
        tags: ['Responsaveis'],
        summary: 'Busca responsável por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
      put: {
        tags: ['Responsaveis'],
        summary: 'Atualiza responsável por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
      delete: {
        tags: ['Responsaveis'],
        summary: 'Remove responsável por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
    },
    '/dashboard/kpis': {
      get: {
        tags: ['Dashboard'],
        summary: 'KPIs do dashboard',
        responses: jsonResponse,
      },
    },
    '/dashboard/vendas-por-responsavel': {
      get: {
        tags: ['Dashboard'],
        summary: 'Vendas por responsável',
        responses: jsonResponse,
      },
    },
    '/dashboard/inadimplencia-por-empreendimento': {
      get: {
        tags: ['Dashboard'],
        summary: 'Inadimplência por empreendimento',
        responses: jsonResponse,
      },
    },
    '/dashboard/clientes-por-empreendimento': {
      get: {
        tags: ['Dashboard'],
        summary: 'Clientes por empreendimento',
        responses: jsonResponse,
      },
    },
    '/dashboard/status-repasse': {
      get: {
        tags: ['Dashboard'],
        summary: 'Status de repasse',
        responses: jsonResponse,
      },
    },
    '/dashboard/blocos': {
      get: {
        tags: ['Dashboard'],
        summary: 'Blocos',
        responses: jsonResponse,
      },
    },
    '/dashboard/unidades': {
      get: {
        tags: ['Dashboard'],
        summary: 'Unidades',
        responses: jsonResponse,
      },
    },
    '/dashboard/usuarios-ativos': {
      get: {
        tags: ['Dashboard'],
        summary: 'Usuários ativos',
        responses: jsonResponse,
      },
    },
    '/dashboard/ocorrencias-por-usuario': {
      get: {
        tags: ['Dashboard'],
        summary: 'Ocorrências por usuário',
        responses: jsonResponse,
      },
    },
    '/dashboard/ocorrencias-por-venda': {
      get: {
        tags: ['Dashboard'],
        summary: 'Ocorrências por venda',
        responses: jsonResponse,
      },
    },
    '/dashboard/ocorrencias-por-dia': {
      get: {
        tags: ['Dashboard'],
        summary: 'Ocorrências por dia',
        responses: jsonResponse,
      },
    },
    '/dashboard/ocorrencias-por-hora': {
      get: {
        tags: ['Dashboard'],
        summary: 'Ocorrências por hora',
        responses: jsonResponse,
      },
    },
    '/dashboard/ocorrencias-por-dia-hora': {
      get: {
        tags: ['Dashboard'],
        summary: 'Ocorrências por dia e hora',
        responses: jsonResponse,
      },
    },
    '/dashboard/proximas-acoes-por-dia': {
      get: {
        tags: ['Dashboard'],
        summary: 'Próximas ações por dia',
        responses: jsonResponse,
      },
    },
    '/dashboard/acoes-definidas': {
      get: {
        tags: ['Dashboard'],
        summary: 'Ações definidas',
        responses: jsonResponse,
      },
    },
    '/dashboard/aging': {
      get: {
        tags: ['Dashboard'],
        summary: 'Aging',
        responses: jsonResponse,
      },
    },
    '/dashboard/parcelas-inadimplentes': {
      get: {
        tags: ['Dashboard'],
        summary: 'Parcelas inadimplentes',
        responses: jsonResponse,
      },
    },
    '/dashboard/parcelas-detalhes': {
      get: {
        tags: ['Dashboard'],
        summary: 'Detalhes de parcelas',
        responses: jsonResponse,
      },
    },
    '/dashboard/score-saldo': {
      get: {
        tags: ['Dashboard'],
        summary: 'Score saldo',
        responses: jsonResponse,
      },
    },
    '/dashboard/score-saldo-detalhes': {
      get: {
        tags: ['Dashboard'],
        summary: 'Detalhes do score saldo',
        responses: jsonResponse,
      },
    },
    '/dashboard/saldo-por-mes-vencimento': {
      get: {
        tags: ['Dashboard'],
        summary: 'Saldo por mês de vencimento',
        responses: jsonResponse,
      },
    },
    '/dashboard/perfil-risco-empreendimento': {
      get: {
        tags: ['Dashboard'],
        summary: 'Perfil de risco por empreendimento',
        responses: jsonResponse,
      },
    },
    '/dashboard/atendentes-proxima-acao': {
      get: {
        tags: ['Dashboard'],
        summary: 'Atendentes por próxima ação',
        responses: jsonResponse,
      },
    },
    '/dashboard/aging-detalhes': {
      get: {
        tags: ['Dashboard'],
        summary: 'Detalhes do aging',
        responses: jsonResponse,
      },
    },
    '/kanban-status': {
      get: {
        tags: ['KanbanStatus'],
        summary: 'Lista status do Kanban',
        responses: jsonResponse,
      },
      post: {
        tags: ['KanbanStatus'],
        summary: 'Cria ou atualiza status do Kanban',
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    '/atendimentos/cpf/{cpf}': {
      get: {
        tags: ['Atendimentos'],
        summary: 'Busca atendimentos por CPF',
        parameters: [pathParam('cpf', 'CPF do cliente', '00000000000')],
        responses: jsonResponse,
      },
    },
    '/atendimentos/num-venda/{numVenda}': {
      get: {
        tags: ['Atendimentos'],
        summary: 'Busca atendimentos por número da venda',
        parameters: [pathParam('numVenda', 'Número da venda', '12345')],
        responses: jsonResponse,
      },
    },
    '/atendimentos/protocolo/{protocolo}': {
      get: {
        tags: ['Atendimentos'],
        summary: 'Busca atendimentos por protocolo',
        parameters: [pathParam('protocolo', 'Número do protocolo', 'PROT-001')],
        responses: jsonResponse,
      },
    },
    '/atendimentos': {
      post: {
        tags: ['Atendimentos'],
        summary: 'Cria atendimento',
        requestBody: genericRequestBody,
        responses: jsonResponse,
      },
    },
    '/relatorios/ficha-financeira': {
      get: {
        tags: ['Relatorios'],
        summary: 'Relatório de ficha financeira',
        responses: jsonResponse,
      },
    },
  },
};

module.exports = swaggerSpec;
