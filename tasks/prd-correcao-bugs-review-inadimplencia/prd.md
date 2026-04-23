# PRD — Correção de Bugs do Code Review (Inadimplência Front-End)

## Visão Geral

O módulo de Inadimplência apresenta **4 defeitos** identificados durante code review do front-end, impactando diretamente a experiência do usuário e a confiabilidade do sistema. Os problemas variam de dados desatualizados em ações críticas (início de atendimento) a mensagens ilegíveis, vazamento de memória e perda silenciosa de notificações em tempo real.

Este PRD define os requisitos para corrigir cada um desses defeitos, garantindo que o sistema funcione de forma previsível, estável e com informações corretas para todos os usuários.

**Documento de referência:** `Inadimplencia/src/main/jnc_inadimplencia/REVIEW.md`

## Objetivos

- **Eliminar comportamento incorreto no fluxo de atendimento**: garantir que a verificação de adimplência e o início de atendimento sempre utilizem dados atualizados, evitando decisões baseadas em estado obsoleto.
- **Corrigir mensagens de erro exibidas ao usuário**: assegurar que todas as strings exibidas estejam corretamente codificadas em UTF-8, sem caracteres corrompidos.
- **Prevenir vazamento de memória no cache de clientes**: garantir que o cache de busca por `numVenda` tenha limite de tamanho e não armazene resultados nulos permanentemente.
- **Garantir resiliência das notificações em tempo real**: assegurar que a conexão SSE se reconecte automaticamente após falhas de rede, sem exigir recarga manual da página.

### Métricas de sucesso

| Métrica | Situação atual | Meta |
|---|---|---|
| Atendimentos iniciados com dados obsoletos | Possível (stale closure) | Zero ocorrências |
| Mensagens com caracteres corrompidos visíveis | 1 ocorrência conhecida | Zero |
| Crescimento de memória em sessões longas (>2h) | Ilimitado | Estável (cache limitado) |
| Reconexão automática de SSE após queda | Não existe | Reconexão com backoff em até 30s |

## Histórias de Usuário

1. **Como** usuário do calendário interativo, **eu quero** que ao confirmar o início de um atendimento, a verificação de adimplência use sempre o status mais recente do cliente, **para que** eu não tome decisões baseadas em informações desatualizadas.

2. **Como** usuário que encontra um erro ao carregar detalhes de cliente, **eu quero** ver a mensagem de erro corretamente formatada, **para que** eu entenda o que aconteceu sem ver caracteres ilegíveis.

3. **Como** usuário que mantém o sistema aberto por longos períodos, **eu quero** que a aplicação não consuma memória crescente ao longo do tempo, **para que** o desempenho se mantenha estável durante toda a sessão.

4. **Como** usuário que depende de notificações em tempo real, **eu quero** que a conexão de eventos se reconecte automaticamente após uma queda de rede, **para que** eu não perca notificações importantes sem perceber.

## Funcionalidades Principais

### F1 — Correção de Stale Closure em `handleConfirmStartAttendance`

**O que faz:** Garante que o callback de confirmação de atendimento sempre referencie os valores mais recentes de `isClientAdimplente` e `handleStartAttendance`.

**Por que é importante:** O bug atual pode fazer com que o sistema ignore que um cliente se tornou adimplente (ou vice-versa) entre o momento da renderização e o clique do usuário, levando a ações incorretas no fluxo de atendimento.

**Requisitos funcionais:**

- **RF-1.1**: O callback `handleConfirmStartAttendance` deve sempre utilizar o valor atual de `isClientAdimplente` no momento da execução.
- **RF-1.2**: O callback `handleConfirmStartAttendance` deve sempre invocar a versão atual de `handleStartAttendance` no momento da execução.
- **RF-1.3**: A correção não deve introduzir re-renderizações desnecessárias no componente `InteractiveCalendar`.

---

### F2 — Correção de String UTF-8 Corrompida

**O que faz:** Corrige a mensagem de erro que exibe caracteres corrompidos (`possÃ­vel` → `possível`) no modal de detalhes do cliente.

**Por que é importante:** Mensagens ilegíveis prejudicam a confiança do usuário no sistema e dificultam a compreensão de erros.

**Requisitos funcionais:**

- **RF-2.1**: A mensagem de erro `setClientDetailError` deve exibir o texto "Não foi possível carregar detalhes do cliente." corretamente codificado.
- **RF-2.2**: Nenhuma outra string do componente deve apresentar problemas de codificação.

---

### F3 — Cache de Cliente com Limite e Expiração

**O que faz:** Implementa controle de tamanho e validade temporal no cache de busca de clientes por `numVenda`.

