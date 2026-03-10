export const GRAPH_DEFAULT_BASE_URL = 'https://graph.microsoft.com/v1.0';
export const GRAPH_DEFAULT_SCOPE = 'https://graph.microsoft.com/.default';
export const GRAPH_DEFAULT_TIMEOUT_MS = 15000;
export const GRAPH_DEFAULT_PHOTO_CONCURRENCY = 5;
export const GRAPH_DEFAULT_TOKEN_BUFFER_MS = 60000;
export const GRAPH_DEFAULT_PAGE_SIZE = 999;

export const GRAPH_USER_SELECT_FIELDS = [
  'id',
  'displayName',
  'givenName',
  'surname',
  'mail',
  'userPrincipalName',
  'jobTitle',
  'department',
  'officeLocation',
  'mobilePhone',
  'businessPhones',
  'preferredLanguage',
  'accountEnabled',
  'employeeId',
  'city',
  'state',
  'country',
  'companyName',
] as const;

export const GRAPH_USER_SELECT = GRAPH_USER_SELECT_FIELDS.join(',');
