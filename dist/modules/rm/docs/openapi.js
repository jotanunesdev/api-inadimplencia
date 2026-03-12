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
        title: 'API RM',
        version: '1.0.0',
        description: 'Modulo de integracao com o RM via WSDataServer, com suporte a GetSchema, ReadView, ReadRecord e SaveRecord.',
    },
    servers: [{ url: '/' }],
    tags: [
        { name: 'Health', description: 'Health checks do modulo RM' },
        { name: 'RM', description: 'Operacoes genericas de integracao com o RM' },
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
    },
};
exports.default = openapi;
