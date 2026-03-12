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

function buildFluigPaths(openapi) {
  const sourcePaths = openapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/smtpfluig/health'
        : pathName.startsWith('/smtpfluig')
        ? pathName
        : prefixedPath('/smtpfluig', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
}

function buildPm2Paths(pm2Openapi) {
  const sourcePaths = pm2Openapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/pm2/health'
        : pathName.startsWith('/pm2')
        ? pathName
        : prefixedPath('/pm2', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
}

function buildM365Paths(m365Openapi) {
  const sourcePaths = m365Openapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/m365/health'
        : pathName.startsWith('/m365')
        ? pathName
        : prefixedPath('/m365', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
}

function buildEstoqueOnlinePaths(estoqueOnlineOpenapi) {
  const sourcePaths = estoqueOnlineOpenapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/estoque-online/health'
        : pathName.startsWith('/estoque-online')
        ? pathName
        : prefixedPath('/estoque-online', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
}

function buildAuthPaths(authOpenapi) {
  const sourcePaths = authOpenapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/auth/health'
        : pathName.startsWith('/auth')
        ? pathName
        : prefixedPath('/auth', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
}

function buildRmPaths(rmOpenapi) {
  const sourcePaths = rmOpenapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/rm/health'
        : pathName.startsWith('/rm')
        ? pathName
        : prefixedPath('/rm', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
}

function buildEntradaNotaFiscalPaths(entradaNotaFiscalOpenapi) {
  const sourcePaths = entradaNotaFiscalOpenapi?.paths ?? {};
  const targetPaths = {};

  Object.entries(sourcePaths).forEach(([pathName, definition]) => {
    const finalPath =
      pathName === '/health'
        ? '/entrada-nota-fiscal/health'
        : pathName.startsWith('/entrada-nota-fiscal')
        ? pathName
        : prefixedPath('/entrada-nota-fiscal', pathName);

    targetPaths[finalPath] = clone(definition);
  });

  return targetPaths;
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

function buildFluigOpenapi(fluigOpenapi) {
  const prefixedPaths = buildFluigPaths(fluigOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: fluigOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de auditoria Fluig.',
    },
    servers: [{ url: '/smtpfluig' }],
    tags: uniqueTags([
      ...(fluigOpenapi?.tags ?? []),
      { name: 'Fluig', description: 'Endpoints do modulo de auditoria Fluig' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/smtpfluig'),
  };
}

function buildPm2Openapi(pm2Openapi) {
  const prefixedPaths = buildPm2Paths(pm2Openapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: pm2Openapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de monitoramento PM2.',
    },
    servers: [{ url: '/pm2' }],
    tags: uniqueTags([
      ...(pm2Openapi?.tags ?? []),
      { name: 'PM2', description: 'Endpoints do modulo de monitoramento PM2' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/pm2'),
  };
}

function buildM365Openapi(m365Openapi) {
  const prefixedPaths = buildM365Paths(m365Openapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: m365Openapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo Microsoft 365 / Microsoft Graph.',
    },
    servers: [{ url: '/m365' }],
    tags: uniqueTags([
      ...(m365Openapi?.tags ?? []),
      { name: 'M365', description: 'Endpoints do modulo Microsoft 365' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/m365'),
  };
}

function buildEstoqueOnlineOpenapi(estoqueOnlineOpenapi) {
  const prefixedPaths = buildEstoqueOnlinePaths(estoqueOnlineOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: estoqueOnlineOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de estoque online.',
    },
    servers: [{ url: '/estoque-online' }],
    tags: uniqueTags([
      ...(estoqueOnlineOpenapi?.tags ?? []),
      { name: 'EstoqueOnline', description: 'Endpoints do modulo de estoque online' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/estoque-online'),
  };
}

function buildAuthOpenapi(authOpenapi) {
  const prefixedPaths = buildAuthPaths(authOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: authOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de autenticacao LDAP/JWT.',
    },
    servers: [{ url: '/auth' }],
    tags: uniqueTags([
      ...(authOpenapi?.tags ?? []),
      { name: 'Auth', description: 'Endpoints do modulo de autenticacao' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/auth'),
  };
}

function buildRmOpenapi(rmOpenapi) {
  const prefixedPaths = buildRmPaths(rmOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: rmOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo de integracao RM.',
    },
    servers: [{ url: '/rm' }],
    tags: uniqueTags([
      ...(rmOpenapi?.tags ?? []),
      { name: 'RM', description: 'Endpoints do modulo de integracao RM' },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/rm'),
  };
}

function buildEntradaNotaFiscalOpenapi(entradaNotaFiscalOpenapi) {
  const prefixedPaths = buildEntradaNotaFiscalPaths(entradaNotaFiscalOpenapi);

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: entradaNotaFiscalOpenapi?.info?.version ?? '1.0.0',
      description: 'Documentacao do modulo Entrada de Nota Fiscal.',
    },
    servers: [{ url: '/entrada-nota-fiscal' }],
    tags: uniqueTags([
      ...(entradaNotaFiscalOpenapi?.tags ?? []),
      {
        name: 'EntradaNotaFiscal',
        description: 'Endpoints do modulo Entrada de Nota Fiscal',
      },
    ]),
    paths: stripPrefixFromPaths(prefixedPaths, '/entrada-nota-fiscal'),
  };
}

function buildUnifiedOpenapi(
  inadimplenciaOpenapi,
  treinamentoOpenapi,
  fluigOpenapi,
  pm2Openapi,
  m365Openapi,
  estoqueOnlineOpenapi,
  authOpenapi,
  rmOpenapi,
  entradaNotaFiscalOpenapi
) {
  const inadPaths = buildInadimplenciaPaths(inadimplenciaOpenapi);
  const treinamentoPaths = buildTreinamentoPaths(treinamentoOpenapi);
  const fluigPaths = buildFluigPaths(fluigOpenapi);
  const pm2Paths = buildPm2Paths(pm2Openapi);
  const m365Paths = buildM365Paths(m365Openapi);
  const estoqueOnlinePaths = buildEstoqueOnlinePaths(estoqueOnlineOpenapi);
  const authPaths = buildAuthPaths(authOpenapi);
  const rmPaths = buildRmPaths(rmOpenapi);
  const entradaNotaFiscalPaths = buildEntradaNotaFiscalPaths(entradaNotaFiscalOpenapi);

  const tags = [
    ...(inadimplenciaOpenapi?.tags ?? []),
    { name: 'Treinamento', description: 'Endpoints do modulo de treinamento' },
    { name: 'Fluig', description: 'Endpoints do modulo de auditoria Fluig' },
    { name: 'PM2', description: 'Endpoints do modulo de monitoramento PM2' },
    { name: 'M365', description: 'Endpoints do modulo Microsoft 365' },
    { name: 'EstoqueOnline', description: 'Endpoints do modulo de estoque online' },
    { name: 'Auth', description: 'Endpoints do modulo de autenticacao' },
    { name: 'RM', description: 'Endpoints do modulo de integracao RM' },
    { name: 'EntradaNotaFiscal', description: 'Endpoints do modulo Entrada de Nota Fiscal' },
  ];

  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: '1.0.0',
      description:
        'API unica com os modulos Inadimplencia, Treinamento, Fluig, PM2 e M365.',
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
      ...fluigPaths,
      ...pm2Paths,
      ...m365Paths,
      ...estoqueOnlinePaths,
      ...authPaths,
      ...rmPaths,
      ...entradaNotaFiscalPaths,
    },
  };
}

module.exports = {
  buildUnifiedOpenapi,
  buildInadimplenciaOpenapi,
  buildTreinamentoOpenapi,
  buildFluigOpenapi,
  buildPm2Openapi,
  buildM365Openapi,
  buildEstoqueOnlineOpenapi,
  buildAuthOpenapi,
  buildRmOpenapi,
  buildEntradaNotaFiscalOpenapi,
};
