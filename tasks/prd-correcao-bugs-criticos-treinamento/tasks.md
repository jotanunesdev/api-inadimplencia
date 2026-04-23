# Resumo de Tarefas de Implementação - Correção de Bugs Críticos

## Tarefas

- [ ] 1.0 Token Cache Lock - Race Condition SharePoint (Complexidade: MEDIUM)
- [ ] 2.0 JSON Parser Safe - Tratamento de Erro em Tokens Coletivos (Complexidade: LOW)
- [x] 3.0 File Cleanup Robusto - Limpeza de Arquivos Temporários (Complexidade: MEDIUM)
- [x] 4.0 Connection Pool Resilience - Retry e Health Check MSSQL (Complexidade: HIGH)
- [ ] 5.0 Observabilidade SharePoint - Logging de Falhas de Permissão (Complexidade: LOW)
- [ ] 6.0 Streaming Vídeos Range Request - Suporte a HTTP 206 (Complexidade: HIGH)

## Sequência de Execução

```
4.0 (Pool) → 1.0 (Token) → 2.0 (JSON) → 3.0 (Cleanup) → 6.0 (Streaming)
                                    ↓
                              5.0 (Logging - paralelo)
```

**Dependências:**
- 4.0 deve ser primeira (base para testes)
- 1.0 depende de 4.0 (usa conexão com banco)
- 3.0 depende de 1.0 (usa SharePoint funcional)
- 6.0 pode ser paralelo a 3.0
- 2.0 e 5.0 são independentes, podem rodar a qualquer momento

## Resumo por Bug

| Bug | Task | Arquivo Principal | Métrica de Sucesso |
|-----|------|-------------------|-------------------|
| B1 | 1.0 | `sharePointService.ts` | 100 req simultâneas → 1 refresh |
| B2 | 2.0 | `collectiveProofToken.ts` | Zero crashes em JSON malformado |
| B3 | 3.0 | `turmaController.ts` | 100% arquivos limpos após falha |
| B4 | 4.0 | `db.ts` | 99.9% uptime pool, retry funciona |
| B5 | 5.0 | `authController.ts` | 100% falhas logadas em WARN |
| B6 | 6.0 | `sectorFolderController.ts` | Seeking funciona, 304 correto |

## Observações

- **Tarefas 4.0 e 6.0** são HIGH complexity - seguir TDD (testes antes da implementação)
- **Tarefas 2.0 e 5.0** são LOW complexity - podem ser feitas rapidamente
- **Todas as tarefas** devem ter testes de unidade e integração conforme template
