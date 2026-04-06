type OpenApiSchema = Record<string, unknown>
type OpenApiParameter = Record<string, unknown>
type OpenApiRequestBody = Record<string, unknown>
type OpenApiResponse = Record<string, unknown>
type OpenApiResponses = Record<string, OpenApiResponse>
type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

type Endpoint = {
  method: HttpMethod
  path: string
  tag: string
  summary: string
  description?: string
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
  responses?: OpenApiResponses
}

const TAGS = {
  auth: "Autenticacao",
  users: "Usuarios",
  coursesModules: "Cursos e Modulos",
  trilhas: "Trilhas",
  contents: "Conteudos",
  channels: "Canais",
  provas: "Provas Objetivas",
  eficacia: "Avaliacao de Eficacia",
  turmas: "Turmas Coletivas",
  completions: "Conclusoes e Presencas",
  matrix: "Matriz de Treinamento",
  normasProcedimentos: "Normas e Procedimentos",
  notifications: "Notificacoes",
  profile: "Feed do Perfil",
  feedbacks: "Feedbacks",
  reports: "Relatorios",
  dossies: "Dossies",
  sectorFiles: "Gestor de Arquivos por Setor",
  faces: "Reconhecimento Facial",
  audit: "Auditoria de Acesso",
  operational: "Operacional",
}

const ref = (schemaName: string): OpenApiSchema => ({
  $ref: `#/components/schemas/${schemaName}`,
})

const arrayOf = (schema: OpenApiSchema): OpenApiSchema => ({
  type: "array",
  items: schema,
})

const jsonResponse = (description: string, schema?: OpenApiSchema): OpenApiResponse => ({
  description,
  ...(schema
    ? {
        content: {
          "application/json": {
            schema,
          },
        },
      }
    : {}),
})

const binaryResponse = (description: string, contentType = "application/octet-stream") => ({
  description,
  content: {
    [contentType]: {
      schema: { type: "string", format: "binary" },
    },
  },
})

const eventStreamResponse = (description: string): OpenApiResponse => ({
  description,
  content: {
    "text/event-stream": {
      schema: { type: "string" },
    },
  },
})

const errorResponse = (description: string): OpenApiResponse =>
  jsonResponse(description, ref("ErrorResponse"))

const defaultErrorResponses: OpenApiResponses = {
  "400": errorResponse("Requisicao invalida"),
  "500": errorResponse("Erro interno do servidor"),
}

const ok = (schema: OpenApiSchema = ref("GenericObject")) =>
  jsonResponse("Operacao realizada com sucesso", schema)

const created = (schema: OpenApiSchema = ref("GenericObject")) =>
  jsonResponse("Registro criado", schema)

const noContent = () => jsonResponse("Sem conteudo")

const pathParam = (
  name: string,
  description: string,
  schema: OpenApiSchema = { type: "string" },
): OpenApiParameter => ({
  name,
  in: "path",
  required: true,
  description,
  schema,
})

const queryParam = (
  name: string,
  description: string,
  schema: OpenApiSchema = { type: "string" },
  required = false,
): OpenApiParameter => ({
  name,
  in: "query",
  required,
  description,
  schema,
})

const jsonBody = (schema: OpenApiSchema = ref("GenericObject"), required = true) => ({
  required,
  content: {
    "application/json": {
      schema,
    },
  },
})

const multipartBody = (properties: Record<string, OpenApiSchema>, required = ["file"]) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required,
        properties,
      },
    },
  },
})

const idParam = pathParam("id", "Identificador do registro")
const itemIdParam = pathParam("itemId", "Identificador do item")
const cpfParam = pathParam("cpf", "CPF do colaborador", {
  type: "string",
  example: "12345678901",
})
const trilhaIdParam = pathParam("trilhaId", "Identificador da trilha", {
  type: "string",
  format: "uuid",
})
const turmaIdParam = pathParam("turmaId", "Identificador da turma coletiva", {
  type: "string",
  format: "uuid",
})
const tokenParam = pathParam("token", "Token do QR Code")
const sessionIdParam = pathParam("sessionId", "Identificador da sessao de upload")
const cpfQuery = queryParam("cpf", "CPF do colaborador", {
  type: "string",
  example: "12345678901",
})
const tokenQuery = queryParam("token", "Token de QR Code de prova individual")
const trilhaIdQuery = queryParam("trilhaId", "Filtra por trilha", {
  type: "string",
  format: "uuid",
})
const moduloIdQuery = queryParam("moduloId", "Filtra por modulo", {
  type: "string",
  format: "uuid",
})
const versaoQuery = queryParam("versao", "Versao do conteudo ou prova", {
  type: "integer",
  minimum: 1,
})

const fileUploadBody = multipartBody({
  file: { type: "string", format: "binary" },
  id: { type: "string", format: "uuid" },
  trilhaId: { type: "string", format: "uuid" },
  metadata: { type: "string", description: "Demais campos aceitos pelo endpoint." },
})

