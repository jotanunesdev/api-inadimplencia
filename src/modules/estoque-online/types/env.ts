export interface EstoqueOnlineEnv {
  PORT: number;
  CORS_ORIGIN: string;
  CORS_ORIGINS: string[];
  CORS_ALLOW_ALL: boolean;
  DB_SERVER: string;
  DB_INSTANCE?: string;
  DB_DATABASE: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_PORT?: number;
  DB_SCHEMA: string;
  DB_TABLE: string;
  DB_ENCRYPT: boolean;
  DB_TRUST_CERT: boolean;
  missingRequired: string[];
  isConfigured: boolean;
}
