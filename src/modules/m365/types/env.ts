export interface M365Env {
  PORT: number;
  CORS_ORIGIN: string;
  CORS_ORIGINS: string[];
  CORS_ALLOW_ALL: boolean;
  AZURE_TENANT_ID: string;
  AZURE_CLIENT_ID: string;
  AZURE_CLIENT_SECRET: string;
  GRAPH_BASE_URL: string;
  GRAPH_SCOPE: string;
  HTTP_TIMEOUT_MS: number;
  PHOTO_CONCURRENCY_LIMIT: number;
  TOKEN_CACHE_BUFFER_MS: number;
  missingRequired: string[];
  isConfigured: boolean;
}