const endpoints: Endpoint[] = [
  {
    method: "get",
    path: "/health",
    tag: TAGS.operational,
    summary: "Health check do modulo treinamento",
    responses: { "200": ok(ref("HealthResponse")) },
  },
  {
    method: "post",
    path: "/api/auth/login",
    tag: TAGS.auth,
    summary: "Login com CPF e senha",
    requestBody: jsonBody(ref("LoginRequest")),
    responses: {
      "200": ok(ref("LoginResponse")),
      "409": errorResponse("Primeiro acesso pendente"),
    },
  },
  {
    method: "post",
    path: "/api/auth/first-access",
    tag: TAGS.auth,
    summary: "Realizar primeiro acesso",
    description: "Valida o colaborador no ReadView e grava a primeira senha.",
    requestBody: jsonBody(ref("FirstAccessRequest")),
    responses: { "201": created() },
  },
  {
    method: "put",
    path: "/api/auth/password/{cpf}",
    tag: TAGS.auth,
    summary: "Atualizar senha do colaborador",
    parameters: [cpfParam],
    requestBody: jsonBody(ref("PasswordUpdateRequest")),
  },
  {
    method: "get",
    path: "/api/users",
    tag: TAGS.users,
    summary: "Listar usuarios cadastrados",
    parameters: [
      queryParam("cpf", "Filtra por CPF"),
      queryParam("nome", "Filtra por nome"),
      queryParam("ativo", "Filtra usuarios ativos", { type: "boolean" }),
      queryParam("instrutor", "Filtra instrutores", { type: "boolean" }),
    ],
  },
  {
    method: "get",
    path: "/api/users/instructors",
    tag: TAGS.users,
    summary: "Listar usuarios instrutores",
  },
  {
    method: "put",
    path: "/api/users/instructors",
    tag: TAGS.users,
    summary: "Atualizar lista de instrutores",
    requestBody: jsonBody(),
  },
  {
    method: "get",
    path: "/api/users/employees",
    tag: TAGS.users,
    summary: "Listar colaboradores da empresa",
    parameters: [
      queryParam("refresh", "Forca atualizacao do cache", { type: "boolean" }),
      queryParam("obra", "Filtra por obra"),
      queryParam("obraCodigo", "Filtra por codigo da obra"),
      queryParam("includeLocation", "Inclui localizacao", { type: "boolean" }),
      queryParam("sectorKey", "Filtra por setor"),
      queryParam("cpf", "Filtra por CPF"),
      queryParam("nome", "Filtra por nome"),
      queryParam("search", "Busca textual"),
    ],
  },
  {
    method: "get",
    path: "/api/users/employees/obras",
    tag: TAGS.users,
    summary: "Listar obras dos colaboradores",
    parameters: [queryParam("refresh", "Forca atualizacao do cache", { type: "boolean" })],
  },
  {
    method: "get",
    path: "/api/users/sections",
    tag: TAGS.users,
    summary: "Listar secoes da empresa",
    parameters: [queryParam("sectorKey", "Filtra por setor")],
  },
  {
    method: "get",
    path: "/api/users/{cpf}",
    tag: TAGS.users,
    summary: "Buscar usuario por CPF",
    parameters: [cpfParam],
  },
  {
    method: "get",
    path: "/api/users/{cpf}/courses",
    tag: TAGS.users,
    summary: "Listar cursos do usuario",
    parameters: [cpfParam],
  },
  {
    method: "get",
    path: "/api/courses",
    tag: TAGS.coursesModules,
    summary: "Listar cursos",
  },
  {
    method: "post",
    path: "/api/courses",
    tag: TAGS.coursesModules,
    summary: "Criar curso",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/courses/{id}",
    tag: TAGS.coursesModules,
    summary: "Detalhar curso",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/courses/{id}",
    tag: TAGS.coursesModules,
    summary: "Atualizar curso",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/courses/{id}",
    tag: TAGS.coursesModules,
    summary: "Excluir curso",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/modules",
    tag: TAGS.coursesModules,
    summary: "Listar modulos",
    parameters: [cpfQuery],
  },
  {
    method: "post",
    path: "/api/modules",
    tag: TAGS.coursesModules,
    summary: "Criar modulo",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/modules/{id}",
    tag: TAGS.coursesModules,
    summary: "Detalhar modulo",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/modules/{id}",
    tag: TAGS.coursesModules,
    summary: "Atualizar modulo",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/modules/{id}",
    tag: TAGS.coursesModules,
    summary: "Excluir modulo",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/trilhas",
    tag: TAGS.trilhas,
    summary: "Listar trilhas por modulo ou usuario",
    parameters: [moduloIdQuery, cpfQuery],
  },
  {
    method: "post",
    path: "/api/trilhas",
    tag: TAGS.trilhas,
    summary: "Criar trilha",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/trilhas/pendencias/eficacia",
    tag: TAGS.trilhas,
    summary: "Listar trilhas pendentes de avaliacao de eficacia pelo RH",
  },
  {
    method: "get",
    path: "/api/trilhas/{id}",
    tag: TAGS.trilhas,
    summary: "Detalhar trilha",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/trilhas/{id}",
    tag: TAGS.trilhas,
    summary: "Atualizar trilha",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/trilhas/{id}",
    tag: TAGS.trilhas,
    summary: "Excluir trilha",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/trilhas/{id}/shares",
    tag: TAGS.trilhas,
    summary: "Listar compartilhamentos da trilha",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/trilhas/{id}/shares",
    tag: TAGS.trilhas,
    summary: "Atualizar compartilhamentos da trilha",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/trilhas/{id}/eficacia",
    tag: TAGS.eficacia,
    summary: "Configurar pergunta de eficacia da trilha",
    parameters: [idParam],
    requestBody: jsonBody(ref("TrilhaEficaciaConfigRequest")),
  },
  {
    method: "delete",
    path: "/api/trilhas/{id}/eficacia",
    tag: TAGS.eficacia,
    summary: "Remover configuracao de eficacia da trilha",
    parameters: [idParam],
  },
  {
    method: "get",
    path: "/api/videos",
    tag: TAGS.contents,
    summary: "Listar videos da trilha",
    parameters: [
      trilhaIdQuery,
      cpfQuery,
      queryParam("includePdf", "Inclui PDFs relacionados", { type: "boolean" }),
    ],
  },
  {
    method: "post",
    path: "/api/videos",
    tag: TAGS.contents,
    summary: "Criar video por caminho de arquivo",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/videos/upload",
    tag: TAGS.contents,
    summary: "Enviar video da trilha",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/videos/{id}",
    tag: TAGS.contents,
    summary: "Detalhar video",
    parameters: [idParam, versaoQuery],
  },
  {
    method: "put",
    path: "/api/videos/{id}",
    tag: TAGS.contents,
    summary: "Atualizar video e gerar nova versao",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/videos/{id}/order",
    tag: TAGS.contents,
    summary: "Atualizar ordem do video na trilha",
    parameters: [idParam],
    requestBody: jsonBody(ref("OrderRequest")),
  },
  {
    method: "put",
    path: "/api/videos/{id}/upload",
    tag: TAGS.contents,
    summary: "Enviar nova versao do video",
    parameters: [idParam],
    requestBody: fileUploadBody,
  },
  {
    method: "delete",
    path: "/api/videos/{id}",
    tag: TAGS.contents,
    summary: "Excluir video",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/pdfs",
    tag: TAGS.contents,
    summary: "Listar PDFs da trilha",
    parameters: [trilhaIdQuery, cpfQuery],
  },
  {
    method: "post",
    path: "/api/pdfs",
    tag: TAGS.contents,
    summary: "Criar PDF por caminho de arquivo",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/pdfs/upload",
    tag: TAGS.contents,
    summary: "Enviar PDF da trilha",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/pdfs/{id}",
    tag: TAGS.contents,
    summary: "Detalhar PDF",
    parameters: [idParam, versaoQuery],
  },
  {
    method: "get",
    path: "/api/pdfs/{id}/content",
    tag: TAGS.contents,
    summary: "Baixar conteudo do PDF",
    parameters: [idParam, versaoQuery],
    responses: { "200": binaryResponse("Arquivo PDF", "application/pdf") },
  },
  {
    method: "put",
    path: "/api/pdfs/{id}",
    tag: TAGS.contents,
    summary: "Atualizar PDF e gerar nova versao",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/pdfs/{id}/upload",
    tag: TAGS.contents,
    summary: "Enviar nova versao do PDF",
    parameters: [idParam],
    requestBody: fileUploadBody,
  },
  {
    method: "delete",
    path: "/api/pdfs/{id}",
    tag: TAGS.contents,
    summary: "Excluir PDF",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/canais",
    tag: TAGS.channels,
    summary: "Listar canais",
  },
  {
    method: "post",
    path: "/api/canais",
    tag: TAGS.channels,
    summary: "Criar canal",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/canais/{id}",
    tag: TAGS.channels,
    summary: "Detalhar canal",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/canais/{id}",
    tag: TAGS.channels,
    summary: "Atualizar canal",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/canais/{id}",
    tag: TAGS.channels,
    summary: "Excluir canal",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/canal-videos",
    tag: TAGS.channels,
    summary: "Listar videos de canal",
    parameters: [queryParam("canalId", "Filtra por canal", { type: "string", format: "uuid" })],
  },
  {
    method: "post",
    path: "/api/canal-videos",
    tag: TAGS.channels,
    summary: "Criar video de canal por caminho de arquivo",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/canal-videos/upload/session",
    tag: TAGS.channels,
    summary: "Iniciar sessao de upload de video de canal no SharePoint",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/canal-videos/upload/session/{sessionId}/complete",
    tag: TAGS.channels,
    summary: "Finalizar sessao de upload de video de canal",
    parameters: [sessionIdParam],
    requestBody: jsonBody(ref("GenericObject"), false),
  },
  {
    method: "post",
    path: "/api/canal-videos/upload",
    tag: TAGS.channels,
    summary: "Enviar video de canal",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/canal-videos/{id}",
    tag: TAGS.channels,
    summary: "Detalhar video de canal",
    parameters: [idParam, versaoQuery],
  },
  {
    method: "put",
    path: "/api/canal-videos/{id}",
    tag: TAGS.channels,
    summary: "Atualizar video de canal",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/canal-videos/{id}/upload",
    tag: TAGS.channels,
    summary: "Enviar nova versao de video de canal",
    parameters: [idParam],
    requestBody: fileUploadBody,
  },
  {
    method: "delete",
    path: "/api/canal-videos/{id}",
    tag: TAGS.channels,
    summary: "Excluir video de canal",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/provas",
    tag: TAGS.provas,
    summary: "Listar provas em arquivo",
    parameters: [trilhaIdQuery, cpfQuery],
  },
  {
    method: "post",
    path: "/api/provas",
    tag: TAGS.contents,
    summary: "Criar prova em arquivo por caminho",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/provas/upload",
    tag: TAGS.contents,
    summary: "Enviar prova em arquivo",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/provas/{id}",
    tag: TAGS.contents,
    summary: "Detalhar prova em arquivo",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/provas/{id}",
    tag: TAGS.contents,
    summary: "Atualizar prova em arquivo",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/provas/{id}/upload",
    tag: TAGS.contents,
    summary: "Enviar nova versao de prova em arquivo",
    parameters: [idParam],
    requestBody: fileUploadBody,
  },
  {
    method: "delete",
    path: "/api/provas/{id}",
    tag: TAGS.contents,
    summary: "Excluir prova em arquivo",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/provas/attempts/report",
    tag: TAGS.provas,
    summary: "Listar historico de tentativas de prova",
    parameters: [
      queryParam("status", "Status da tentativa", { type: "string", enum: ["aprovado", "reprovado"] }),
      queryParam("dateFrom", "Data inicial", { type: "string", format: "date" }),
      queryParam("dateTo", "Data final", { type: "string", format: "date" }),
      trilhaIdQuery,
    ],
  },
  {
    method: "get",
    path: "/api/provas/trilha/{trilhaId}/trained-collaborators",
    tag: TAGS.reports,
    summary: "Listar colaboradores treinados por trilha",
    parameters: [trilhaIdParam],
  },
  {
    method: "get",
    path: "/api/provas/trilha/{trilhaId}/objectiva",
    tag: TAGS.provas,
    summary: "Buscar prova objetiva da trilha",
    parameters: [trilhaIdParam, versaoQuery],
  },
  {
    method: "post",
    path: "/api/provas/trilha/{trilhaId}/objectiva",
    tag: TAGS.provas,
    summary: "Criar ou versionar prova objetiva da trilha",
    parameters: [trilhaIdParam],
    requestBody: jsonBody(ref("ObjectiveProvaRequest")),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/provas/trilha/{trilhaId}/objectiva/player",
    tag: TAGS.provas,
    summary: "Buscar prova objetiva para o aluno",
    description:
      "Retorna a prova sem gabarito. Quando informado CPF, valida atribuicao da trilha ou token coletivo.",
    parameters: [trilhaIdParam, cpfQuery, tokenQuery],
  },
  {
    method: "get",
    path: "/api/provas/trilha/{trilhaId}/objectiva/player/result",
    tag: TAGS.provas,
    summary: "Consultar resultado anterior do player por compatibilidade",
    description:
      "Mantido para clientes antigos. Na regra atual, sempre retorna result=null para garantir que a prova abra em branco em qualquer fluxo.",
    parameters: [trilhaIdParam, cpfQuery],
    responses: { "200": ok(ref("BlankObjectiveResultResponse")) },
  },
  {
    method: "post",
    path: "/api/provas/trilha/{trilhaId}/objectiva/player/submit",
    tag: TAGS.provas,
    summary: "Enviar respostas da prova objetiva individual",
    description:
      "Registra uma nova tentativa. Tentativas anteriores nao sao usadas para preencher a proxima abertura da prova.",
    parameters: [trilhaIdParam],
    requestBody: jsonBody(ref("ObjectiveSubmitRequest")),
    responses: { "201": created(ref("ObjectiveSubmitResponse")) },
  },
  {
    method: "post",
    path: "/api/provas/trilha/{trilhaId}/objectiva/instrutor/submit",
    tag: TAGS.provas,
    summary: "Enviar respostas de prova coletiva pelo instrutor",
    parameters: [trilhaIdParam],
    requestBody: jsonBody(ref("ObjectiveCollectiveSubmitRequest")),
    responses: { "201": created(ref("ObjectiveSubmitResponse")) },
  },
  {
    method: "post",
    path: "/api/provas/objectiva/instrutor/individual/qr",
    tag: TAGS.provas,
    summary: "Gerar QR Code para prova individual em treinamento coletivo",
    requestBody: jsonBody(ref("ObjectiveCollectiveQrRequest")),
    responses: { "201": created(ref("ObjectiveCollectiveQrResponse")) },
  },
  {
    method: "get",
    path: "/api/provas/objectiva/instrutor/individual/qr/{token}",
    tag: TAGS.provas,
    summary: "Resolver token de QR Code da prova individual coletiva",
    parameters: [tokenParam, cpfQuery],
  },
  {
    method: "get",
    path: "/api/provas/trilha/{trilhaId}/eficacia",
    tag: TAGS.eficacia,
    summary: "Buscar avaliacao de eficacia da trilha",
    parameters: [trilhaIdParam, versaoQuery],
  },
  {
    method: "post",
    path: "/api/provas/trilha/{trilhaId}/eficacia",
    tag: TAGS.eficacia,
    summary: "Criar ou versionar avaliacao de eficacia da trilha",
    parameters: [trilhaIdParam],
    requestBody: jsonBody(ref("EfficacyProvaRequest")),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/training-matrix",
    tag: TAGS.matrix,
    summary: "Listar matriz de treinamento",
    parameters: [queryParam("cargo", "Filtra por cargo")],
  },
  {
    method: "post",
    path: "/api/training-matrix",
    tag: TAGS.matrix,
    summary: "Criar item da matriz de treinamento",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/training-matrix/{id}",
    tag: TAGS.matrix,
    summary: "Detalhar item da matriz de treinamento",
    parameters: [idParam],
  },
  {
    method: "put",
    path: "/api/training-matrix/{id}",
    tag: TAGS.matrix,
    summary: "Atualizar item da matriz de treinamento",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/training-matrix/{id}",
    tag: TAGS.matrix,
    summary: "Excluir item da matriz de treinamento",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "post",
    path: "/api/user-courses",
    tag: TAGS.completions,
    summary: "Associar curso ao usuario",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "put",
    path: "/api/user-courses/{id}",
    tag: TAGS.completions,
    summary: "Atualizar curso do usuario",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/user-courses/{id}",
    tag: TAGS.completions,
    summary: "Remover curso do usuario",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "post",
    path: "/api/user-trilhas",
    tag: TAGS.trilhas,
    summary: "Atribuir trilhas ao usuario",
    requestBody: jsonBody(ref("UserTrilhaAssignRequest")),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/user-trilhas/{cpf}",
    tag: TAGS.trilhas,
    summary: "Listar trilhas atribuidas ao usuario",
    parameters: [cpfParam, moduloIdQuery],
  },
  {
    method: "delete",
    path: "/api/user-trilhas/{cpf}/{trilhaId}",
    tag: TAGS.trilhas,
    summary: "Remover trilha atribuida ao usuario",
    parameters: [cpfParam, trilhaIdParam],
    responses: { "204": noContent() },
  },
  {
    method: "post",
    path: "/api/user-trainings",
    tag: TAGS.completions,
    summary: "Registrar presenca em treinamentos",
    requestBody: jsonBody(ref("RecordAttendanceRequest")),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/user-trainings/face-evidence",
    tag: TAGS.completions,
    summary: "Anexar evidencia facial em treinamentos da turma",
    requestBody: jsonBody(ref("FaceEvidenceRequest")),
  },
  {
    method: "post",
    path: "/api/user-trainings/eficacia/trilha",
    tag: TAGS.eficacia,
    summary: "Registrar eficacia individual por trilha",
    requestBody: jsonBody(ref("RecordTrilhaEficaciaRequest")),
  },
  {
    method: "post",
    path: "/api/user-trainings/eficacia/turma",
    tag: TAGS.eficacia,
    summary: "Registrar eficacia de turma coletiva",
    requestBody: jsonBody(ref("RecordTurmaEficaciaRequest")),
  },
  {
    method: "post",
    path: "/api/user-trainings/complete",
    tag: TAGS.completions,
    summary: "Registrar conclusao de video pelo aluno",
    requestBody: jsonBody(ref("VideoCompletionRequest")),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/user-trainings/complete-trilha",
    tag: TAGS.completions,
    summary: "Registrar conclusao de trilha",
    description:
      "Usado para mover a trilha para Cursos Finalizados. Internamente usa marcador compativel com o schema atual do banco, sem gravar TIPO=trilha.",
    requestBody: jsonBody(ref("TrilhaCompletionRequest")),
    responses: { "200": ok(ref("SuccessResponse")) },
  },
  {
    method: "get",
    path: "/api/user-trainings/completions/videos",
    tag: TAGS.completions,
    summary: "Listar conclusoes por video",
    parameters: [
      queryParam("materialId", "ID do video", { type: "string", format: "uuid" }, true),
      versaoQuery,
    ],
  },
  {
    method: "get",
    path: "/api/user-trainings/completions/videos/{cpf}",
    tag: TAGS.completions,
    summary: "Listar videos concluidos por CPF",
    parameters: [cpfParam],
  },
  {
    method: "get",
    path: "/api/user-trainings/completions/trilhas/{cpf}",
    tag: TAGS.completions,
    summary: "Listar trilhas concluidas por CPF",
    description:
      "Fonte da tela Cursos Finalizados na area externa. Reconhece marcadores atuais e registros legados.",
    parameters: [cpfParam],
  },
  {
    method: "get",
    path: "/api/user-trainings/completions/report",
    tag: TAGS.reports,
    summary: "Relatorio de conclusoes por funcao",
    parameters: [queryParam("funcao", "Filtra por funcao"), queryParam("turma", "Filtra por turma")],
  },
  {
    method: "get",
    path: "/api/user-trainings/completions/report/archived",
    tag: TAGS.reports,
    summary: "Relatorio de conclusoes arquivadas por funcao",
    parameters: [queryParam("funcao", "Filtra por funcao"), queryParam("turma", "Filtra por turma")],
  },
  {
    method: "get",
    path: "/api/turmas",
    tag: TAGS.turmas,
    summary: "Listar turmas coletivas",
    parameters: [queryParam("search", "Busca textual")],
  },
  {
    method: "post",
    path: "/api/turmas",
    tag: TAGS.turmas,
    summary: "Criar turma coletiva",
    requestBody: jsonBody(ref("TurmaRequest")),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/turmas/{turmaId}",
    tag: TAGS.turmas,
    summary: "Detalhar turma coletiva",
    parameters: [turmaIdParam],
  },
  {
    method: "post",
    path: "/api/turmas/{turmaId}/evidencias",
    tag: TAGS.turmas,
    summary: "Salvar evidencias de encerramento da turma",
    parameters: [turmaIdParam],
    requestBody: multipartBody(
      {
        files: { type: "array", items: { type: "string", format: "binary" } },
        duracaoHoras: { type: "integer" },
        duracaoMinutos: { type: "integer", enum: [0, 15, 30, 45] },
        finalizadoEm: { type: "string", format: "date-time" },
        criadoPor: { type: "string" },
        obraLocal: { type: "string" },
      },
      ["files", "duracaoHoras", "duracaoMinutos"],
    ),
  },
  {
    method: "get",
    path: "/api/faces",
    tag: TAGS.faces,
    summary: "Listar faces cadastradas",
    parameters: [cpfQuery],
  },
  {
    method: "get",
    path: "/api/faces/{cpf}",
    tag: TAGS.faces,
    summary: "Listar faces cadastradas por CPF",
    parameters: [cpfParam],
  },
  {
    method: "post",
    path: "/api/faces/enroll",
    tag: TAGS.faces,
    summary: "Cadastrar face do usuario",
    requestBody: jsonBody(ref("FaceEnrollRequest")),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/faces/match",
    tag: TAGS.faces,
    summary: "Validar face por descritor",
    requestBody: jsonBody(ref("FaceMatchRequest")),
  },
  {
    method: "get",
    path: "/api/procedimentos",
    tag: TAGS.normasProcedimentos,
    summary: "Listar procedimentos",
  },
  {
    method: "post",
    path: "/api/procedimentos",
    tag: TAGS.normasProcedimentos,
    summary: "Criar procedimento por caminho de arquivo",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/procedimentos/from-file-manager",
    tag: TAGS.normasProcedimentos,
    summary: "Listar procedimentos a partir do gestor de arquivos",
    parameters: [queryParam("sector", "Setor de origem")],
  },
  {
    method: "post",
    path: "/api/procedimentos/upload",
    tag: TAGS.normasProcedimentos,
    summary: "Enviar procedimento",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/procedimentos/{id}",
    tag: TAGS.normasProcedimentos,
    summary: "Detalhar procedimento",
    parameters: [idParam, versaoQuery],
  },
  {
    method: "get",
    path: "/api/procedimentos/{id}/content",
    tag: TAGS.normasProcedimentos,
    summary: "Baixar conteudo do procedimento",
    parameters: [idParam, versaoQuery],
    responses: { "200": binaryResponse("Arquivo") },
  },
  {
    method: "put",
    path: "/api/procedimentos/{id}",
    tag: TAGS.normasProcedimentos,
    summary: "Atualizar procedimento e gerar nova versao",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/procedimentos/{id}/upload",
    tag: TAGS.normasProcedimentos,
    summary: "Enviar nova versao do procedimento",
    parameters: [idParam],
    requestBody: fileUploadBody,
  },
  {
    method: "delete",
    path: "/api/procedimentos/{id}",
    tag: TAGS.normasProcedimentos,
    summary: "Excluir procedimento",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/normas",
    tag: TAGS.normasProcedimentos,
    summary: "Listar normas",
  },
  {
    method: "post",
    path: "/api/normas",
    tag: TAGS.normasProcedimentos,
    summary: "Criar norma por caminho de arquivo",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/normas/upload",
    tag: TAGS.normasProcedimentos,
    summary: "Enviar norma",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/normas/{id}",
    tag: TAGS.normasProcedimentos,
    summary: "Detalhar norma",
    parameters: [idParam, versaoQuery],
  },
  {
    method: "get",
    path: "/api/normas/{id}/content",
    tag: TAGS.normasProcedimentos,
    summary: "Baixar conteudo da norma",
    parameters: [idParam, versaoQuery],
    responses: { "200": binaryResponse("Arquivo") },
  },
  {
    method: "put",
    path: "/api/normas/{id}",
    tag: TAGS.normasProcedimentos,
    summary: "Atualizar norma e gerar nova versao",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "put",
    path: "/api/normas/{id}/upload",
    tag: TAGS.normasProcedimentos,
    summary: "Enviar nova versao da norma",
    parameters: [idParam],
    requestBody: fileUploadBody,
  },
  {
    method: "delete",
    path: "/api/normas/{id}",
    tag: TAGS.normasProcedimentos,
    summary: "Excluir norma",
    parameters: [idParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/notificacoes",
    tag: TAGS.notifications,
    summary: "Listar notificacoes de vencimento",
    parameters: [
      queryParam("status", "Filtra por status"),
      queryParam("lookaheadDays", "Janela futura em dias", { type: "integer" }),
    ],
  },
  {
    method: "patch",
    path: "/api/notificacoes/{id}/read",
    tag: TAGS.notifications,
    summary: "Marcar notificacao como lida",
    parameters: [idParam],
  },
  {
    method: "patch",
    path: "/api/notificacoes/{id}/unread",
    tag: TAGS.notifications,
    summary: "Marcar notificacao como nao lida",
    parameters: [idParam],
  },
  {
    method: "get",
    path: "/api/notificacoes/perfil",
    tag: TAGS.notifications,
    summary: "Listar notificacoes do perfil",
    parameters: [
      queryParam("username", "Usuario do perfil"),
      queryParam("status", "Filtra por status"),
      queryParam("limit", "Quantidade maxima", { type: "integer" }),
    ],
  },
  {
    method: "get",
    path: "/api/notificacoes/perfil/stream",
    tag: TAGS.notifications,
    summary: "Abrir stream SSE de notificacoes do perfil",
    parameters: [queryParam("username", "Usuario do perfil")],
    responses: { "200": eventStreamResponse("Stream Server-Sent Events") },
  },
  {
    method: "patch",
    path: "/api/notificacoes/perfil/read-all",
    tag: TAGS.notifications,
    summary: "Marcar todas as notificacoes do perfil como lidas",
    requestBody: jsonBody(ref("UsernameRequest"), false),
  },
  {
    method: "patch",
    path: "/api/notificacoes/perfil/{id}/read",
    tag: TAGS.notifications,
    summary: "Marcar notificacao do perfil como lida",
    parameters: [idParam],
    requestBody: jsonBody(ref("UsernameRequest"), false),
  },
  {
    method: "get",
    path: "/api/notificacoes/treinamentos",
    tag: TAGS.notifications,
    summary: "Listar notificacoes de fluxo de treinamento",
    parameters: [
      queryParam("username", "Usuario destinatario"),
      queryParam("status", "Filtra por status"),
      queryParam("limit", "Quantidade maxima", { type: "integer" }),
    ],
  },
  {
    method: "get",
    path: "/api/notificacoes/treinamentos/stream",
    tag: TAGS.notifications,
    summary: "Abrir stream SSE de notificacoes de treinamento",
    parameters: [queryParam("username", "Usuario destinatario")],
    responses: { "200": eventStreamResponse("Stream Server-Sent Events") },
  },
  {
    method: "patch",
    path: "/api/notificacoes/treinamentos/read-all",
    tag: TAGS.notifications,
    summary: "Marcar todas as notificacoes de treinamento como lidas",
    requestBody: jsonBody(ref("UsernameRequest"), false),
  },
  {
    method: "patch",
    path: "/api/notificacoes/treinamentos/{id}/read",
    tag: TAGS.notifications,
    summary: "Marcar notificacao de treinamento como lida",
    parameters: [idParam],
    requestBody: jsonBody(ref("UsernameRequest"), false),
  },
  {
    method: "get",
    path: "/api/profile-feed/messages",
    tag: TAGS.profile,
    summary: "Listar mensagens do feed de perfil",
    parameters: [
      queryParam("profileUsername", "Usuario dono do perfil"),
      queryParam("viewerUsername", "Usuario visualizador"),
    ],
  },
  {
    method: "post",
    path: "/api/profile-feed/messages",
    tag: TAGS.profile,
    summary: "Publicar mensagem no feed de perfil",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "put",
    path: "/api/profile-feed/messages/{id}/reaction",
    tag: TAGS.profile,
    summary: "Atualizar reacao em mensagem do feed",
    parameters: [idParam],
    requestBody: jsonBody(),
  },
  {
    method: "get",
    path: "/api/feedbacks/platform-satisfaction/status/{cpf}",
    tag: TAGS.feedbacks,
    summary: "Consultar status de satisfacao da plataforma",
    parameters: [cpfParam],
  },
  {
    method: "post",
    path: "/api/feedbacks/platform-satisfaction",
    tag: TAGS.feedbacks,
    summary: "Registrar satisfacao da plataforma",
    requestBody: jsonBody(ref("PlatformSatisfactionRequest")),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/feedbacks/dashboard-summary",
    tag: TAGS.feedbacks,
    summary: "Resumo de feedbacks para dashboard",
  },
  {
    method: "get",
    path: "/api/dossies/candidates",
    tag: TAGS.dossies,
    summary: "Listar candidatos para geracao de dossie",
  },
  {
    method: "get",
    path: "/api/dossies/courses/{cpf}",
    tag: TAGS.dossies,
    summary: "Listar cursos do dossie por CPF",
    parameters: [cpfParam],
  },
  {
    method: "post",
    path: "/api/dossies/generate",
    tag: TAGS.dossies,
    summary: "Gerar dossie de treinamentos",
    requestBody: jsonBody(),
  },
  {
    method: "get",
    path: "/api/reports/user-trainings",
    tag: TAGS.reports,
    summary: "Relatorio de treinamentos por usuario",
    parameters: [cpfQuery],
  },
  {
    method: "get",
    path: "/api/reports/obra-pending",
    tag: TAGS.reports,
    summary: "Relatorio de treinamentos pendentes por obra",
    parameters: [queryParam("obra", "Filtra por obra")],
  },
  {
    method: "get",
    path: "/api/reports/obra-trained",
    tag: TAGS.reports,
    summary: "Relatorio de colaboradores treinados por obra",
    parameters: [queryParam("obra", "Filtra por obra")],
  },
  {
    method: "get",
    path: "/api/reports/obra-training-overview",
    tag: TAGS.reports,
    summary: "Visao geral de treinamentos por obra",
    parameters: [
      queryParam("inicio", "Data inicial", { type: "string", format: "date" }),
      queryParam("fim", "Data final", { type: "string", format: "date" }),
    ],
  },
  {
    method: "get",
    path: "/api/reports/procedimentos",
    tag: TAGS.reports,
    summary: "Relatorio de versoes de procedimentos",
  },
  {
    method: "get",
    path: "/api/reports/trilhas/{trilhaId}",
    tag: TAGS.reports,
    summary: "Relatorio de treinamento por trilha",
    parameters: [trilhaIdParam],
  },
  {
    method: "get",
    path: "/api/sector-file-manager/folders",
    tag: TAGS.sectorFiles,
    summary: "Listar pastas do gestor por setor",
    parameters: [queryParam("sector", "Setor")],
  },
  {
    method: "post",
    path: "/api/sector-file-manager/folders",
    tag: TAGS.sectorFiles,
    summary: "Criar pasta no gestor por setor",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "get",
    path: "/api/sector-file-manager/contents",
    tag: TAGS.sectorFiles,
    summary: "Listar conteudo de pasta do gestor",
    parameters: [
      queryParam("sector", "Setor"),
      queryParam("view", "Visao"),
      queryParam("username", "Usuario"),
      queryParam("parentItemId", "Pasta pai"),
      queryParam("sourceSector", "Setor de origem"),
      queryParam("sharedRootItemId", "Raiz compartilhada"),
    ],
  },
  {
    method: "get",
    path: "/api/sector-file-manager/folders/{itemId}/shares",
    tag: TAGS.sectorFiles,
    summary: "Listar compartilhamentos de pasta",
    parameters: [itemIdParam],
  },
  {
    method: "put",
    path: "/api/sector-file-manager/folders/{itemId}/shares",
    tag: TAGS.sectorFiles,
    summary: "Atualizar compartilhamentos de pasta",
    parameters: [itemIdParam],
    requestBody: jsonBody(),
  },
  {
    method: "get",
    path: "/api/sector-file-manager/items/{itemId}/content",
    tag: TAGS.sectorFiles,
    summary: "Baixar conteudo de item do gestor",
    parameters: [itemIdParam],
    responses: { "200": binaryResponse("Arquivo") },
  },
  {
    method: "get",
    path: "/api/sector-file-manager/items/{itemId}/version-impact",
    tag: TAGS.sectorFiles,
    summary: "Consultar impacto de versionamento do item",
    parameters: [itemIdParam],
  },
  {
    method: "post",
    path: "/api/sector-file-manager/files/upload/session",
    tag: TAGS.sectorFiles,
    summary: "Iniciar sessao de upload de arquivo no gestor",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/sector-file-manager/files/upload/session/{sessionId}/complete",
    tag: TAGS.sectorFiles,
    summary: "Finalizar sessao de upload de arquivo no gestor",
    parameters: [sessionIdParam],
    requestBody: jsonBody(ref("GenericObject"), false),
  },
  {
    method: "post",
    path: "/api/sector-file-manager/files/upload",
    tag: TAGS.sectorFiles,
    summary: "Enviar arquivo para o gestor por setor",
    requestBody: fileUploadBody,
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/sector-file-manager/links/youtube",
    tag: TAGS.sectorFiles,
    summary: "Criar link do YouTube no gestor por setor",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
  {
    method: "post",
    path: "/api/sector-file-manager/items/{itemId}/version",
    tag: TAGS.sectorFiles,
    summary: "Criar nova versao de item do gestor",
    parameters: [itemIdParam],
    requestBody: fileUploadBody,
  },
  {
    method: "patch",
    path: "/api/sector-file-manager/folders/{itemId}/favorite",
    tag: TAGS.sectorFiles,
    summary: "Alternar favorito da pasta",
    parameters: [itemIdParam],
    requestBody: jsonBody(),
  },
  {
    method: "patch",
    path: "/api/sector-file-manager/folders/{itemId}",
    tag: TAGS.sectorFiles,
    summary: "Atualizar pasta do gestor",
    parameters: [itemIdParam],
    requestBody: jsonBody(),
  },
  {
    method: "delete",
    path: "/api/sector-file-manager/folders/{itemId}",
    tag: TAGS.sectorFiles,
    summary: "Remover pasta do gestor",
    parameters: [itemIdParam],
    responses: { "204": noContent() },
  },
  {
    method: "delete",
    path: "/api/sector-file-manager/items/{itemId}",
    tag: TAGS.sectorFiles,
    summary: "Remover item do gestor",
    parameters: [itemIdParam],
    responses: { "204": noContent() },
  },
  {
    method: "post",
    path: "/api/sector-file-manager/trash/{itemId}/restore",
    tag: TAGS.sectorFiles,
    summary: "Restaurar item da lixeira",
    parameters: [itemIdParam],
    requestBody: jsonBody(ref("GenericObject"), false),
  },
  {
    method: "delete",
    path: "/api/sector-file-manager/trash/{itemId}/permanent",
    tag: TAGS.sectorFiles,
    summary: "Excluir item permanentemente da lixeira",
    parameters: [itemIdParam],
    responses: { "204": noContent() },
  },
  {
    method: "get",
    path: "/api/platform-access-audit",
    tag: TAGS.audit,
    summary: "Listar auditoria de acessos da plataforma",
    parameters: [queryParam("limit", "Quantidade maxima", { type: "integer" })],
  },
  {
    method: "post",
    path: "/api/platform-access-audit",
    tag: TAGS.audit,
    summary: "Registrar acesso a plataforma",
    requestBody: jsonBody(),
    responses: { "201": created() },
  },
]

function buildOperation(endpoint: Endpoint): Record<string, unknown> {
  return {
    tags: [endpoint.tag],
    summary: endpoint.summary,
    ...(endpoint.description ? { description: endpoint.description } : {}),
    ...(endpoint.parameters ? { parameters: endpoint.parameters } : {}),
    ...(endpoint.requestBody ? { requestBody: endpoint.requestBody } : {}),
    responses: {
      ...(endpoint.responses ?? { "200": ok() }),
      ...defaultErrorResponses,
    },
  }
}

function buildPaths(items: Endpoint[]): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const endpoint of items) {
    paths[endpoint.path] = paths[endpoint.path] ?? {}
    paths[endpoint.path][endpoint.method] = buildOperation(endpoint)
  }

  return paths
}

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Gestao de Treinamento API",
    version: "1.2.0",
    description:
      "API do modulo de treinamento organizada por funcionalidade. Na regra atual, a prova do player sempre abre em branco; tentativas anteriores continuam salvas apenas para relatorios.",
  },
  servers: [
    { url: "http://localhost:4000", description: "Execucao local do modulo" },
    { url: "/treinamento", description: "API unificada com prefixo do modulo" },
  ],
  tags: [
    { name: TAGS.auth, description: "Login, primeiro acesso e senha" },
    { name: TAGS.users, description: "Usuarios, instrutores, colaboradores e secoes" },
    { name: TAGS.coursesModules, description: "Cursos e modulos" },
    { name: TAGS.trilhas, description: "Trilhas, compartilhamentos e atribuicoes" },
    { name: TAGS.contents, description: "Videos, PDFs e provas em arquivo" },
    { name: TAGS.channels, description: "Canais e videos de canal" },
    { name: TAGS.provas, description: "Provas objetivas, player, tentativas e QR Code" },
    { name: TAGS.eficacia, description: "Avaliacoes de eficacia" },
    { name: TAGS.turmas, description: "Treinamentos coletivos" },
    { name: TAGS.completions, description: "Presencas, conclusoes e cursos finalizados" },
    { name: TAGS.matrix, description: "Matriz de treinamento por cargo" },
    { name: TAGS.normasProcedimentos, description: "Normas, procedimentos e versoes" },
    { name: TAGS.notifications, description: "Notificacoes e streams em tempo real" },
    { name: TAGS.profile, description: "Mensagens e reacoes do perfil" },
    { name: TAGS.feedbacks, description: "Satisfacao e feedbacks da plataforma" },
    { name: TAGS.reports, description: "Relatorios do modulo" },
    { name: TAGS.dossies, description: "Dossie de treinamentos" },
    { name: TAGS.sectorFiles, description: "Gestor de arquivos por setor" },
    { name: TAGS.faces, description: "Cadastro e validacao facial" },
    { name: TAGS.audit, description: "Auditoria de acesso" },
    { name: TAGS.operational, description: "Saude e operacao do modulo" },
  ],
  paths: buildPaths(endpoints),
  components: {
    schemas: {
      BlankObjectiveResultResponse: {
        type: "object",
        required: ["result"],
        properties: {
          result: {
            type: "object",
            nullable: true,
            description: "Sempre null para impedir que a prova abra respondida.",
          },
        },
        example: { result: null },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
      GenericObject: {
        type: "object",
        additionalProperties: true,
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["cpf", "password"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          password: { type: "string", format: "password" },
        },
      },
      LoginResponse: {
        type: "object",
        additionalProperties: true,
      },
      FirstAccessRequest: {
        type: "object",
        required: ["cpf", "dtNascimento", "password"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          dtNascimento: { type: "string", example: "1990-01-31" },
          password: { type: "string", format: "password" },
        },
      },
      PasswordUpdateRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", format: "password" },
          newPassword: { type: "string", format: "password" },
        },
      },
      TrilhaEficaciaConfigRequest: {
        type: "object",
        required: ["pergunta"],
        properties: {
          pergunta: { type: "string" },
          obrigatoria: { type: "boolean", default: true },
        },
      },
      OrderRequest: {
        type: "object",
        required: ["ordem"],
        properties: {
          ordem: { type: "integer", minimum: 0 },
        },
      },
      ObjectiveOptionInput: {
        type: "object",
        required: ["texto"],
        properties: {
          texto: { type: "string" },
          correta: { type: "boolean" },
        },
      },
      ObjectiveQuestionInput: {
        type: "object",
        required: ["enunciado", "opcoes"],
        properties: {
          enunciado: { type: "string" },
          peso: {
            type: "number",
            description: "Na prova objetiva, a soma dos pesos deve ser 10.",
          },
          opcoes: arrayOf(ref("ObjectiveOptionInput")),
        },
      },
      ObjectiveProvaRequest: {
        type: "object",
        required: ["titulo", "questoes"],
        properties: {
          actorName: { type: "string" },
          actorUsername: { type: "string" },
          titulo: { type: "string" },
          modoAplicacao: { type: "string", enum: ["individual", "coletiva"] },
          requireRetraining: { type: "boolean" },
          questoes: arrayOf(ref("ObjectiveQuestionInput")),
        },
      },
      ObjectiveAnswerInput: {
        type: "object",
        required: ["questaoId", "opcaoId"],
        properties: {
          questaoId: { type: "string", format: "uuid" },
          opcaoId: { type: "string", format: "uuid" },
        },
      },
      ObjectiveSubmitRequest: {
        type: "object",
        required: ["cpf", "respostas"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          respostas: arrayOf(ref("ObjectiveAnswerInput")),
          user: ref("GenericObject"),
          token: {
            type: "string",
            description: "Token do QR Code quando houver treinamento coletivo.",
          },
        },
      },
      ObjectiveSubmitResponse: {
        type: "object",
        properties: {
          nota: { type: "number" },
          media: { type: "number", example: 6 },
          status: { type: "string", enum: ["aprovado", "reprovado"] },
          acertos: { type: "integer" },
          totalQuestoes: { type: "integer" },
          aprovado: { type: "boolean" },
          gabarito: arrayOf(ref("GenericObject")),
          prova: ref("GenericObject"),
        },
      },
      ObjectiveCollectiveSubmitRequest: {
        type: "object",
        required: ["users", "respostas"],
        properties: {
          users: arrayOf(ref("GenericObject")),
          respostas: arrayOf(ref("ObjectiveAnswerInput")),
          turmaId: { type: "string", format: "uuid" },
          concluidoEm: { type: "string", format: "date-time" },
          origem: { type: "string" },
        },
      },
      ObjectiveCollectiveQrRequest: {
        type: "object",
        required: ["users", "trilhaIds"],
        properties: {
          users: arrayOf(ref("GenericObject")),
          trilhaIds: arrayOf({ type: "string", format: "uuid" }),
          turmaId: { type: "string", format: "uuid", nullable: true },
          redirectBaseUrl: { type: "string", format: "uri" },
        },
      },
      ObjectiveCollectiveQrResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          redirectUrl: { type: "string", format: "uri" },
          qrCodeImageUrl: { type: "string", format: "uri" },
          expiresAt: { type: "string", format: "date-time" },
          trilhas: arrayOf(ref("GenericObject")),
          totalUsuarios: { type: "integer" },
        },
      },
      EfficacyProvaRequest: {
        type: "object",
        required: ["titulo", "questoes"],
        properties: {
          actorName: { type: "string" },
          actorUsername: { type: "string" },
          titulo: { type: "string" },
          questoes: arrayOf(ref("ObjectiveQuestionInput")),
        },
      },
      UserTrilhaAssignRequest: {
        type: "object",
        required: ["cpf", "trilhaIds"],
        properties: {
          cpf: { type: "string" },
          trilhaIds: arrayOf({ type: "string", format: "uuid" }),
          atribuidoPor: { type: "string" },
          user: ref("GenericObject"),
        },
      },
      TrainingItemInput: {
        type: "object",
        required: ["tipo", "materialId"],
        properties: {
          tipo: { type: "string", enum: ["video", "pdf", "prova"] },
          id: { type: "string", format: "uuid" },
          materialId: { type: "string", format: "uuid" },
          versao: { type: "integer", minimum: 1 },
          materialVersao: { type: "integer", minimum: 1 },
        },
      },
      RecordAttendanceRequest: {
        type: "object",
        required: ["users", "trainings"],
        properties: {
          users: arrayOf(ref("GenericObject")),
          trainings: arrayOf(ref("TrainingItemInput")),
          turmaId: { type: "string", format: "uuid" },
          concluidoEm: { type: "string", format: "date-time" },
          origem: { type: "string", default: "presenca" },
        },
      },
      FaceEvidenceRequest: {
        type: "object",
        required: ["turmaId", "captures"],
        properties: {
          turmaId: { type: "string", format: "uuid" },
          obraLocal: { type: "string" },
          captures: arrayOf(
            {
              type: "object",
              properties: {
                cpf: { type: "string" },
                fotoBase64: { type: "string", nullable: true },
                fotoUrl: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          ),
        },
      },
      RecordTrilhaEficaciaRequest: {
        type: "object",
        required: ["cpf", "trilhaId", "nivel"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          trilhaId: { type: "string", format: "uuid" },
          nivel: { type: "integer", minimum: 1, maximum: 5 },
          avaliadoEm: { type: "string", format: "date-time" },
        },
      },
      RecordTurmaEficaciaRequest: {
        type: "object",
        required: ["turmaId", "avaliacoes"],
        properties: {
          turmaId: { type: "string", format: "uuid" },
          avaliacoes: arrayOf(
            {
              type: "object",
              required: ["cpf", "nivel"],
              properties: {
                cpf: { type: "string" },
                nivel: { type: "integer", minimum: 1, maximum: 5 },
              },
            },
          ),
          avaliadoEm: { type: "string", format: "date-time" },
        },
      },
      VideoCompletionRequest: {
        type: "object",
        required: ["cpf", "videoId"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          videoId: { type: "string", format: "uuid" },
          materialVersao: { type: "integer", minimum: 1 },
          concluidoEm: { type: "string", format: "date-time" },
          origem: { type: "string", default: "player" },
          user: ref("GenericObject"),
        },
      },
      TrilhaCompletionRequest: {
        type: "object",
        required: ["cpf", "trilhaId"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          trilhaId: { type: "string", format: "uuid" },
          concluidoEm: { type: "string", format: "date-time" },
          origem: { type: "string", default: "player" },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
        },
      },
      TurmaRequest: {
        type: "object",
        required: ["users"],
        properties: {
          nome: { type: "string" },
          users: arrayOf(ref("GenericObject")),
          criadoPor: { type: "string" },
          iniciadoEm: { type: "string", format: "date-time" },
        },
      },
      FaceEnrollRequest: {
        type: "object",
        required: ["cpf", "descriptor"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          descriptor: arrayOf({ type: "number" }),
          fotoBase64: { type: "string" },
          fotoUrl: { type: "string" },
        },
      },
      FaceMatchRequest: {
        type: "object",
        required: ["descriptor"],
        properties: {
          descriptor: arrayOf({ type: "number" }),
          threshold: { type: "number" },
        },
      },
      UsernameRequest: {
        type: "object",
        properties: {
          username: { type: "string" },
        },
      },
      PlatformSatisfactionRequest: {
        type: "object",
        required: ["cpf"],
        properties: {
          cpf: { type: "string", example: "12345678901" },
          nivelSatisfacao: { type: "integer", minimum: 1, maximum: 5 },
          nivel: { type: "integer", minimum: 1, maximum: 5 },
          respondidoEm: { type: "string", format: "date-time" },
        },
      },
    },
  },
}

export default openapi
