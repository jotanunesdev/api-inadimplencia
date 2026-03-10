import type { Client, SearchEntry, SearchOptions } from 'ldapjs';
import { env } from '../../config/env';
import { AppError } from '../../types/errors';
import type { LdapUser } from './LdapTypes';
import { LdapClientFactory } from './LdapClientFactory';

export class LdapGateway {
  constructor(private readonly factory: LdapClientFactory) {}

  private extractDomainFromBaseDn(baseDn: string): string | null {
    const parts = String(baseDn)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => /^DC=/i.test(part))
      .map((part) => part.replace(/^DC=/i, '').trim())
      .filter(Boolean);

    return parts.length > 0 ? parts.join('.') : null;
  }

  private buildServiceBindCandidates(): string[] {
    const rawUser = env.LDAP_BIND_USER.trim();
    const candidates = [rawUser];

    const hasExplicitFormat =
      rawUser.includes('@') || rawUser.includes('\\') || /^CN=|^OU=|^DC=/i.test(rawUser);
    const domain = this.extractDomainFromBaseDn(env.LDAP_BASE_DN);

    if (!hasExplicitFormat && domain) {
      candidates.push(`${rawUser}@${domain}`);
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  private async bindWithCandidates(
    client: Client,
    candidates: string[],
    password: string,
    stage: 'service' | 'user'
  ): Promise<string> {
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        await this.bind(client, candidate, password);
        return candidate;
      } catch (error) {
        lastError = error;
      }
    }

    if (stage === 'user') {
      throw new AppError(401, 'Usuario ou senha invalidos', 'INVALID_CREDENTIALS');
    }

    throw new AppError(
      502,
      'Falha ao autenticar a conta de servico no LDAP.',
      'LDAP_SERVICE_BIND_FAILED',
      {
        attemptedCandidates: candidates,
        lastErrorCode:
          typeof lastError === 'object' && lastError && 'code' in lastError
            ? lastError.code
            : undefined,
        lastErrorMessage:
          typeof lastError === 'object' && lastError && 'message' in lastError
            ? lastError.message
            : String(lastError ?? ''),
      }
    );
  }

  private searchEntryToObject(searchEntry: SearchEntry): Record<string, unknown> {
    const entry: Record<string, unknown> = {};

    if (searchEntry.objectName) {
      entry.distinguishedName = searchEntry.objectName;
    }

    for (const attr of searchEntry.attributes) {
      const values = Array.isArray(attr.values) ? attr.values : [attr.values];
      entry[attr.type] = values.length <= 1 ? values[0] : values;
    }

    return entry;
  }

  private bind(client: Client, dnOrUser: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(dnOrUser, password, (error) => (error ? reject(error) : resolve()));
    });
  }

  private unbind(client: Client): Promise<void> {
    return new Promise((resolve) => client.unbind(() => resolve()));
  }

  private searchOne(
    client: Client,
    baseDn: string,
    options: SearchOptions
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve, reject) => {
      client.search(baseDn, options, (error, response) => {
        if (error) {
          reject(error);
          return;
        }

        let entry: Record<string, unknown> | null = null;

        response.on('searchEntry', (value) => {
          if (!entry) {
            entry = this.searchEntryToObject(value);
          }
        });

        response.on('error', reject);
        response.on('end', () => resolve(entry));
      });
    });
  }

  escapeLdapFilter(value: string): string {
    return value
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(/\0/g, '\\00');
  }

  async authenticateBySamAccountName(username: string, password: string): Promise<LdapUser> {
    const client = this.factory.create();

    try {
      await this.bindWithCandidates(
        client,
        this.buildServiceBindCandidates(),
        env.LDAP_BIND_PASSWORD,
        'service'
      );

      const baseDn = env.LDAP_USERS_OU || env.LDAP_BASE_DN;
      const filter = `(&(objectClass=user)(sAMAccountName=${this.escapeLdapFilter(
        username
      )}))`;

      let found: Record<string, unknown> | null = null;

      try {
        found = await this.searchOne(client, baseDn, {
          scope: 'sub',
          filter,
          attributes: [
            'distinguishedName',
            'sAMAccountName',
            'userPrincipalName',
            'displayName',
            'mail',
            'department',
            'title',
            'company',
            'memberOf',
            'employeeID',
            'manager',
          ],
          sizeLimit: 1,
        });
      } catch (error) {
        throw new AppError(502, 'Falha ao consultar o LDAP.', 'LDAP_SEARCH_FAILED', {
          baseDn,
          username,
          error:
            typeof error === 'object' && error && 'message' in error
              ? error.message
              : String(error),
        });
      }

      if (!found?.distinguishedName || typeof found.distinguishedName !== 'string') {
        throw new AppError(401, 'Usuario ou senha invalidos', 'INVALID_CREDENTIALS');
      }

      await this.unbind(client);
      const userClient = this.factory.create();

      try {
        await this.bindWithCandidates(userClient, [found.distinguishedName], password, 'user');

        return {
          distinguishedName: found.distinguishedName as string | undefined,
          sAMAccountName: found.sAMAccountName as string | undefined,
          userPrincipalName: found.userPrincipalName as string | undefined,
          displayName: found.displayName as string | undefined,
          mail: found.mail as string | undefined,
          department: found.department as string | undefined,
          title: found.title as string | undefined,
          company: found.company as string | undefined,
          memberOf: found.memberOf as string[] | string | undefined,
          employeeID: found.employeeID as string | undefined,
          manager: found.manager as string | undefined,
        };
      } finally {
        await this.unbind(userClient).catch(() => undefined);
      }
    } finally {
      await this.unbind(client).catch(() => undefined);
    }
  }
}
