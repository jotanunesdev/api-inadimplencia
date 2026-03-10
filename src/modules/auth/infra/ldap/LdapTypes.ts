export interface LdapUser {
  distinguishedName?: string;
  sAMAccountName?: string;
  userPrincipalName?: string;
  displayName?: string;
  mail?: string;
  department?: string;
  title?: string;
  company?: string;
  memberOf?: string[] | string;
  employeeID?: string;
  manager?: string;
}
