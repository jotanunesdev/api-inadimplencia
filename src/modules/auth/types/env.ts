export interface AuthEnv {
  PORT: number;
  CORS_ORIGIN: string;
  CORS_ORIGINS: string[];
  CORS_ALLOW_ALL: boolean;
  LDAP_URL: string;
  LDAP_BASE_DN: string;
  LDAP_USERS_OU?: string;
  LDAP_BIND_USER: string;
  LDAP_BIND_PASSWORD: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  missingRequired: string[];
  isConfigured: boolean;
}
