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
function buildLookupGet(summary) {
    return {
        tags: ['EntradaNotaFiscal'],
        summary,
        responses: {
            '200': { description: 'Lookup retornado com sucesso', content: jsonContent },
            '400': errorResponse,
            '502': errorResponse,
            '500': errorResponse,
        },
    };
}
const openapi = {
    openapi: '3.0.3',
    info: {
        title: 'API Entrada de Nota Fiscal',
        version: '1.0.0',
        description: 'Modulo para cadastro, validacao, armazenamento e submissao de Entrada de Nota Fiscal com persistencia propria.',
    },
    servers: [{ url: '/' }],
    tags: [
        { name: 'Health', description: 'Health checks do modulo Entrada de Nota Fiscal' },
        { name: 'EntradaNotaFiscal', description: 'Cadastro e operacao da Entrada de Nota Fiscal' },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check do modulo Entrada de Nota Fiscal',
                responses: {
                    '200': { description: 'Modulo configurado e pronto', content: jsonContent },
                    '503': { description: 'Modulo sem configuracao ou com erro de inicializacao', content: jsonContent },
                },
            },
        },
        '/metadata': {
            get: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Retorna metadata do formulario',
                responses: {
                    '200': { description: 'Metadata retornada com sucesso', content: jsonContent },
                },
            },
        },
        '/lookups/filiais': { get: buildLookupGet('Lista filiais para o formulario') },
        '/lookups/fornecedores': { get: buildLookupGet('Lista fornecedores para o formulario') },
        '/lookups/movimentos': { get: buildLookupGet('Lista movimentos para o formulario') },
        '/lookups/param-movimento': {
            get: buildLookupGet('Retorna os parametros do movimento selecionado'),
        },
        '/lookups/series': { get: buildLookupGet('Lista series para o formulario') },
        '/lookups/locais-estoque': {
            get: buildLookupGet('Lista locais de estoque para o formulario'),
        },
        '/lookups/naturezas-fiscais': {
            get: buildLookupGet('Lista naturezas fiscais para o formulario'),
        },
        '/lookups/condicoes-pagamento': {
            get: buildLookupGet('Lista condicoes de pagamento para o formulario'),
        },
        '/lookups/parcelamento': {
            get: buildLookupGet('Gera o parcelamento financeiro para o formulario'),
        },
        '/lookups/centros-custo': {
            get: buildLookupGet('Lista centros de custo para o formulario'),
        },
        '/lookups/formas-pagamento': {
            get: buildLookupGet('Lista formas de pagamento para o formulario'),
        },
        '/lookups/tax-rates': {
            get: buildLookupGet('Lista as aliquotas de tributos dos itens importados'),
        },
        '/lookups/purchase-orders': {
            get: buildLookupGet('Lista ordens de compra para o formulario'),
        },
        '/lookups/purchase-order-items': {
            get: buildLookupGet('Lista itens das ordens de compra selecionadas'),
        },
        '/lookups/purchase-order-apportionments': {
            get: buildLookupGet('Lista rateios das ordens de compra selecionadas'),
        },
        '/entries': {
            get: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Lista entradas de nota fiscal com paginacao',
                responses: { '200': { description: 'Lista retornada com sucesso', content: jsonContent } },
            },
            post: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Cria uma nova entrada de nota fiscal',
                requestBody: { required: true, content: jsonContent },
                responses: {
                    '201': { description: 'Registro criado com sucesso', content: jsonContent },
                    '400': errorResponse,
                    '409': errorResponse,
                    '500': errorResponse,
                },
            },
        },
        '/entries/{entryId}': {
            get: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Retorna o detalhe de uma entrada de nota fiscal',
                responses: {
                    '200': { description: 'Registro retornado com sucesso', content: jsonContent },
                    '404': errorResponse,
                    '500': errorResponse,
                },
            },
            put: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Atualiza uma entrada de nota fiscal',
                requestBody: { required: true, content: jsonContent },
                responses: {
                    '200': { description: 'Registro atualizado com sucesso', content: jsonContent },
                    '400': errorResponse,
                    '404': errorResponse,
                    '409': errorResponse,
                    '500': errorResponse,
                },
            },
            delete: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Exclui logicamente uma entrada de nota fiscal',
                responses: {
                    '204': { description: 'Registro excluido com sucesso' },
                    '404': errorResponse,
                    '500': errorResponse,
                },
            },
        },
        '/entries/{entryId}/submit': {
            post: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Valida e envia uma nota para analise fiscal',
                requestBody: { required: false, content: jsonContent },
                responses: {
                    '200': { description: 'Registro submetido com sucesso', content: jsonContent },
                    '400': errorResponse,
                    '404': errorResponse,
                    '409': errorResponse,
                    '500': errorResponse,
                },
            },
        },
        '/entries/{entryId}/approve': {
            post: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Aprova a nota pendente e integra o movimento no RM',
                requestBody: { required: false, content: jsonContent },
                responses: {
                    '200': { description: 'Registro aprovado com sucesso', content: jsonContent },
                    '400': errorResponse,
                    '404': errorResponse,
                    '409': errorResponse,
                    '502': errorResponse,
                    '500': errorResponse,
                },
            },
        },
        '/entries/{entryId}/reject': {
            post: {
                tags: ['EntradaNotaFiscal'],
                summary: 'Reprova a nota pendente de analise',
                requestBody: { required: false, content: jsonContent },
                responses: {
                    '200': { description: 'Registro reprovado com sucesso', content: jsonContent },
                    '400': errorResponse,
                    '404': errorResponse,
                    '409': errorResponse,
                    '500': errorResponse,
                },
            },
        },
    },
};
exports.default = openapi;
