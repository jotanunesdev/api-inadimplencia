const API_TITLE = 'API JotaNunes Construtora';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function prefixedPath(prefix, pathName) {
  if (!pathName.startsWith('/')) {
    return `${prefix}/${pathName}`;
  }
  return `${prefix}${pathName}`;
}

function uniqueTags(tags) {
  return (tags ?? []).filter(
    (tag, index, arr) => arr.findIndex((item) => item.name === tag.name) === index
  );
}

function stripPrefixFromPaths(paths, prefix) {
  const result = {};

  Object.entries(paths).forEach(([pathName, definition]) => {
    let modulePath = pathName;

    if (pathName === prefix) {
      modulePath = '/';
    } else if (pathName.startsWith(`${prefix}/`)) {
      modulePath = pathName.slice(prefix.length);
      if (!modulePath) {
        modulePath = '/';
      }
    }

    result[modulePath] = clone(definition);
  });

  return result;
}

function buildInadimplenciaPaths(openapi) {
  const sourcePaths = openapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/inadimplencia/health'
        : pathName.startsWith('/inadimplencia')
        ? pathName
        : prefixedPath('/inadimplencia', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  if (!targetPaths['/inadimplencia/responsavel/{nome}']) {
    targetPaths['/inadimplencia/responsavel/{nome}'] = {
      get: {
        tags: ['Inadimplencia'],
        summary: 'Busca inadimplencia por responsavel',
        parameters: [
          {
            name: 'nome',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'joao',
          },
        ],
        responses: {
          '200': {
            description: 'Sucesso',
          },
        },
      },
    };
  }

  return targetPaths;
}

function normalizeTreinamentoPath(pathName) {
  if (pathName === '/api') {
    return '/';
  }
  if (pathName.startsWith('/api/')) {
    return pathName.slice(4);
  }
  return pathName;
}

function addDefaultTreinamentoTag(definition) {
  const next = clone(definition);
  Object.entries(next).forEach(([method, operation]) => {
    if (method === 'parameters' || method === 'summary' || method === 'description') {
      return;
    }
    if (!operation || typeof operation !== 'object') {
      return;
    }
    if (!Array.isArray(operation.tags) || operation.tags.length === 0) {
      operation.tags = ['Treinamento'];
    }
  });
  return next;
}

function buildTreinamentoExtraPaths(prefix) {
  return {
    [prefixedPath(prefix, '/canais')]: {
      get: {
        tags: ['Treinamento'],
        summary: 'Listar canais',
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Treinamento'],
        summary: 'Criar canal',
        responses: { '201': { description: 'Criado' } },
      },
    },
    [prefixedPath(prefix, '/canais/{id}')]: {
      get: {
        tags: ['Treinamento'],
        summary: 'Detalhe do canal',
        responses: { '200': { description: 'OK' } },
      },
      put: {
        tags: ['Treinamento'],
        summary: 'Atualizar canal',
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        tags: ['Treinamento'],
        summary: 'Excluir canal',
        responses: { '204': { description: 'Sem conteudo' } },
      },
    },
    [prefixedPath(prefix, '/canal-videos')]: {
      get: {
        tags: ['Treinamento'],
        summary: 'Listar videos do canal',
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Treinamento'],
        summary: 'Criar video no canal',
        responses: { '201': { description: 'Criado' } },
      },
    },
    [prefixedPath(prefix, '/canal-videos/{id}')]: {
      get: {
        tags: ['Treinamento'],
        summary: 'Detalhe do video do canal',
        responses: { '200': { description: 'OK' } },
      },
      put: {
        tags: ['Treinamento'],
        summary: 'Atualizar video do canal',
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        tags: ['Treinamento'],
        summary: 'Excluir video do canal',
        responses: { '204': { description: 'Sem conteudo' } },
      },
    },
    [prefixedPath(prefix, '/canal-videos/upload/session')]: {
      post: {
        tags: ['Treinamento'],
        summary: 'Iniciar sessao de upload no SharePoint para canal',
        responses: { '201': { description: 'Criado' } },
      },
    },
    [prefixedPath(prefix, '/canal-videos/upload/session/{sessionId}/complete')]: {
      post: {
        tags: ['Treinamento'],
        summary: 'Finalizar sessao de upload no SharePoint para canal',
        responses: { '200': { description: 'OK' } },
      },
    },
    [prefixedPath(prefix, '/canal-videos/upload')]: {
      post: {
        tags: ['Treinamento'],
        summary: 'Upload de video de canal',
        responses: { '201': { description: 'Criado' } },
      },
    },
    [prefixedPath(prefix, '/canal-videos/{id}/upload')]: {
      put: {
        tags: ['Treinamento'],
        summary: 'Upload de nova versao de video de canal',
        responses: { '200': { description: 'OK' } },
      },
    },
  };
}

function buildTreinamentoPaths(openapi) {
  const sourcePaths = openapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const normalized = normalizeTreinamentoPath(pathName);
    const finalPath = prefixedPath('/treinamento', normalized);
    targetPaths[finalPath] = addDefaultTreinamentoTag(definition);
  });

  const extraPaths = buildTreinamentoExtraPaths('/treinamento');

  return {
    ...extraPaths,
    ...targetPaths,
  };
}

function buildInadimplenciaOpenapi(inadimplenciaOpenapi) {
  const prefixedPaths = buildInadimplenciaPaths(inadimplenciaOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: inadimplenciaOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de inadimplencia.',
    },
    servers: [{ url: '/inadimplencia' }],
    tags: uniqueTags(inadimplenciaOpenapi?.tags ?? []),
    paths: stripPrefixFromPaths(prefixedPaths, '/inadimplencia'),
  };
}

function buildTreinamentoOpenapi(treinamentoOpenapi) {
  const prefixedPaths = buildTreinamentoPaths(treinamentoOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: treinamentoOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de treinamento.',
    },
    servers: [{ url: '/treinamento' }],
    tags: uniqueTags([
      ...(treinamentoOpenapi?.tags ?? []),
      { name: 'Treinamento', description: 'Endpoints do modulo de treinamento' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/treinamento'),
  };
}

function buildUnifiedOpenapi(inadimplenciaOpenapi, treinamentoOpenapi) {
  const inadPaths = buildInadimplenciaPaths(inadimplenciaOpenapi);
  const treinamentoPaths = buildTreinamentoPaths(treinamentoOpenapi);

  const tags = [
    ...(inadimplenciaOpenapi?.tags ?? []),
    { name: 'Treinamento', description: 'Endpoints do modulo de treinamento' },
  ];

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: '1.0.0',
      description: 'API unica com os modulos Inadimplencia e Treinamento.',
    },
    servers: [{ url: '/' }],
    tags: uniqueTags(tags),
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check da API unificada',
          responses: {
            '200': {
              description: 'Sucesso',
            },
          },
        },
      },
      ...inadPaths,
      ...treinamentoPaths,
    },
  };
}

module.exports = {
  buildUnifiedOpenapi,
  buildInadimplenciaOpenapi,
  buildTreinamentoOpenapi,
};