**Por que é importante:** Sem limite, o cache cresce indefinidamente em sessões longas, causando vazamento de memória. Além disso, resultados `null` cacheados permanentemente impedem que buscas falhas sejam refeitas.

**Requisitos funcionais:**

- **RF-3.1**: O cache não deve armazenar resultados `null` (falhas de busca).
- **RF-3.2**: O cache deve ter um limite máximo de entradas (ex.: 200) com política de evicção (ex.: LRU ou remoção da entrada mais antiga).
- **RF-3.3**: Cada entrada do cache deve ter um TTL (tempo de vida), após o qual a entrada é considerada expirada e uma nova busca é realizada.
- **RF-3.4**: O cache deve ser limpo ao desmontar o contexto relevante ou ao navegar para fora do módulo de inadimplência.

---

### F4 — Reconexão Automática de SSE (Notificações)

**O que faz:** Implementa lógica de reconexão automática com backoff exponencial para o `EventSource` de notificações em tempo real.

**Por que é importante:** Atualmente, se a conexão SSE cai (instabilidade de rede, timeout), o usuário perde todas as notificações até recarregar manualmente a página — sem nenhum feedback visual.

**Requisitos funcionais:**

- **RF-4.1**: Quando a conexão SSE falhar, o sistema deve tentar reconectar automaticamente.
- **RF-4.2**: As tentativas de reconexão devem usar backoff exponencial, iniciando em 1 segundo e com limite máximo de 30 segundos.
- **RF-4.3**: Ao reconectar com sucesso, o delay de retry deve ser resetado ao valor inicial.
- **RF-4.4**: O cleanup do `useEffect` deve encerrar tanto a conexão SSE quanto quaisquer timers de retry pendentes.
- **RF-4.5**: O usuário não deve precisar recarregar a página para restaurar as notificações após uma queda temporária de conexão.

## Experiência do Usuário

### Personas afetadas

- **Atendentes/Operadores**: Usam o calendário interativo para iniciar atendimentos e dependem de notificações em tempo real.
- **Gestores**: Monitoram o módulo e também recebem notificações.
- **Qualquer usuário do módulo**: Pode encontrar a mensagem de erro corrompida ou sofrer lentidão por vazamento de memória.

### Fluxos impactados

1. **Início de atendimento (F1)**: Usuário clica em "Confirmar Atendimento" → sistema verifica adimplência com dados atualizados → prossegue ou exibe alerta corretamente.
2. **Erro ao carregar detalhes (F2)**: Usuário tenta ver detalhes de cliente → requisição falha → mensagem de erro legível é exibida.
3. **Sessão prolongada (F3)**: Usuário mantém o sistema aberto por horas → memória permanece estável → buscas falhas anteriores podem ser refeitas.
4. **Notificações (F4)**: Rede cai momentaneamente → reconexão automática → notificações voltam sem intervenção do usuário.

### Requisitos de UI/UX

- Nenhuma alteração visual é necessária. As correções são comportamentais e transparentes ao usuário.
- A mensagem de erro corrigida (F2) já existe na UI — apenas o conteúdo textual muda.

## Restrições Técnicas de Alto Nível

- **Somente front-end**: Nenhuma alteração em APIs back-end ou contratos de dados.
- **Compatibilidade**: As correções devem manter compatibilidade com o restante do código existente do módulo de Inadimplência.
- **Sem dependências novas**: Preferencialmente, não adicionar bibliotecas externas para resolver estes problemas.
- **Performance**: A correção do cache (F3) não deve degradar o tempo de resposta das buscas por `numVenda`.

## Fora de Escopo

- **Refatoração geral do `InteractiveCalendar.tsx`**: Apenas as correções pontuais dos 4 bugs devem ser aplicadas. Não reorganizar, dividir ou reescrever o componente.
- **Novas funcionalidades**: Nenhuma feature nova deve ser incluída nesta entrega.
- **Alterações em APIs**: Contratos de back-end não devem ser modificados.
- **Testes automatizados**: Desejáveis mas não obrigatórios neste escopo.
- **Outros módulos**: Correções restritas ao módulo de Inadimplência front-end.

## Questões em Aberto

1. **Valor exato do TTL do cache (F3)**: O review sugere 60 segundos. Confirmar se esse valor é adequado para o padrão de uso real.
2. **Limite máximo do cache (F3)**: O review sugere 200 entradas. Validar se esse número é suficiente para sessões típicas.
3. **Feedback visual de reconexão SSE (F4)**: Deve haver algum indicador visual para o usuário quando as notificações estão desconectadas/reconectando? (Fora do escopo atual, mas vale considerar para iteração futura.)
4. **Outras strings com problemas de encoding (F2)**: O review identificou apenas uma ocorrência. Pode haver outras strings com dupla codificação UTF-8 que não foram detectadas.
