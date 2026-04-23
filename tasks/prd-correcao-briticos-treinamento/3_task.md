# Tarefa 3.0: File Cleanup Robusto - Limpeza de Arquivos Temporários

<complexity>MEDIUM</complexity>

## Visão Geral

Corrigir o cleanup de arquivos temporários no upload de evidências para garantir que arquivos sejam sempre removidos, mesmo em caso de falha. Capturar estado inicial do SharePoint para decisão de cleanup determinística.

<requirements>
1. Capturar estado inicial do SharePoint (enabled/disabled) no início da operação
2. Usar estado capturado para decisão de cleanup, não o estado atual
3. Garantir execução do cleanup mesmo em caso de exceção não esperada
4. Logar falhas de cleanup para investigação posterior
</requirements>

## Subtarefas

- [x] 3.1 Capturar `useSharePoint = isSharePointEnabled()` no início de `saveCollectiveTurmaEvidencias`
- [x] 3.2 Usar `useSharePoint` capturado na decisão de cleanup (não chamar `isSharePointEnabled()` novamente)
- [x] 3.3 Mover lógica de cleanup para bloco `finally` garantindo execução sempre
- [x] 3.4 Adicionar try-catch individual em cada operação de cleanup com log de falha
- [x] 3.5 Testar cenário: falha no meio do upload → arquivos temporários são limpos

## Detalhes de Implementação

Ver Tech Spec - Seção "Design de Implementação" e código de referência:

```typescript
// turmaController.ts - saveCollectiveTurmaEvidencias()
export const saveCollectiveTurmaEvidencias = asyncHandler(async (req: Request, res: Response) => {
  // ... validações iniciais ...

  const movedPaths: string[] = []
  // NOVO: Capturar estado no início
  const useSharePoint = isSharePointEnabled()  // ← Estado capturado aqui

  try {
    // ... processamento de arquivos ...

    if (!useSharePoint) {  // ← Usar estado capturado
      const relativeFolder = `turmas/${turmaId}/evidencias`
      await ensurePublicDir(relativeFolder)
    } else {
      await ensureSharePointFolder(collectiveSpFolder)
    }

    // ... upload dos arquivos ...

  } catch (error) {
    // NOVO: Cleanup no catch usando estado capturado
    if (!useSharePoint) {  // ← Estado capturado, não atual
      await Promise.allSettled(
        movedPaths.map((relativePath) => 
          fs.unlink(path.normalize(toFsPath(relativePath))).catch((err) => {
            console.warn({
              level: "WARN",
              event: "CLEANUP_FILE_FAILED",
              path: relativePath,
              error: err.message
            })
          })
        )
      )
    }

    throw error  // Re-lançar erro original
  } finally {
    // NOVO: Cleanup sempre executado no finally
    await Promise.allSettled(
      files.map((file) => 
        fs.unlink(file.path).catch((err) => {
          console.warn({
            level: "WARN",
            event: "CLEANUP_TEMP_FILE_FAILED",
            path: file.path,
            error: err.message
          })
        })
      )
    )
  }
})
```

## Critérios de Sucesso

- [x] Estado do SharePoint é capturado no início da operação
- [x] Cleanup de arquivos temporários executa sempre (sucesso ou falha)
- [x] Cleanup de arquivos movidos usa estado capturado (não estado atual)
- [x] Falhas de cleanup são logadas para investigação
- [x] 100% de arquivos temporários removidos após falhas simuladas

## Testes da Tarefa

- [x] **Teste de Unidade 1:** Simular falha no meio do upload, verificar que arquivos temporários são removidos
- [x] **Teste de Unidade 2:** Simular mudança de config SharePoint durante upload, verificar que cleanup usa estado inicial
- [x] **Teste de Unidade 3:** Simular falha no cleanup, verificar que erro é logado e não quebra a aplicação
- [x] **Teste de Integração:** Upload de evidência com falha simulada no SharePoint, verificar que temp files são limpos

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/treinamento/controllers/turmaController.ts` (linhas 191-268)
