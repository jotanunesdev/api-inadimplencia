# Módulo GLPI

## Visão geral

O módulo GLPI expõe uma API HTTP somente leitura para consumo de dados operacionais do GLPI, com três endpoints principais: `GET /glpi/chamados`, `GET /glpi/inventario` e `GET /glpi/custos`, além de `GET /glpi/health` para verificação de saúde. Ele foi criado para permitir integração com dashboards, BI e ferramentas internas sem acesso direto ao banco de dados.

## Pré-requisitos

- Node.js 18 ou superior.
- Acesso ao banco MySQL do GLPI.
- Usuário de banco com permissão **somente leitura** (`SELECT`).
- Origem liberada na allowlist de CORS do módulo.
- `.env` preenchido com as credenciais do GLPI.

## Configuração do `.env`

1. Copie o arquivo de exemplo:

   ```bash
   cp src/modules/glpi/.env.example src/modules/glpi/.env
   ```

2. Ajuste os valores conforme o ambiente.

### Variáveis disponíveis

- `GLPI_ENABLED`
  - Habilita ou desabilita o módulo.
  - `true` mantém as rotas ativas.
  - `false` faz o middleware retornar `503` com `GLPI_DISABLED`.

- `GLPI_DB_HOST`
  - Host do banco MySQL do GLPI.
  - Exemplo: `localhost` ou um hostname interno de produção.

- `GLPI_DB_PORT`
  - Porta do MySQL.
  - Padrão: `3306`.

- `GLPI_DB_USER`
  - Usuário MySQL com permissão apenas de leitura.
  - Recomendado criar um usuário exclusivo para a API.

- `GLPI_DB_PASSWORD`
  - Senha do usuário MySQL.
  - Não versionar esse valor.

- `GLPI_DB_NAME`
  - Nome do banco GLPI.
  - Normalmente `glpi`.

- `GLPI_QUERY_TIMEOUT_MS`
  - Tempo máximo, em milissegundos, para cada consulta.
  - Padrão: `30000`.

- `GLPI_CORS_ORIGIN`
  - Lista de origens permitidas, separadas por vírgula.
  - Exemplo: `https://portal.exemplo.local,https://bi.exemplo.local`.
  - Se a origem da requisição não estiver nessa lista, o navegador bloqueia o acesso.

## Comandos

### Instalação

```bash
npm install
```

### Rodar o módulo em desenvolvimento

```bash
npm run dev:glpi
```

### Rodar o módulo em modo produção

```bash
npm run start:glpi
```

### Swagger

- Swagger UI unificado: `/docs`
- JSON do módulo GLPI: `/docs-json/glpi`

Se você iniciar o módulo standalone, o prefixo base continua sendo `/glpi`.

## Exemplos `curl`

> Nos exemplos abaixo, ajuste o host e a porta conforme o ambiente. No app principal, o padrão costuma ser `http://localhost:3000`. No bootstrap standalone do módulo, a porta pode ser diferente.

### Health

```bash
curl http://localhost:3000/glpi/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "configured": true,
  "enabled": true,
  "missingRequired": [],
  "dbReachable": true,
  "timestamp": "2026-05-05T11:45:00.000Z"
}
```

### Chamados sem filtros

```bash
curl http://localhost:3000/glpi/chamados
```

### Chamados com filtros

```bash
curl "http://localhost:3000/glpi/chamados?data_inicio=2025-01-01&data_fim=2025-12-31&status=Novo,Fechado&tipo=Incidente"
```

### Inventário sem filtros

```bash
curl http://localhost:3000/glpi/inventario
```

### Inventário filtrado por origem

```bash
curl "http://localhost:3000/glpi/inventario?tipo_origem=computer"
```

### Custos sem filtros

```bash
curl http://localhost:3000/glpi/custos
```

### Custos filtrados por grupo

```bash
curl "http://localhost:3000/glpi/custos?grupo=DW"
```

## Formato de resposta

Todas as rotas de dados retornam o formato padrão:

```json
{
  "data": [
    {
      "id": 12345,
      "tipo": "Incidente",
      "titulo": "Sem acesso ao sistema",
      "data_abertura": "2025-05-01 08:30:00",
      "status": "Fechado",
      "solicitante": "Joao Silva",
      "descricao_categoria": "Rede / Internet",
      "grupo_equipe": "DW",
      "grupo_empresa": "DW",
      "nome_tecnico": "Maria Souza",
      "time_to_resolve": 120,
      "time_to_own": 90,
      "localizacao": "Matriz / TI",
      "cidade": "Teresina",
      "etiqueta": "VPN, Urgente"
    }
  ],
  "count": 1,
  "filters": {
    "data_inicio": "2025-01-01",
    "data_fim": "2025-12-31",
    "status": ["Novo", "Fechado"],
    "tipo": "Incidente"
  }
}
```

## Códigos de erro

| HTTP | Code | Quando ocorre |
| --- | --- | --- |
| 400 | `INVALID_FILTER` | Quando o filtro enviado é inválido, como data malformada ou valor fora da lista permitida. |
| 403 | `FORBIDDEN_ORIGIN` | Quando a origem não está liberada no CORS do módulo. |
| 503 | `GLPI_NOT_CONFIGURED` | Quando faltam variáveis obrigatórias no `.env`. |
| 503 | `GLPI_DISABLED` | Quando `GLPI_ENABLED=false`. |
| 503 | `DB_UNAVAILABLE` | Quando o banco GLPI está indisponível, lento ou recusando conexão. |

## Troubleshooting

### O módulo sempre retorna `503`

Verifique, nesta ordem:

1. Se `GLPI_ENABLED=true` no `.env`.
2. Se `GLPI_DB_HOST`, `GLPI_DB_USER`, `GLPI_DB_PASSWORD` e `GLPI_DB_NAME` estão preenchidos.
3. Se o banco MySQL do GLPI aceita conexão a partir da máquina onde a API está rodando.
4. Se o usuário do banco tem permissão de leitura na base correta.

Use o endpoint de health para confirmar o diagnóstico:

```bash
curl http://localhost:3000/glpi/health
```

### O navegador bloqueia a requisição por CORS

- Confira se a origem do front-end está presente em `GLPI_CORS_ORIGIN`.
- Verifique se a URL foi escrita exatamente como o navegador envia, incluindo protocolo e porta.
- Se estiver testando com `localhost`, confirme se a origem liberada é `http://localhost:...` e não apenas `localhost`.

### O filtro de data retorna `400`

- As datas devem seguir `YYYY-MM-DD`.
- Não envie hora, minuto ou timezone nos filtros `data_inicio` e `data_fim`.
- Exemplo válido: `2025-01-01`.
- Exemplo inválido: `01/01/2025`.

## Limitações conhecidas

- O módulo é **somente leitura**.
- Não há paginação.
- As datas são retornadas como strings ISO/SQL para simplificar o consumo JSON.
- O campo `etiqueta` depende do plugin Tag e da informação já cadastrada no GLPI.
- O filtro por empresa não é feito no backend; o consumidor deve usar os campos retornados.

## Referências

- PRD: [tasks/prd-modulo-glpi/prd.md](../../../tasks/prd-modulo-glpi/prd.md)
- Tech Spec: [tasks/prd-modulo-glpi/techspec.md](../../../tasks/prd-modulo-glpi/techspec.md)
