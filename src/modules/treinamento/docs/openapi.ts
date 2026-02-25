const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Gestao de Treinamento API",
    version: "1.0.0",
    description: "API para o sistema de treinamentos",
  },
  servers: [{ url: "http://localhost:4000" }],
  paths: {
    "/api/auth/login": {
      post: {
        summary: "Login com CPF e senha",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cpf: { type: "string" },
                  password: { type: "string" },
                },
                required: ["cpf", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Usuario autenticado" },
          "409": { description: "Primeiro acesso" },
        },
      },
    },
    "/api/auth/first-access": {
      post: {
        summary: "Primeiro acesso - valida no ReadView e grava senha",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cpf: { type: "string" },
                  dtNascimento: { type: "string" },
                  password: { type: "string" },
                },
                required: ["cpf", "dtNascimento", "password"],
              },
            },
          },
        },
        responses: { "201": { description: "Usuario criado" } },
      },
    },
    "/api/auth/password/{cpf}": {
      put: {
        summary: "Atualizar senha",
        parameters: [
          {
            name: "cpf",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string" },
                },
                required: ["currentPassword", "newPassword"],
              },
            },
          },
        },
        responses: { "200": { description: "Senha atualizada" } },
      },
    },
    "/api/users/{cpf}": {
      get: {
        summary: "Buscar usuario por CPF",
        parameters: [
          { name: "cpf", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Usuario" } },
      },
    },
    "/api/users/{cpf}/courses": {
      get: {
        summary: "Cursos do usuario",
        parameters: [
          { name: "cpf", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Cursos" } },
      },
    },
    "/api/courses": {
      get: { summary: "Listar cursos", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar curso", responses: { "201": { description: "Criado" } } },
    },
    "/api/courses/{id}": {
      get: {
        summary: "Detalhe do curso",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
      put: { summary: "Atualizar curso", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir curso", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/modules": {
      get: { summary: "Listar modulos (opcional por cpf)", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar modulo", responses: { "201": { description: "Criado" } } },
    },
    "/api/modules/{id}": {
      get: { summary: "Detalhe do modulo", responses: { "200": { description: "OK" } } },
      put: { summary: "Atualizar modulo", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir modulo", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/trilhas": {
      get: { summary: "Listar trilhas (por modulo ou por cpf)", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar trilha", responses: { "201": { description: "Criado" } } },
    },
    "/api/trilhas/{id}": {
      get: { summary: "Detalhe da trilha", responses: { "200": { description: "OK" } } },
      put: { summary: "Atualizar trilha", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir trilha", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/videos": {
      get: { summary: "Listar videos (versao mais recente, opcional por cpf)", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar video", responses: { "201": { description: "Criado" } } },
    },
    "/api/videos/upload": {
      post: { summary: "Upload de video (gera arquivo e registro)", responses: { "201": { description: "Criado" } } },
    },
    "/api/videos/{id}": {
      get: { summary: "Detalhe do video (versao mais recente ou por versao)", responses: { "200": { description: "OK" } } },
      put: { summary: "Atualizar video (gera nova versao)", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir video", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/videos/{id}/upload": {
      put: { summary: "Upload de nova versao do video", responses: { "200": { description: "OK" } } },
    },
    "/api/pdfs": {
      get: { summary: "Listar PDFs (versao mais recente, opcional por cpf)", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar PDF", responses: { "201": { description: "Criado" } } },
    },
    "/api/pdfs/upload": {
      post: { summary: "Upload de PDF (gera arquivo e registro)", responses: { "201": { description: "Criado" } } },
    },
    "/api/pdfs/{id}": {
      get: { summary: "Detalhe do PDF (versao mais recente ou por versao)", responses: { "200": { description: "OK" } } },
      put: { summary: "Atualizar PDF (gera nova versao)", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir PDF", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/pdfs/{id}/upload": {
      put: { summary: "Upload de nova versao do PDF", responses: { "200": { description: "OK" } } },
    },
    "/api/provas": {
      get: { summary: "Listar provas (opcional por cpf)", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar prova", responses: { "201": { description: "Criado" } } },
    },
    "/api/provas/attempts/report": {
      get: {
        summary: "Historico de tentativas de prova (filtros por status e periodo)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/provas/trilha/{trilhaId}/objectiva": {
      get: { summary: "Buscar prova objetiva da trilha (ultima versao ou por versao)", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar ou versionar prova objetiva da trilha", responses: { "201": { description: "Criado" } } },
    },
    "/api/provas/trilha/{trilhaId}/objectiva/player": {
      get: { summary: "Buscar prova objetiva para o aluno (sem gabarito)", responses: { "200": { description: "OK" } } },
    },
    "/api/provas/trilha/{trilhaId}/objectiva/player/submit": {
      post: { summary: "Enviar respostas da prova objetiva e calcular nota/status", responses: { "201": { description: "Criado" } } },
    },
    "/api/provas/trilha/{trilhaId}/objectiva/player/result": {
      get: { summary: "Ultimo resultado da prova objetiva do aluno na trilha", responses: { "200": { description: "OK" } } },
    },
    "/api/provas/upload": {
      post: { summary: "Upload de prova (gera arquivo e registro)", responses: { "201": { description: "Criado" } } },
    },
    "/api/provas/{id}": {
      get: { summary: "Detalhe da prova", responses: { "200": { description: "OK" } } },
      put: { summary: "Atualizar prova", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir prova", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/provas/{id}/upload": {
      put: { summary: "Upload de nova versao da prova", responses: { "200": { description: "OK" } } },
    },
    "/api/training-matrix": {
      get: { summary: "Listar matriz", responses: { "200": { description: "OK" } } },
      post: { summary: "Criar matriz", responses: { "201": { description: "Criado" } } },
    },
    "/api/training-matrix/{id}": {
      get: { summary: "Detalhe matriz", responses: { "200": { description: "OK" } } },
      put: { summary: "Atualizar matriz", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir matriz", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/user-courses": {
      post: { summary: "Associar curso ao usuario", responses: { "201": { description: "Criado" } } },
    },
    "/api/user-courses/{id}": {
      put: { summary: "Atualizar curso do usuario", responses: { "200": { description: "OK" } } },
      delete: { summary: "Excluir curso do usuario", responses: { "204": { description: "Sem conteudo" } } },
    },
    "/api/user-trainings": {
      post: { summary: "Registrar treinamentos (presenca)", responses: { "201": { description: "Criado" } } },
    },
    "/api/user-trilhas": {
      post: { summary: "Atribuir trilhas a usuario", responses: { "201": { description: "Criado" } } },
    },
    "/api/user-trilhas/{cpf}": {
      get: { summary: "Listar trilhas atribuidas ao usuario", responses: { "200": { description: "OK" } } },
    },
    "/api/user-trilhas/{cpf}/{trilhaId}": {
      delete: { summary: "Remover trilha atribuida ao usuario", responses: { "204": { description: "Sem conteudo" } } },
    },
  },
}

export default openapi
