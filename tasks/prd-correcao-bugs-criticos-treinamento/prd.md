# PRD: Correção de Bugs Críticos - Módulo Treinamento

## Visão Geral

Este PRD documenta a correção de 6 bugs críticos identificados no módulo Treinamento da API Inadimplência. Esses bugs afetam a estabilidade, segurança e confiabilidade do sistema, podendo causar crashes, vazamento de recursos e comportamento inconsistente em cenários de concorrência.

**Problema central:** O módulo Treinamento possui vulnerabilidades de race conditions, tratamento de erro inadequado e gerenciamento de recursos que podem comprometer a experiência do usuário e a integridade dos dados.

## Objetivos

### Objetivos Primários
- **Eliminar race conditions** no cache de token SharePoint que causam múltiplas requisições de refresh simultâneas
- **Garantir tratamento de erro robusto** em operações de parsing JSON e conexão com banco de dados
- **Prevenir vazamento de recursos** (arquivos temporários, conexões) em casos de falha
- **Implementar observabilidade** para erros atualmente silenciados

### Métricas de Sucesso
- Zero crashes não tratados por parsing de JSON malformado
- 100% de coverage nos caminhos de erro do pool de conexões
- Tempo de vida útil do token SharePoint otimizado (sem requisições redundantes)
- 100% de arquivos temporários removidos após falhas
- Zero erros 304 indevidos em streaming de vídeos (seeking funciona corretamente)

### Indicadores Técnicos
- Latência de autenticação SharePoint reduzida em 50% (com cache otimizado)
- Zero memory leaks detectados em profilagem
- 99.9% de uptime do pool de conexões MSSQL
- 100% de range requests de vídeo respondidos com status 206 (Partial Content) correto

## Histórias de Usuário

### Como desenvolvedor do sistema
**EU QUERO** garantir que falhas de autenticação SharePoint sejam logadas e monitoradas  
**PARA QUE** eu possa diagnosticar problemas de integração sem depender de reportes manuais

### Como administrador do sistema
**EU QUERO** que o pool de conexões com o banco seja resiliente a falhas transitórias  
**PARA QUE** o sistema se recupere automaticamente sem intervenção manual

### Como usuário final
**EU QUERO** que uploads de evidências de treinamento funcionem de forma confiável  
**PARA QUE** meus arquivos não fiquem presos em estado inconsistente em caso de erro

### Como DevOps
**EU QUERO** que o cache de tokens seja thread-safe  
**PARA QUE** picos de tráfego não causem exaustão de quota de API externa

### Como aluno do treinamento
**EU QUERO** assistir vídeos de treinamento sem interrupções ou erros de carregamento  
**PARA QUE** eu possa completar meu treinamento sem frustração técnica

## Funcionalidades Principais

### F1: Correção de Race Condition no Token Cache SharePoint

**Descrição:** O cache de token SharePoint atualmente permite que múltiplas requisições concorrentes disparem refresh simultâneo, causando exaustão de quota e comportamento inconsistente.

**Requisitos Funcionais:**
1. **F1.1** Implementar mecanismo de lock/singleton que garanta apenas uma requisição de refresh por vez
2. **F1.2** Garantir que threads concorrentes aguardem a mesma Promise de refresh em vez de criarem novas
3. **F1.3** Manter TTL (time-to-live) do token respeitado para evitar requisições desnecessárias
4. **F1.4** Implementar teste de carga que verifique comportamento com 100+ requisições simultâneas

**Arquivos afetados:** `src/modules/treinamento/services/sharePointService.ts`

### F2: Tratamento Seguro de JSON.parse

**Descrição:** O parsing de tokens coletivos atualmente crasha a aplicação se o payload for malformado.

**Requisitos Funcionais:**
1. **F2.1** Adicionar try-catch em todos os JSON.parse relacionados a tokens coletivos
2. **F2.2** Retornar erro HTTP 400 com mensagem clara quando token for malformado
3. **F2.3** Logar tentativas de parsing inválido para auditoria de segurança
4. **F2.4** Garantir que tokens expirados sejam distinguidos de tokens malformados

