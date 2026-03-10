"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdapGateway = void 0;
const env_1 = require("../../config/env");
const errors_1 = require("../../types/errors");
class LdapGateway {
    factory;
    constructor(factory) {
        this.factory = factory;
    }
    extractDomainFromBaseDn(baseDn) {
        const parts = String(baseDn)
            .split(',')
            .map((part) => part.trim())
            .filter((part) => /^DC=/i.test(part))
            .map((part) => part.replace(/^DC=/i, '').trim())
            .filter(Boolean);
        return parts.length > 0 ? parts.join('.') : null;
    }
    buildServiceBindCandidates() {
        const rawUser = env_1.env.LDAP_BIND_USER.trim();
        const candidates = [rawUser];
        const hasExplicitFormat = rawUser.includes('@') || rawUser.includes('\\') || /^CN=|^OU=|^DC=/i.test(rawUser);
        const domain = this.extractDomainFromBaseDn(env_1.env.LDAP_BASE_DN);
        if (!hasExplicitFormat && domain) {
            candidates.push(`${rawUser}@${domain}`);
        }
        return [...new Set(candidates.filter(Boolean))];
    }
    async bindWithCandidates(client, candidates, password, stage) {
        let lastError;
        for (const candidate of candidates) {
            try {
                await this.bind(client, candidate, password);
                return candidate;
            }
            catch (error) {
                lastError = error;
            }
        }
        if (stage === 'user') {
            throw new errors_1.AppError(401, 'Usuario ou senha invalidos', 'INVALID_CREDENTIALS');
        }
        throw new errors_1.AppError(502, 'Falha ao autenticar a conta de servico no LDAP.', 'LDAP_SERVICE_BIND_FAILED', {
            attemptedCandidates: candidates,
            lastErrorCode: typeof lastError === 'object' && lastError && 'code' in lastError
                ? lastError.code
                : undefined,
            lastErrorMessage: typeof lastError === 'object' && lastError && 'message' in lastError
                ? lastError.message
                : String(lastError ?? ''),
        });
    }
    searchEntryToObject(searchEntry) {
        const entry = {};
        if (searchEntry.objectName) {
            entry.distinguishedName = searchEntry.objectName;
        }
        for (const attr of searchEntry.attributes) {
            const values = Array.isArray(attr.values) ? attr.values : [attr.values];
            entry[attr.type] = values.length <= 1 ? values[0] : values;
        }
        return entry;
    }
    bind(client, dnOrUser, password) {
        return new Promise((resolve, reject) => {
            client.bind(dnOrUser, password, (error) => (error ? reject(error) : resolve()));
        });
    }
    unbind(client) {
        return new Promise((resolve) => client.unbind(() => resolve()));
    }
    searchOne(client, baseDn, options) {
        return new Promise((resolve, reject) => {
            client.search(baseDn, options, (error, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                let entry = null;
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
    escapeLdapFilter(value) {
        return value
            .replace(/\\/g, '\\5c')
            .replace(/\*/g, '\\2a')
            .replace(/\(/g, '\\28')
            .replace(/\)/g, '\\29')
            .replace(/\0/g, '\\00');
    }
    async authenticateBySamAccountName(username, password) {
        const client = this.factory.create();
        try {
            await this.bindWithCandidates(client, this.buildServiceBindCandidates(), env_1.env.LDAP_BIND_PASSWORD, 'service');
            const baseDn = env_1.env.LDAP_USERS_OU || env_1.env.LDAP_BASE_DN;
            const filter = `(&(objectClass=user)(sAMAccountName=${this.escapeLdapFilter(username)}))`;
            let found = null;
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
            }
            catch (error) {
                throw new errors_1.AppError(502, 'Falha ao consultar o LDAP.', 'LDAP_SEARCH_FAILED', {
                    baseDn,
                    username,
                    error: typeof error === 'object' && error && 'message' in error
                        ? error.message
                        : String(error),
                });
            }
            if (!found?.distinguishedName || typeof found.distinguishedName !== 'string') {
                throw new errors_1.AppError(401, 'Usuario ou senha invalidos', 'INVALID_CREDENTIALS');
            }
            await this.unbind(client);
            const userClient = this.factory.create();
            try {
                await this.bindWithCandidates(userClient, [found.distinguishedName], password, 'user');
                return {
                    distinguishedName: found.distinguishedName,
                    sAMAccountName: found.sAMAccountName,
                    userPrincipalName: found.userPrincipalName,
                    displayName: found.displayName,
                    mail: found.mail,
                    department: found.department,
                    title: found.title,
                    company: found.company,
                    memberOf: found.memberOf,
                    employeeID: found.employeeID,
                    manager: found.manager,
                };
            }
            finally {
                await this.unbind(userClient).catch(() => undefined);
            }
        }
        finally {
            await this.unbind(client).catch(() => undefined);
        }
    }
}
exports.LdapGateway = LdapGateway;
