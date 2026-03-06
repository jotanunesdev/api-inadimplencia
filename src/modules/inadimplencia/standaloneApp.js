const express = require('express');
const legacyApp = require('./legacyApp');
const { createInadimplenciaModule } = require('./index');

function createStandaloneApp() {
  const app = express();
  const inadimplenciaModule = createInadimplenciaModule();

  app.use(express.json({ limit: '10mb' }));
  app.use('/inadimplencia', inadimplenciaModule.router);
  app.use('/', legacyApp);

  return app;
}

module.exports = {
  createStandaloneApp,
};