**Arquivos afetados:** `src/modules/treinamento/utils/collectiveProofToken.ts`

### F3: Cleanup Robusto de Arquivos Temporários

**Descrição:** Em caso de falha durante upload de evidências, arquivos temporários podem não ser limpos se a configuração de SharePoint mudar durante a execução.

**Requisitos Funcionais:**
1. **F3.1** Capturar estado inicial do SharePoint (enabled/disabled) no início da operação
2. **F3.2** Usar estado capturado para decisão de cleanup, não o estado atual
3. **F3.3** Garantir execução do cleanup mesmo em caso de exceção não esperada
4. **F3.4** Logar falhas de cleanup para investigação posterior

**Arquivos afetados:** `src/modules/treinamento/controllers/turmaController.ts`

### F4: Resiliência do Pool de Conexões MSSQL

**Descrição:** O pool de conexões atualmente pode ficar em estado inválido permanentemente se a conexão inicial falhar.

**Requisitos Funcionais:**
1. **F4.1** Implementar retry exponencial com backoff para conexões iniciais
2. **F4.2** Resetar o poolPromise em caso de falha para permitir retry
3. **F4.3** Implementar health check do pool antes de retornar conexão
4. **F4.4** Adicionar métricas de pool: conexões ativas, ociosas, aguardando
5. **F4.5** Timeout configurável para aquisição de conexão do pool

**Arquivos afetados:** `src/modules/treinamento/config/db.ts`

### F5: Observabilidade de Erros Silenciados

**Descrição:** Falhas de concessão de permissão SharePoint são atualmente silenciadas sem logging, dificultando debugging.

**Requisitos Funcionais:**
1. **F5.1** Logar falhas de `grantSharePointFolderViewPermission` em nível WARN
2. **F5.2** Incluir contexto no log: usuário, email, timestamp, erro original
3. **F5.3** Garantir que o login do usuário não seja bloqueado por falha de permissão
4. **F5.4** Implementar métrica contador para falhas de permissão SharePoint

**Arquivos afetados:** `src/modules/treinamento/controllers/authController.ts`

### F6: Correção de Erro 304 em Streaming de Vídeos

**Descrição:** Usuários recebem erro HTTP 304 (Not Modified) ao tentar assistir vídeos de treinamento. Este erro ocorre quando o servidor de vídeo não gerencia corretamente os headers de cache (ETag, Last-Modified, If-None-Match) ou range requests para streaming parcial de conteúdo.

**Requisitos Funcionais:**
1. **F6.1** Implementar suporte adequado a HTTP Range Requests (bytes) para streaming de vídeos
2. **F6.2** Garantir que headers ETag e Last-Modified sejam gerados consistentemente para recursos de vídeo
3. **F6.3** Tratar corretamente requisições condicionais (If-None-Match, If-Modified-Since) retornando 304 apenas quando apropriado
4. **F6.4** Suportar resposta 206 (Partial Content) para requisições de range válidas
5. **F6.5** Garantir que o MIME type correto (video/mp4, etc.) seja retornado no header Content-Type
6. **F6.6** Implementar testes de integração verificando comportamento de cache e range requests

**Arquivos afetados:** `src/modules/treinamento/controllers/videoController.ts`, `src/modules/treinamento/routes/videoRoutes.ts`

**Nota:** Requer investigação do endpoint atual de streaming de vídeos para identificar a causa raiz do 304 indevido.

## Experiência do Usuário

### Impacto na Experiência
- **Estabilidade:** Elimina crashes inesperados durante operações de upload e autenticação
- **Performance:** Reduz latência de operações repetidas através de cache otimizado
- **Confiabilidade:** Garante que recursos sejam sempre limpos, mesmo em falha
- **Streaming:** Elimina erros 304 que impedem carregamento de vídeos, permitindo seeking fluido

