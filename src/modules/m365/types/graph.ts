export interface GraphTokenResponse {
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
}

export interface GraphUser {
  id: string;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  businessPhones: string[];
  preferredLanguage: string | null;
  accountEnabled: boolean | null;
  employeeId: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  companyName: string | null;
}

export interface GraphPaginatedResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
  '@odata.context'?: string;
}

export interface GraphErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface M365UserPhoto {
  base64: string;
  contentType: string | null;
}

export interface M365UserResponse extends GraphUser {
  photo: M365UserPhoto | null;
}

export interface ListUsersQuery {
  includePhoto: boolean;
  department?: string;
  accountEnabled?: boolean;
}

export interface FindUserByUsernameQuery {
  includePhoto: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  module: 'm365';
  configured: boolean;
  missingRequired: string[];
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
