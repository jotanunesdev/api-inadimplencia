"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdapClientFactory = void 0;
const ldapjs_1 = __importDefault(require("ldapjs"));
const env_1 = require("../../config/env");
class LdapClientFactory {
    create() {
        const client = ldapjs_1.default.createClient({
            url: env_1.env.LDAP_URL,
        });
        client.on('error', (error) => {
            console.error('LDAP client error:', error.message);
        });
        return client;
    }
}
exports.LdapClientFactory = LdapClientFactory;
