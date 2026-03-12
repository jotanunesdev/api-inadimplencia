export interface RmEnv {
  PORT: number;
  CORS_ORIGIN: string;
  CORS_ORIGINS: string[];
  CORS_ALLOW_ALL: boolean;
  DB_TRUST_CERT: boolean;
  READVIEW_URL: string;
  READVIEW_USER: string;
  READVIEW_PASSWORD: string;
  READVIEW_ACTION: string;
  READVIEW_NAMESPACE: string;
  GETSCHEMA_ACTION?: string;
  READRECORD_ACTION?: string;
  SAVERECORD_ACTION?: string;
  missingRequired: string[];
  isConfigured: boolean;
}
