# Tarefa 5.0: Observabilidade SharePoint - Logging de Falhas de Permissão

<complexity>LOW</complexity>

## Visão Geral

Adicionar observabilidade para erros atualmente silenciados nas falhas de concessão de permissão SharePoint. Garantir que falhas sejam logadas sem bloquear o login do usuário.

<requirements>
1. Logar falhas de `grantSharePointFolderViewPermission` em nível WARN
2. Incluir contexto no log: usuário, email, timestamp, erro original
3. Garantir que o login do usuário não seja bloqueado por falha de permissão
4. Implementar métrica contador para falhas de permissão SharePoint
</requirements>

## Subtarefas

- [ ] 5.1 Modificar `tryGrantSharePointPermission()` em `authController.ts`
- [ ] 5.2 Adicionar log estruturado WARN quando `grantSharePointFolderViewPermission` falha
- [ ] 5.3 Incluir no log: CPF, email, timestamp, mensagem de erro
- [ ] 5.4 Garantir que `.catch()` não re-lança erro (login continua)
- [ ] 5.5 Adicionar métrica `sharepoint_permission_grant_failures_total` (para Prometheus)

## Detalhes de Implementação

Ver Tech Spec - Seção "Design de Implementação" e código de referência:

```typescript
// authController.ts
function tryGrantSharePointPermission(email: string | null) {
  if (!email || !isSharePointEnabled()) return
  
  grantSharePointFolderViewPermission({ userEmail: email }).catch((error) => {
    // NOVO: Log estruturado em vez de silenciar
    console.warn({
      level: "WARN",
      event: "SHAREPOINT_PERMISSION_GRANT_FAILED",
      email: email,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
    
    // NOVO: Métrica para Prometheus (se sistema de métricas existir)
    // metrics.sharepointPermissionGrantFailures.inc({ reason: error.code || 'unknown' })
    
    // IMPORTANTE: Não re-lançar erro - login não deve ser bloqueado
  })
}
```

**Uso em login e primeiro acesso:**

```typescript
// No controller de login
export const login = asyncHandler(async (req: Request, res: Response) => {
  // ... validações e autenticação ...
  
  // Extrair email do pfunc
  const email = extractEmailFromPFunc(pfunc as Record<string, string>)
  
  // Conceder permissão (não bloqueia login se falhar)
  tryGrantSharePointPermission(email)
  
  res.json({ user: safeUser })
})

// No controller de primeiro acesso
export const firstAccess = asyncHandler(async (req: Request, res: Response) => {
  // ... validações e criação de senha ...
  
  const email = extractEmailFromPFunc(pfunc as Record<string, string>)
  tryGrantSharePointPermission(email)
  
  res.status(201).json({ user: sanitizeUser(user) })
})
```

## Critérios de Sucesso

- [ ] Falhas de `grantSharePointFolderViewPermission` são logadas em WARN
- [ ] Log inclui contexto: email, timestamp, mensagem de erro
- [ ] Login do usuário continua funcionando mesmo quando permissão falha
- [ ] Métrica contador disponível (ou log estruturado parseável)
- [ ] 100% de falhas de permissão são observáveis nos logs

## Testes da Tarefa

- [ ] **Teste de Unidade 1:** Simular falha de permissão, verificar que log WARN é gerado
- [ ] **Teste de Unidade 2:** Verificar que após falha de permissão, função retorna sem erro (não re-lança)
- [ ] **Teste de Unidade 3:** Verificar que log inclui todos os campos obrigatórios (email, timestamp, erro)
- [ ] **Teste de Integração:** Executar login com usuário válido mas falha simulada no SharePoint, verificar que:
  - Login retorna sucesso (200)
  - Log de warning é gerado
  - Usuário recebe token de autenticação normalmente

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/treinamento/controllers/authController.ts` (linhas 31-36)
