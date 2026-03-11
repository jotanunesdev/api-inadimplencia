import { env } from '../config/env';
import { GRAPH_DEFAULT_PAGE_SIZE, GRAPH_USER_SELECT } from '../config/graph';
import { graphClient } from '../clients/graphClient';
import type {
  FindUserByUsernameQuery,
  GraphPaginatedResponse,
  GraphUser,
  ListUsersQuery,
  M365UserResponse,
} from '../types/graph';
import { buildUsernameLookupFilter, buildUsersFilter } from '../utils/filter';
import { buildGraphUrl } from '../utils/graphUrl';
import { logger } from '../utils/logger';
import { mapWithConcurrency } from '../utils/concurrency';
import { getUserPhotoById } from './photoService';
import { AppError } from '../types/errors';

function normalizeGraphUser(user: GraphUser): M365UserResponse {
  return {
    id: user.id,
    displayName: user.displayName ?? null,
    givenName: user.givenName ?? null,
    surname: user.surname ?? null,
    mail: user.mail ?? null,
    userPrincipalName: user.userPrincipalName ?? null,
    jobTitle: user.jobTitle ?? null,
    department: user.department ?? null,
    officeLocation: user.officeLocation ?? null,
    mobilePhone: user.mobilePhone ?? null,
    businessPhones: Array.isArray(user.businessPhones) ? user.businessPhones : [],
    preferredLanguage: user.preferredLanguage ?? null,
    accountEnabled:
      typeof user.accountEnabled === 'boolean' ? user.accountEnabled : null,
    employeeId: user.employeeId ?? null,
    city: user.city ?? null,
    state: user.state ?? null,
    country: user.country ?? null,
    companyName: user.companyName ?? null,
    photo: null,
  };
}

function normalizeSearchValue(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(user: M365UserResponse, search: string | undefined): boolean {
  const normalizedSearch = normalizeSearchValue(search);

  if (!normalizedSearch) {
    return true;
  }

  const searchableValues = [
    user.displayName,
    user.givenName,
    user.surname,
    user.mail,
    user.userPrincipalName,
    user.jobTitle,
    user.department,
  ];

  return searchableValues.some((value) =>
    normalizeSearchValue(value).includes(normalizedSearch)
  );
}

function extractUsernameCandidate(value: string | null | undefined): string {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.split('@')[0] ?? normalizedValue;
}

function matchesUsername(user: M365UserResponse, username: string): boolean {
  const normalizedUsername = String(username ?? '').trim().toLowerCase();

  if (!normalizedUsername) {
    return false;
  }

  const candidates = [
    extractUsernameCandidate(user.userPrincipalName),
    extractUsernameCandidate(user.mail),
  ].filter(Boolean);

  return candidates.includes(normalizedUsername);
}

export async function listOrganizationUsers(query: ListUsersQuery): Promise<{
  users: M365UserResponse[];
  filter: string | null;
  pagesFetched: number;
  totalAvailable: number;
  totalMatched: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const filter = buildUsersFilter(query);
  const users: M365UserResponse[] = [];
  let pagesFetched = 0;

  let nextUrl = buildGraphUrl(env.GRAPH_BASE_URL, '/users', {
    $select: GRAPH_USER_SELECT,
    $top: GRAPH_DEFAULT_PAGE_SIZE,
    $filter: filter,
  });

  while (nextUrl) {
    const page = await graphClient.getJson<GraphPaginatedResponse<GraphUser>>(nextUrl);
    users.push(...page.value.map(normalizeGraphUser));
    pagesFetched += 1;
    nextUrl = page['@odata.nextLink'] ?? '';
  }

  logger.info('UserService', 'Usuarios carregados do Microsoft Graph.', {
    totalUsers: users.length,
    pagesFetched,
    includePhoto: query.includePhoto,
    filter,
    search: query.search ?? null,
    page: query.page,
    pageSize: query.pageSize,
  });

  const filteredUsers = users.filter((user) => matchesSearch(user, query.search));
  const totalAvailable = users.length;
  const totalMatched = filteredUsers.length;
  const pageSize = query.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const page = Math.min(query.page, totalPages);
  const startIndex = (page - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  if (!query.includePhoto || paginatedUsers.length === 0) {
    return {
      users: paginatedUsers,
      filter: filter ?? null,
      pagesFetched,
      totalAvailable,
      totalMatched,
      page,
      pageSize,
      totalPages,
    };
  }

  const usersWithPhotos = await mapWithConcurrency(
    paginatedUsers,
    env.PHOTO_CONCURRENCY_LIMIT,
    async (user) => {
      try {
        const photo = await getUserPhotoById(user.id);
        return {
          ...user,
          photo,
        };
      } catch (error) {
        logger.warn('UserService', `Falha ao buscar foto do usuario ${user.id}.`, error);
        return user;
      }
    }
  );

  return {
    users: usersWithPhotos,
    filter: filter ?? null,
    pagesFetched,
    totalAvailable,
    totalMatched,
    page,
    pageSize,
    totalPages,
  };
}

export async function findOrganizationUserByUsername(
  username: string,
  query: FindUserByUsernameQuery
): Promise<{
  user: M365UserResponse;
  filter: string;
}> {
  const normalizedUsername = String(username ?? '').trim().toLowerCase();

  if (!normalizedUsername) {
    throw new AppError(
      400,
      'O username do usuario e obrigatorio.',
      'INVALID_USERNAME'
    );
  }

  const filter = buildUsernameLookupFilter(normalizedUsername);
  const lookupUrl = buildGraphUrl(env.GRAPH_BASE_URL, '/users', {
    $select: GRAPH_USER_SELECT,
    $top: 25,
    $filter: filter,
  });

  const page =
    await graphClient.getJson<GraphPaginatedResponse<GraphUser>>(lookupUrl);
  const candidates = page.value.map(normalizeGraphUser);
  const matchedUser =
    candidates.find((user) => matchesUsername(user, normalizedUsername)) ??
    candidates[0];

  if (!matchedUser) {
    throw new AppError(
      404,
      'Usuario nao encontrado no Microsoft 365 para o username informado.',
      'M365_USER_NOT_FOUND'
    );
  }

  if (!query.includePhoto) {
    return {
      user: matchedUser,
      filter,
    };
  }

  try {
    const photo =
      (await getUserPhotoById(matchedUser.userPrincipalName ?? matchedUser.id)) ??
      null;

    return {
      user: {
        ...matchedUser,
        photo,
      },
      filter,
    };
  } catch (error) {
    logger.warn(
      'UserService',
      `Falha ao buscar foto do usuario ${matchedUser.id} durante lookup.`,
      error
    );

    return {
      user: matchedUser,
      filter,
    };
  }
}
