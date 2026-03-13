"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsonContent = {
    'application/json': {
        schema: {
            type: 'object',
            additionalProperties: true,
        },
    },
};
const errorResponse = {
    description: 'Erro',
    content: jsonContent,
};
function buildLookupGet(summary, description) {
    return {
        tags: ['RMEntradaNotaFiscal'],
        summary,
        description,
        responses: {
            '200': {
                description: 'Lookup retornado com sucesso',
                content: jsonContent,
            },
            '400': errorResponse,
            '502': errorResponse,
        },
    };
}
const openapi = {
    openapi: '3.0.3',
    info: {
        title: 'API RM',
        version: '1.0.0',
        description: 'Modulo de integracao com o RM via WSDataServer, com suporte a GetSchema, ReadView, ReadRecord e SaveRecord.',
    },
    servers: [{ url: '/' }],
    tags: [
        { name: 'Health', description: 'Health checks do modulo RM' },
        { name: 'RM', description: 'Operacoes genericas de integracao com o RM' },
        {
            name: 'RMEntradaNotaFiscal',
            description: 'Lookups especializados da Entrada de Nota Fiscal, baseados nas mesmas consultas RM/dataset do formulario Fluig.',
        },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check do modulo RM',
                responses: {
                    '200': {
                        description: 'Modulo configurado',
                        content: jsonContent,
                    },
                    '503': {
                        description: 'Modulo sem configuracao obrigatoria',
                        content: jsonContent,
                    },
                },
            },
        },
        '/rmjotanunes/{dataserver}/partition-options': {
            get: {
                tags: ['RM'],
                summary: 'Infere as melhores opcoes de particionamento a partir do schema do dataserver',
                parameters: [
                    {
                        name: 'dataserver',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                    {
                        name: 'context',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Contexto do RM. Ex.: CODCOLIGADA=1;CODFILIAL=1',
                    },
                ],
                responses: {
                    '200': {
                        description: 'Opcoes de particionamento retornadas com sucesso',
                        content: jsonContent,
                    },
                    '400': errorResponse,
                    '502': errorResponse,
                },
            },
        },
        '/rmjotanunes/{dataserver}/{readvieworreadrecord}': {
            get: {
                tags: ['RM'],
                summary: 'Executa operacao ReadView ou ReadRecord no RM',
                parameters: [
                    {
                        name: 'dataserver',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                    {
                        name: 'readvieworreadrecord',
                        in: 'path',
                        required: true,
                        schema: {
                            type: 'string',
                            enum: ['ReadView', 'ReadRecord', 'SaveRecord'],
                        },
                    },
                    {
                        name: 'context',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                    },
                    {
                        name: 'filter',
                        in: 'query',
                        required: false,
                        schema: { type: 'string' },
                    },
                    {
                        name: 'page',
                        in: 'query',
                        required: false,
                        schema: { type: 'integer', minimum: 1, default: 1 },
                    },
                    {
                        name: 'primaryKey',
                        in: 'query',
                        required: false,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    '200': {
                        description: 'Operacao executada com sucesso',
                        content: jsonContent,
                    },
                    '400': errorResponse,
                    '502': errorResponse,
                },
            },
            post: {
                tags: ['RM'],
                summary: 'Executa ReadView, ReadRecord ou SaveRecord no RM',
                requestBody: {
                    required: false,
                    content: jsonContent,
                },
                responses: {
                    '200': {
                        description: 'Operacao executada com sucesso',
                        content: jsonContent,
                    },
                    '400': errorResponse,
                    '502': errorResponse,
                },
            },
            put: {
                tags: ['RM'],
                summary: 'Executa SaveRecord no RM',
                requestBody: {
                    required: false,
                    content: jsonContent,
                },
                responses: {
                    '200': {
                        description: 'Operacao executada com sucesso',
                        content: jsonContent,
                    },
                    '400': errorResponse,
                    '502': errorResponse,
                },
            },
            patch: {
                tags: ['RM'],
                summary: 'Executa SaveRecord no RM',
                requestBody: {
                    required: false,
                    content: jsonContent,
                },
                responses: {
                    '200': {
                        description: 'Operacao executada com sucesso',
                        content: jsonContent,
                    },
                    '400': errorResponse,
                    '502': errorResponse,
                },
            },
            delete: {
                tags: ['RM'],
                summary: 'Executa SaveRecord no RM com payload customizado',
                requestBody: {
                    required: false,
                    content: jsonContent,
                },
                responses: {
                    '200': {
                        description: 'Operacao executada com sucesso',
                        content: jsonContent,
                    },
                    '400': errorResponse,
                    '502': errorResponse,
                },
            },
        },
        '/entrada-nota-fiscal/lookups/coligadas': {
            get: buildLookupGet('Lista coligadas da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.G.0014 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/filiais': {
            get: buildLookupGet('Lista filiais da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.G.0015 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/fornecedores': {
            get: buildLookupGet('Lista fornecedores da Entrada de Nota Fiscal', 'Replica as consultas FL.DS.ENF.019 e FL.DS.ENF.007 conforme os parametros informados.'),
        },
        '/entrada-nota-fiscal/lookups/movimentos': {
            get: buildLookupGet('Lista movimentos da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.008 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/param-movimento': {
            get: buildLookupGet('Retorna os parametros do movimento', 'Replica a consulta FL.DS.ENF.014 usada para configurar a regra do movimento.'),
        },
        '/entrada-nota-fiscal/lookups/series': {
            get: buildLookupGet('Lista series da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.G.0019 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/locais-estoque': {
            get: buildLookupGet('Lista locais de estoque da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.G.0018 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/naturezas-fiscais': {
            get: buildLookupGet('Lista naturezas fiscais da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.006 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/condicoes-pagamento': {
            get: buildLookupGet('Lista condicoes de pagamento da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.016 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/parcelamento': {
            get: buildLookupGet('Gera o parcelamento financeiro da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.015 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/centros-custo': {
            get: buildLookupGet('Lista centros de custo da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.018 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/formas-pagamento': {
            get: buildLookupGet('Lista formas de pagamento da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.010 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/contas-caixa': {
            get: buildLookupGet('Lista contas caixa da Entrada de Nota Fiscal', 'Replica a consulta FL.DS.ENF.011 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/purchase-orders': {
            get: buildLookupGet('Lista ordens de compra elegiveis para a nota', 'Replica a consulta FL.DS.ENF.001 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/purchase-order-items': {
            get: buildLookupGet('Lista itens das ordens de compra', 'Replica a consulta FL.DS.ENF.002 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/purchase-order-apportionments': {
            get: buildLookupGet('Lista rateios das ordens de compra', 'Replica a consulta FL.DS.ENF.003 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/purchase-order-apportionments/item': {
            get: buildLookupGet('Lista rateios por item da ordem de compra', 'Replica a consulta FL.DS.ENF.003.1 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/taxes': {
            get: buildLookupGet('Lista tributos por movimento', 'Replica a consulta FL.DS.ENF.004 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/tax-rates': {
            get: buildLookupGet('Lista aliquotas de tributos dos itens', 'Replica a consulta FL.DS.ENF.005 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/lancamentos-financeiros': {
            get: buildLookupGet('Lista lancamentos financeiros relacionados', 'Replica a consulta FL.DS.ENF.024 usada no formulario original.'),
        },
        '/entrada-nota-fiscal/lookups/detalhes-tipo-pagamento': {
            get: buildLookupGet('Lista detalhes bancarios por tipo de pagamento', 'Replica a consulta FL.DS.ENF.026 usada no formulario original.'),
        },
    },
};
exports.default = openapi;
