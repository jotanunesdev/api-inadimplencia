"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStandaloneApp = createStandaloneApp;
const express_1 = __importDefault(require("express"));
const app_1 = __importDefault(require("./app"));
const { createTreinamentoModule } = require("./index");
async function createStandaloneApp() {
    const root = (0, express_1.default)();
    const treinamentoModule = await createTreinamentoModule();
    root.use(express_1.default.json({ limit: "10mb" }));
    root.use("/treinamento", treinamentoModule.router);
    root.use("/", app_1.default);
    return root;
}
