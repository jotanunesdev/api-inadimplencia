import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../types/errors';
import type { LoginRequestDTO, LoginResponseDTO } from '../types/auth';
import { LdapGateway } from '../infra/ldap/LdapGateway';

export class AuthService {
  constructor(private readonly ldap: LdapGateway) {}

  private normalizeGroups(memberOf?: string[] | string): string[] {
    if (!memberOf) {
      return [];
    }

    return Array.isArray(memberOf) ? memberOf : [memberOf];
  }

  async login(dto: LoginRequestDTO): Promise<LoginResponseDTO> {
    const { username, password } = dto;

    if (!username?.trim() || !password) {
      throw new AppError(400, 'username e password sao obrigatorios', 'INVALID_CREDENTIALS');
    }

    const user = await this.ldap.authenticateBySamAccountName(username.trim(), password);

    const token = jwt.sign(
      {
        sub: user.sAMAccountName,
        name: user.displayName,
        email: user.mail,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      } as SignOptions
    );

    return {
      token,
      user: {
        username: user.sAMAccountName,
        name: user.displayName,
        email: user.mail,
        department: user.department,
        title: user.title,
        company: user.company,
        groups: this.normalizeGroups(user.memberOf),
      },
    };
  }
}