### Mensagens de Erro
- Token malformado: "Token de acesso inválido. Solicite um novo QR code ao instrutor."
- Falha de conexão: "Erro temporário de conexão. Tente novamente em alguns segundos."
- Upload falho: "Não foi possível processar o arquivo. Tente novamente."
- Vídeo indisponível: "Não foi possível carregar o vídeo. Tente recarregar a página."

## Restrições Técnicas de Alto Nível

### Integrações Externas
- **Microsoft Graph API:** A correção do cache de token deve respeitar limites de rate da API
- **SharePoint Online:** Permissões devem ser concedidas de forma não-bloqueante

### Performance e Escalabilidade
- **Race Condition:** O mecanismo de lock não deve adicionar mais que 10ms de latência
- **Pool de Conexões:** Deve suportar 50 conexões simultâneas sem degradação
- **JSON Parsing:** Deve ser resistente a payloads de até 1MB malformados
- **Streaming de Vídeo:** Deve suportar múltiplas conexões de range requests simultâneas (seeking no player)
- **Buffer de Vídeo:** Responder a range requests em menos de 100ms para experiência fluida

### Segurança
- **Tokens:** Parsing seguro que não exponha informações sensíveis em logs de erro
- **Arquivos Temporários:** Garantir que paths sejam validados antes de operações de filesystem

### Monitoramento
- Métricas Prometheus/Grafana para: cache hit/miss, tempo de aquisição de conexão, falhas de permissão
- Logs estruturados (JSON) para integração com ELK/Loki

## Fora de Escopo

### Funcionalidades Excluídas
- **SQL Injection:** Bug identificado mas explicitamente excluído deste PRD por solicitação
- **Refatoração completa do SharePointService:** Focar apenas no cache de token, não em toda a integração
- **Migração para ORM:** Manter queries SQL atuais, apenas melhorar gerenciamento de conexão
- **Rate limiting no WebSocket:** Pertence ao módulo PM2, não ao Treinamento
- **Migração para CDN:** Correção focada no servidor atual, não em migração para serviço CDN externo

### Limites
- Correções aplicam-se apenas ao módulo Treinamento
- Não inclui migração de código JavaScript para TypeScript
- Não inclui criação de novas funcionalidades, apenas correções de bugs

## Questões em Aberto

1. **Q1:** O pool de conexões (`db.ts`) é compartilhado com outros módulos? Se sim, as correções devem ser propagadas?
2. **Q2:** Existe monitoramento atual (APM) que deve ser integrado com as novas métricas?
3. **Q3:** Qual é o volume esperado de requisições simultâneas no pico? (para configuração do pool)
4. **Q4:** Existe ambiente de staging disponível para teste de carga?
5. **Q5:** Qual endpoint atual serve os vídeos e qual servidor de streaming é usado (Node.js, CDN, etc.)?
6. **Q6:** O erro 304 ocorre em todos os vídeos ou apenas em condições específicas (tamanho, formato, navegador)?

---

## Referências aos Bugs

| ID | Bug | Arquivo | Severidade |
|----|-----|---------|------------|
| B1 | Condição de Corrida no Token Cache | `sharePointService.ts:57-172` | Crítica |
| B2 | JSON.parse sem Try-Catch | `collectiveProofToken.ts:75-76` | Crítica |
| B3 | Cleanup Condicional Incorreto | `turmaController.ts:247-250` | Crítica |
| B4 | Pool Sem Tratamento de Erro | `db.ts:17-25` | Crítica |
| B5 | Erro Silencioso | `authController.ts:33-35` | Crítica |
| B6 | Erro 304 em Streaming de Vídeos | `videoController.ts` (investigar) | Crítica |

---

*Documento criado em: 17/04/2026*  
*Próximo passo: Criação da Tech Spec com detalhes de implementação*
