import { Router } from 'express';
import { LdapClientFactory } from '../infra/ldap/LdapClientFactory';
import { LdapGateway } from '../infra/ldap/LdapGateway';
import { AuthService } from '../services/AuthService';
import { AuthController } from '../controllers/AuthController';
import { ensureConfigured } from '../middlewares/ensureConfigured';

const router = Router();
const ldapFactory = new LdapClientFactory();
const ldapGateway = new LdapGateway(ldapFactory);
const authService = new AuthService(ldapGateway);
const authController = new AuthController(authService);

router.post('/login', ensureConfigured, authController.login);

export default router;
