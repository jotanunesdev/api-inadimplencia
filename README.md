# API Inadimplencia - Modulo M365

Este repositorio agora possui um modulo `m365` em Node.js + Express + TypeScript para integrar com o Microsoft Graph e listar usuarios da organizacao Microsoft 365/Teams.

## Requisitos

- Node.js 18+
- Tenant ID
- Client ID
- Client Secret
- Permissoes Microsoft Graph com admin consent:
  - `User.Read.All`
  - `ProfilePhoto.Read.All`

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
PORT=3000
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...

M365_PORT=3011
M365_CORS_ORIGIN=http://localhost:5173,https://fluig.jotanunes.com
M365_GRAPH_BASE_URL=https://graph.microsoft.com/v1.0
M365_GRAPH_SCOPE=https://graph.microsoft.com/.default
M365_HTTP_TIMEOUT_MS=15000
M365_PHOTO_CONCURRENCY_LIMIT=5
M365_TOKEN_CACHE_BUFFER_MS=60000
```

## Como executar

```bash
npm install
npm run dev
npm run build
npm start
```

Comandos especificos do modulo:

```bash
npm run dev:m365
npm run start:m365
pm2 start m365
```

## Endpoints

- `GET /health`
- `GET /docs`
- `GET /docs-json`
- `GET /m365/health`
- `GET /m365/users`
- `GET /m365/users/:id/photo`

## Exemplos

### Listar usuarios sem foto

```http
GET /m365/users
```

Resposta:

```json
{
  "success": true,
  "data": [
    {
      "id": "user-id",
      "displayName": "Maria Silva",
      "givenName": "Maria",
      "surname": "Silva",
      "mail": "maria.silva@contoso.com",
      "userPrincipalName": "maria.silva@contoso.com",
      "jobTitle": "Analista",
      "department": "Financeiro",
      "officeLocation": "Sao Paulo",
      "mobilePhone": null,
      "businessPhones": [],
      "preferredLanguage": "pt-BR",
      "accountEnabled": true,
      "employeeId": "12345",
      "city": "Sao Paulo",
      "state": "SP",
      "country": "Brasil",
      "companyName": "Contoso",
      "photo": null
    }
  ],
  "meta": {
    "total": 1,
    "includePhoto": false,
    "filters": {
      "department": null,
      "accountEnabled": null
    },
    "graphFilter": null,
    "pagesFetched": 1,
    "generatedAt": "2026-03-09T00:00:00.000Z"
  }
}
```

### Listar usuarios com filtros e foto

```http
GET /m365/users?includePhoto=true&department=Financeiro&accountEnabled=true
```

### Buscar foto de um usuario

```http
GET /m365/users/user-id/photo
```

Resposta:

```json
{
  "success": true,
  "data": {
    "userId": "user-id",
    "photoBase64": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "contentType": "image/jpeg",
    "fetchedAt": "2026-03-09T00:00:00.000Z"
  }
}
```

## Estrutura

```text
src/
  config/
  clients/
  controllers/
  services/
  routes/
  middlewares/
  types/
  utils/
  docs/
```

Estrutura real do modulo:

```text
src/modules/m365/
  config/
    env.ts
    graph.ts
  clients/
    graphClient.ts
  controllers/
    m365Controller.ts
  services/
    photoService.ts
    tokenService.ts
    userService.ts
  routes/
    index.ts
  middlewares/
    ensureConfigured.ts
    errorHandler.ts
    notFound.ts
    validateListUsersQuery.ts
  types/
    env.ts
    errors.ts
    express.d.ts
    graph.ts
  utils/
    asyncHandler.ts
    base64.ts
    concurrency.ts
    fetchWithTimeout.ts
    filter.ts
    graphUrl.ts
    logger.ts
  docs/
    openapi.ts
  .env
  app.ts
  index.js
  server.ts
```

## Principais arquivos

- `src/modules/m365/config/env.ts`: carrega e valida variaveis de ambiente
- `src/modules/m365/clients/graphClient.ts`: client desacoplado para chamadas ao Graph
- `src/modules/m365/services/tokenService.ts`: token cacheado em memoria via client credentials flow
- `src/modules/m365/services/userService.ts`: listagem paginada via `@odata.nextLink`
- `src/modules/m365/services/photoService.ts`: busca de foto separada com base64
- `src/modules/m365/routes/index.ts`: rotas REST do modulo
- `src/modules/m365/docs/openapi.ts`: Swagger/OpenAPI do modulo
- `src/app.js`: integracao do modulo na API unificada
- `src/docs/unifiedOpenapi.js`: integracao do Swagger unificado

## Observacoes

- O endpoint `/m365/users` usa `$select` nos campos solicitados
- A paginacao segue `@odata.nextLink` ate o fim
- A foto e buscada separadamente e nao derruba a listagem se falhar para um usuario
- O modulo tem cache simples em memoria para token
- O modulo usa limite de concorrencia para busca de fotos
