"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
app_1.default.listen(env_1.env.PORT, () => {
    logger_1.logger.info('EstoqueOnlineServer', `Modulo Estoque Online rodando na porta ${env_1.env.PORT}.`);
});
