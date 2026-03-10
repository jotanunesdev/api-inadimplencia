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
const openapi = {
    openapi: '3.0.3',
    info: {
        title: 'API Auth',
        version: '1.0.0',
        description: 'Modulo de autenticacao LDAP com emissao de JWT.',
    },
    servers: [{ url: '/' }],
    tags: [
        { name: 'Health', description: 'Health check do modulo Auth' },
        { name: 'Auth', description: 'Autenticacao LDAP/JWT' },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check do modulo Auth',
                responses: {
                    '200': { description: 'OK', content: jsonContent },
                    '503': { description: 'Modulo sem configuracao obrigatoria', content: jsonContent },
                },
            },
        },
        '/login': {
            post: {
                tags: ['Auth'],
                summary: 'Autentica usuario via LDAP e retorna JWT',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    username: { type: 'string', example: 'joao.silva' },
                                    password: { type: 'string', example: 'senha-segura' },
                                },
                                required: ['username', 'password'],
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Autenticado com sucesso', content: jsonContent },
                    '400': { description: 'Parametros invalidos', content: jsonContent },
                    '401': { description: 'Credenciais invalidas', content: jsonContent },
                    '500': { description: 'Modulo nao configurado', content: jsonContent },
                },
            },
        },
    },
};
exports.default = openapi;
