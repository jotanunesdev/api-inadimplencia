# Tarefa 2.0: JSON Parser Safe - Tratamento de Erro em Tokens Coletivos

<complexity>LOW</complexity>

## Visão Geral

Adicionar tratamento seguro de JSON.parse nos tokens coletivos para evitar crashes da aplicação quando o payload for malformado. Implementar distinção clara entre tokens expirados e tokens malformados.

<requirements>
1. Adicionar try-catch em todos os JSON.parse relacionados a tokens coletivos
2. Retornar erro HTTP 400 com mensagem clara quando token for malformado
3. Logar tentativas de parsing inválido para auditoria de segurança
4. Garantir que tokens expirados sejam distinguidos de tokens malformados
</requirements>

## Subtarefas

- [ ] 2.1 Identificar todos os `JSON.parse` em `collectiveProofToken.ts` (linha 76)
- [ ] 2.2 Adicionar try-catch no parsing do payload do token
- [ ] 2.3 Criar erro específico `TOKEN_MALFORMED` (diferente de `TOKEN_EXPIRED`)
- [ ] 2.4 Retornar HTTP 400 com mensagem "Token de acesso inválido. Solicite um novo QR code ao instrutor."
- [ ] 2.5 Adicionar log estruturado para tentativas de parsing inválido

## Detalhes de Implementação

Ver Tech Spec - Seção "Design de Implementação" e código de referência:

```typescript
// collectiveProofToken.ts - parseCollectiveProofToken()
export function parseCollectiveProofToken(token: string) {
  const [payloadBase64, signature] = token.split(".")
  if (!payloadBase64 || !signature) {
    throw new HttpError(400, "Token de acesso inválido. Solicite um novo QR code ao instrutor.")
  }

  // NOVO: Try-catch no JSON.parse
  let parsed: Partial<CollectiveProofTokenPayload>
  try {
    const decoded = fromBase64Url(payloadBase64).toString("utf8")
    parsed = JSON.parse(decoded) as Partial<CollectiveProofTokenPayload>
  } catch {
    console.warn({
      level: "WARN",
      event: "COLLECTIVE_TOKEN_PARSE_FAILED",
      tokenPrefix: token.slice(0, 20) + "...",
      timestamp: new Date().toISOString()
    })
    throw new HttpError(400, "Token de acesso inválido. Solicite um novo QR code ao instrutor.")
  }

  // Validação de schema
  if (parsed.v !== 1 || !Array.isArray(parsed.cpfs) || !Array.isArray(parsed.trilhaIds)) {
    throw new HttpError(400, "Token de acesso inválido. Solicite um novo QR code ao instrutor.")
  }

  // ... resto da validação ...
  
  // Distinção: token expirado vs malformado
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    throw new HttpError(401, "Token expirado. Solicite um novo QR code ao instrutor.")
  }

  return payload
}
```

## Critérios de Sucesso

- [ ] Payload JSON malformado retorna HTTP 400 (não crasha aplicação)
- [ ] Token expirado retorna HTTP 401 (diferente de malformado)
- [ ] Log de segurança é gerado para tentativas de parsing inválido
- [ ] Mensagem de erro é clara para o usuário final
- [ ] Zero crashes não tratados por parsing de JSON malformado

## Testes da Tarefa

- [ ] **Teste de Unidade 1:** Token com payload base64 inválido → HTTP 400
- [ ] **Teste de Unidade 2:** Token com JSON válido mas schema inválido → HTTP 400
- [ ] **Teste de Unidade 3:** Token expirado → HTTP 401 (diferente de 400)
- [ ] **Teste de Unidade 4:** Token válido → parsing bem-sucedido
- [ ] **Teste de Integração:** Tentativa de acesso com token malformado, verificar log de segurança

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/treinamento/utils/collectiveProofToken.ts` (linhas 75-76)
