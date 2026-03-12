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
                summary: 'Valida e submete uma entrada de nota fiscal',
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
    },
};
exports.default = openapi;
