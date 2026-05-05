# Tarefa 1.0: Setup do módulo (dependência `mysql2`, esqueleto, env e pool)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>LOW</complexity>

Criar a base do módulo GLPI: instalar driver MySQL, montar a estrutura de pastas em `src/modules/glpi/`, definir o `.env.example`, implementar `config/env.js` (carregando `.env` raiz + `.env` do módulo, com prefixo `GLPI_`) e `config/db.js` (pool singleton `mysql2/promise`).

<requirements>
- Adicionar `mysql2 ^3.11` em `package.json` e rodar `npm install`.
- Criar diretório `src/modules/glpi/` com subpastas: `config/`, `controllers/`, `models/`, `routes/`, `middlewares/`, `utils/`, `docs/`, `__tests__/`.
- Criar `src/modules/glpi/.env.example` versionado com todas as variáveis (`GLPI_ENABLED`, `GLPI_DB_HOST`, `GLPI_DB_PORT`, `GLPI_DB_USER`, `GLPI_DB_PASSWORD`, `GLPI_DB_NAME`, `GLPI_QUERY_TIMEOUT_MS`, `GLPI_CORS_ORIGIN`).
- Garantir que `src/modules/glpi/.env` está coberto pelo `.gitignore` raiz.
- Implementar `config/env.js` exportando `env` com `DB_*`, `CORS_ORIGIN/ORIGINS/ALLOW_ALL`, `QUERY_TIMEOUT_MS`, `ENABLED`, `isConfigured` e `missingRequired` (mesmos campos que `swaggerAccess.js` espera).
- Implementar `config/db.js` exportando `getPool()` singleton com `connectionLimit:10`, `enableKeepAlive:true`, `dateStrings:true`, `timezone:'Z'`. Lançar erro estruturado se `!env.isConfigured`.
- Adicionar scripts `dev:glpi` e `start:glpi` no `package.json` (apontando para `src/modules/glpi/server.js` — o arquivo será criado na tarefa 7.0).
</requirements>

## Subtarefas

- [ ] 1.1 Adicionar `mysql2` ao `package.json` e rodar `npm install`.
- [ ] 1.2 Criar a árvore de pastas vazia em `src/modules/glpi/`.
- [ ] 1.3 Criar `.env.example` documentando cada variável com valor fictício seguro.
- [ ] 1.4 Confirmar/ajustar `.gitignore` para `src/modules/glpi/.env`.
- [ ] 1.5 Implementar `config/env.js` (CommonJS) com leitura via `dotenv` + `resolvePrefixedEnv('GLPI')` + cálculo de `missingRequired`.
- [ ] 1.6 Implementar `config/db.js` (CommonJS) com `getPool()` singleton e função auxiliar `pingPool()` (executa `SELECT 1` com timeout curto) para health check.
- [ ] 1.7 Adicionar scripts `dev:glpi` e `start:glpi` ao `package.json`.
- [ ] 1.8 Criar `__tests__/env.test.js` validando `isConfigured` em cenários: tudo preenchido, falta `GLPI_DB_HOST`, falta `GLPI_DB_PASSWORD`.

## Detalhes de Implementação

Ver seção "Configuração `.env`", "Pool de conexão" e "Componentes a criar" do `techspec.md`. O padrão de carregamento dual de `.env` deve espelhar `src/modules/estoque-online/config/env.ts`, mas em CommonJS (JS).

## Critérios de Sucesso

- `npm install` conclui sem erro com `mysql2` resolvido.
- `node -e "require('./src/modules/glpi/config/env').env"` imprime objeto com todas as chaves esperadas.
- Sem `.env` configurado, `env.isConfigured === false` e `env.missingRequired` lista as variáveis ausentes.
- Com `.env` válido apontado para um MySQL acessível (ou stub), `getPool()` retorna pool reutilizável (chamadas subsequentes retornam a mesma instância).

## Testes da Tarefa

- [ ] Testes de unidade — `__tests__/env.test.js`: cobre os três cenários de configuração (completo, faltando host, faltando senha) e parsing de `CORS_ORIGIN` (CSV → array minúsculo).
- [ ] Testes de integração — opcional nesta tarefa: validação manual `node -e "require('./src/modules/glpi/config/db').getPool().then(p => p.execute('SELECT 1')).then(console.log)"` (apenas em ambiente com MySQL configurado).

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `c:\api-inadimplencia\package.json`
- `c:\api-inadimplencia\.gitignore`
- `c:\api-inadimplencia\src\modules\glpi\.env.example`
- `c:\api-inadimplencia\src\modules\glpi\config\env.js`
- `c:\api-inadimplencia\src\modules\glpi\config\db.js`
- `c:\api-inadimplencia\src\modules\glpi\__tests__\env.test.js`
- Referência: `c:\api-inadimplencia\src\modules\estoque-online\config\env.ts`
- Referência: `c:\api-inadimplencia\src\shared\moduleEnv.js`
