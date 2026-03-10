import ldap, { Client } from 'ldapjs';
import { env } from '../../config/env';

export class LdapClientFactory {
  create(): Client {
    const client = ldap.createClient({
      url: env.LDAP_URL,
    });

    client.on('error', (error) => {
      console.error('LDAP client error:', error.message);
    });

    return client;
  }
}
