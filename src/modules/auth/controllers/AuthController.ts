import type { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response): Promise<Response> => {
    const result = await this.service.login(req.body);
    return res.json(result);
  };
}
