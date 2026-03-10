"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
class AuthController {
    service;
    constructor(service) {
        this.service = service;
    }
    login = async (req, res) => {
        const result = await this.service.login(req.body);
        return res.json(result);
    };
}
exports.AuthController = AuthController;
