"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errors_1 = require("../types/errors");
class AuthService {
    ldap;
    constructor(ldap) {
        this.ldap = ldap;
    }
    normalizeGroups(memberOf) {
        if (!memberOf) {
            return [];
        }
        return Array.isArray(memberOf) ? memberOf : [memberOf];
    }
    async login(dto) {
        const { username, password } = dto;
        if (!username?.trim() || !password) {
            throw new errors_1.AppError(400, 'username e password sao obrigatorios', 'INVALID_CREDENTIALS');
        }
        const user = await this.ldap.authenticateBySamAccountName(username.trim(), password);
        const token = jsonwebtoken_1.default.sign({
            sub: user.sAMAccountName,
            name: user.displayName,
            email: user.mail,
        }, env_1.env.JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRES_IN,
        });
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
exports.AuthService = AuthService;
