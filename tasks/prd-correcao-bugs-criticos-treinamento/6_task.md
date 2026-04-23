# Tarefa 6.0: Streaming Vídeos Range Request - Suporte a HTTP 206

<complexity>HIGH</complexity>

## Visão Geral

Criar novo endpoint específico para streaming de vídeos com suporte a HTTP Range Requests (206 Partial Content). Resolver erro 304 indevido e permitir seeking em vídeos armazenados no SharePoint.

<requirements>
1. Criar endpoint `/items/:itemId/stream` específico para vídeos com range request support
2. Implementar proxy de range requests para SharePoint (resposta 206 Partial Content)
3. Gerar headers `ETag` (hash do itemId + lastModified) e `Last-Modified` consistentes
4. Tratar `If-None-Match` → retornar 304 apenas quando ETag coincide
5. Tratar `Range` → retornar 206 com `Content-Range: bytes start-end/total`
6. Para requisições sem Range, retornar 200 com `Accept-Ranges: bytes`
</requirements>

## Subtarefas

- [ ] 6.1 Implementar `downloadSharePointFileRange()` em `sharePointService.ts` para proxy de ranges
- [ ] 6.2 Criar função `streamItemContent()` em `sectorFolderController.ts`
- [ ] 6.3 Adicionar validação de extensão de vídeo (mp4, mov, avi, mkv, webm, wmv, m4v)
- [ ] 6.4 Implementar geração de ETag baseado em `item.id + lastModifiedDateTime`
- [ ] 6.5 Implementar tratamento de `If-None-Match` para resposta 304 condicional
- [ ] 6.6 Implementar tratamento de `Range` com resposta 206
- [ ] 6.7 Adicionar rota `/items/:itemId/stream` em `sectorFolderRoutes.ts`
- [ ] 6.8 Testar seeking em vídeo MP4 (range requests sequenciais)
- [ ] 6.9 Verificar resposta 304 apenas quando apropriado

## Detalhes de Implementação

Ver Tech Spec - Seção "Correção Específica - Bug F6" para código completo.

**Nova função em sharePointService.ts:**

```typescript
export async function downloadSharePointFileRange(params: {
  itemId: string
  range: string
}): Promise<{
  data: Buffer
  contentRange: string
  status: 206 | 416
}> {
  const token = await getAccessToken()
  const { driveId } = await getDriveContext()
  
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${params.itemId}/content`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Range': params.range
      }
    }
  )
  
  if (response.status === 416) {
    return {
      data: Buffer.alloc(0),
      contentRange: 'bytes */0',
      status: 416
    }
  }
  
  const arrayBuffer = await response.arrayBuffer()
  const contentRange = response.headers.get('content-range') || ''
  
  return {
    data: Buffer.from(arrayBuffer),
    contentRange,
    status: 206
  }
}
```

**Nova função em sectorFolderController.ts:**

```typescript
export const streamItemContent = asyncHandler(async (req: Request, res: Response) => {
  // ... validações e contexto ...
  
  const { item } = await resolveFilePreviewContext({...})
  
  // Validar que é vídeo
  const isVideo = item.name?.match(/\.(mp4|mov|avi|mkv|webm|wmv|m4v)$/i)
  if (!isVideo) {
    throw new HttpError(400, "Este endpoint suporta apenas arquivos de vídeo.")
  }
  
  // Headers de cache
  const etag = `"${item.id}-${item.lastModifiedDateTime}"`
  const lastModified = new Date(item.lastModifiedDateTime).toUTCString()
  
  // If-None-Match
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).set({ 'ETag': etag, 'Last-Modified': lastModified }).end()
  }
  
  // Range Request
  if (req.headers.range) {
    const { data, contentRange, status } = await downloadSharePointFileRange({
      itemId: item.id,
      range: req.headers.range,
    })
    
    return res.status(status)
      .set({
        'Content-Type': item.file?.mimeType || 'video/mp4',
        'Content-Range': contentRange,
        'Content-Length': data.length,
        'Accept-Ranges': 'bytes',
        'ETag': etag,
        'Last-Modified': lastModified,
      })
      .send(data)
  }
  
  // Sem Range - retornar 200 com Accept-Ranges
  // ... (fallback para download completo)
})
```

**Nova rota em sectorFolderRoutes.ts:**

```typescript
router.get("/items/:itemId/stream", streamItemContent)
```

## Critérios de Sucesso

- [ ] Endpoint `/stream` retorna 206 Partial Content para range requests válidos
- [ ] Header `Content-Range` correto: `bytes start-end/total`
- [ ] Resposta 304 apenas quando `If-None-Match` coincide com ETag
- [ ] Header `Accept-Ranges: bytes` presente em todas as respostas
- [ ] Seeking funciona em vídeos MP4 no player
- [ ] Erro 304 indevido eliminado

## Testes da Tarefa (TDD - Testes antes da implementação)

- [ ] **Teste de Unidade 1 (RED):** Requisição com `Range: bytes=0-1023` → retorna 206 com Content-Range correto
- [ ] **Teste de Unidade 2 (RED):** Requisição com `If-None-Match` igual ao ETag → retorna 304
- [ ] **Teste de Unidade 3 (RED):** Requisição com `If-None-Match` diferente do ETag → retorna 200/206
- [ ] **Teste de Unidade 4 (RED):** Requisição sem Range → retorna 200 com `Accept-Ranges: bytes`
- [ ] **Teste de Integração 1:** Acessar vídeo via endpoint `/stream`, verificar que seeking funciona no player
- [ ] **Teste de Integração 2:** Recarregar página do player, verificar que 304 ocorre apenas quando ETag não mudou
- [ ] **Teste de Carga:** 10 usuários assistindo simultâneamente ao mesmo vídeo, verificar performance

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/treinamento/services/sharePointService.ts` (nova função)
- `src/modules/treinamento/controllers/sectorFolderController.ts` (linha 3451+, nova função)
- `src/modules/treinamento/routes/sectorFolderRoutes.ts` (nova rota)

## Observação sobre Acesso Direto ao SharePoint

Identificamos que alguns vídeos são acessados diretamente via `webUrl` do SharePoint (ex: `https://jotanunes.sharepoint.com/sites/AIAnalytics/...mp4`). Se o erro 304 persistir no acesso direto:

1. **Opção A:** Usar o endpoint `/stream` como proxy (implementado nesta task)
2. **Opção B:** Configurar CORS e headers de cache no SharePoint Online (requer admin)
3. **Opção C:** Usar URL pré-assinada (SAS) do SharePoint com tempo de expiração curto

A implementação desta task cobre a **Opção A**, que é a mais controlável no escopo do projeto.
