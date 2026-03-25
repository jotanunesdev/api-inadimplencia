"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const standaloneApp_1 = require("./standaloneApp");
(0, standaloneApp_1.createStandaloneApp)()
    .then((app) => {
    app.listen(env_1.env.PORT, () => {
        console.log(`API rodando em http://localhost:${env_1.env.PORT}`);
    });
})
    .catch((error) => {
    console.error("Falha ao iniciar o modulo treinamento:", error);
    process.exit(1);
});
