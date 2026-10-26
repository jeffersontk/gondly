# Roadmap de evolução do Gondly

Atualizado em 26/10/2026. Plano de execução proposto para as próximas entregas.
Os números representam a ordem das entregas, não alterações já feitas na versão do pacote.

## Objetivo

Atrair usuários para o Gondly, garantir confiança na compra compartilhada e ampliar
o valor do histórico de preços. Priorizar melhorias que possam ser verificadas com
testes e uso real antes de aumentar o número de funcionalidades.

## Situação de partida

- Listas compartilhadas, compras colaborativas, histórico de preços, comparação,
  lembretes de finalizar compra, anúncios e benefício sem anúncios já existem.
- Correção de inclusão de itens na compra em andamento entregue em `dd43978`.
- Script de atualização da VPS entregue em `a56d87e`.
- Base técnica de SEO entregue na branch `feat/seo-google`, commit `ed4bf9d`.
- A verificação DNS do Search Console foi iniciada; confirmação ainda pendente.
- O deploy do SEO e a validação HTTP em produção precisam ser registrados como evidência.
- Blog com estrutura disponível, mas sem artigos publicados na última análise do código.

## Ordem e dependências

| Entrega | Prioridade | Depende de | Resultado esperado |
| --- | --- | --- | --- |
| V1 — SEO e medição | P0 | Acessos à VPS, DNS e Search Console | Site publicado, rastreável e com acompanhamento |
| V2 — Conteúdo e descoberta | P1 | V1 validada | Primeiros conteúdos úteis e caminhos até o app |
| V3 — Confiabilidade da colaboração | P0 | Correção atual publicada | Compra compartilhada consistente mesmo com reconexões |
| V4 — Planejamento de gastos | P1 | V3 e regras de preços definidas | Orçamento e estimativa compreensíveis |
| V5 — Histórico e comparação | P1 | V4 e dados de preço consistentes | Comparações úteis e transparentes |
| V6 — Compras recorrentes | P2 | V3 e evidências de uso recorrente | Menos trabalho para preparar a próxima compra |
| V7 — Operação e suporte | P1 | Base operacional iniciada na V1 | Deploy recuperável e suporte com contexto |

Fluxo principal: **V1 → V3 → V4 → V5 → V6**. Conteúdo da V2 pode avançar em paralelo
após a V1. A V7 deve ser antecipada se surgirem falhas operacionais; backups e
observação básica de erros começam na V1, não ficam para o fim.
Sem calendário fixo: estimar cada entrega após detalhar suas tarefas e dependências.

## V1 — Publicar SEO e estabelecer medição

**Responsáveis:** Codex prepara código e verificações; responsável pelo projeto
conclui acessos, verificação da propriedade e execução na VPS quando necessário.

- [ ] Confirmar o TXT DNS e concluir a verificação de `gondly.com.br` no Search Console.
- [ ] Confirmar o deploy do commit de SEO e registrar o commit efetivamente publicado.
- [ ] Conferir home com conteúdo no HTML, canonical correto e dados estruturados.
- [ ] Conferir URL inexistente com HTTP 404 e rotas privadas com `noindex`.
- [ ] Testar login Google, links públicos e instalação/abertura do PWA após o deploy.
- [ ] Enviar sitemap e solicitar inspeção/indexação da home e dos dois guias.
- [ ] Confirmar eventos existentes: `sign_up`, `create_list`, `start_purchase` e `finish_purchase`.
- [ ] Registrar a linha de base de indexação, impressões, cliques e uso do app, com período e fonte.
- [ ] Conferir backup do banco e identificar onde consultar erros da API e do frontend.

**Concluída quando:** verificações de produção documentadas, Search Console verificado,
sitemap recebido sem erro de leitura e eventos principais conferidos. A decisão de
indexação do Google não é um bloqueio para iniciar a V3.

**Evidência:** URLs testadas, respostas HTTP, commit publicado e resultado do Search Console.
Referências: [deploy](../DEPLOY.md) e [plano técnico de SEO](superpowers/plans/2026-10-26-seo-google.md).

## V2 — Publicar conteúdo e facilitar a descoberta

- [ ] Selecionar três temas iniciais: lista semanal, compras mensais e comparação por unidade.
- [ ] Produzir três artigos originais, revisar exemplos e preencher autoria, revisão e datas reais.
- [ ] Publicar gradualmente, com links para os guias e uma ação clara para começar uma lista.
- [ ] Criar uma primeira página pública de modelo de lista, útil mesmo sem login.
- [ ] Permitir usar esse modelo no app após autenticação, preservando a intenção de quem começou.
- [ ] Conferir HTML público, sitemap, links e ausência de rascunhos no build.
- [ ] Revisar consultas e páginas no Search Console para escolher os próximos temas.

**Concluída quando:** três artigos revisados e um modelo público estiverem publicados,
com links funcionais e caminho de criação da lista validado.

**Acompanhar:** impressões e cliques orgânicos por página, acesso aos modelos e criação de listas.
Não inventar preços atuais, depoimentos ou promessas de economia.
Referência: [publicação de conteúdo](conteudo-publico.md).

## V3 — Tornar a colaboração confiável

- [ ] Reproduzir os fluxos com duas contas e dispositivos diferentes.
- [ ] Mostrar estados de conexão, reconexão e alterações locais ainda pendentes.
- [ ] Validar inclusão, edição, remoção e mudança de estado durante a compra.
- [ ] Definir comportamento para edições simultâneas do mesmo item e informar conflitos relevantes.
- [ ] Testar perda de conexão, bloqueio da tela, retorno ao app e reconexão.
- [ ] Garantir que a recuperação não duplique itens nem descarte mudanças silenciosamente.
- [ ] Ampliar testes de ponta a ponta para os cenários críticos e permissões revogadas.

**Concluída quando:** duas contas convergem para os mesmos itens e totais após os
cenários de teste; pendências e falhas ficam visíveis; nenhum cenário conhecido
de perda silenciosa de dados permanece aberto.

**Acompanhar:** falhas de sincronização, tempo de recuperação e pendências não resolvidas.
Definir metas numéricas depois de medir a linha de base.

## V4 — Planejar o gasto antes do caixa

- [ ] Definir orçamento opcional por compra e quem pode alterá-lo em compras compartilhadas.
- [ ] Exibir gasto confirmado, estimativa dos itens restantes e saldo do orçamento separadamente.
- [ ] Usar histórico compatível de produto, unidade e embalagem para estimar preços.
- [ ] Informar origem/data da referência e quantidade de itens sem preço conhecido.
- [ ] Alertar ao ultrapassar o limite, sem impedir a conclusão da compra.
- [ ] Validar cálculo com peso, volume, quantidades fracionadas, descontos e dados ausentes.

**Concluída quando:** estimativa não se confunde com valor pago, totais são calculados
consistentemente no backend e todos os participantes veem o mesmo orçamento.

**Acompanhar:** uso do orçamento e diferença entre estimativa e valor final nas compras
com dados suficientes; não tratar preço ausente como produto gratuito.

## V5 — Melhorar histórico e comparação

- [ ] Exibir evolução do preço por produto, com período e unidade de comparação claros.
- [ ] Mostrar data da referência, mercado e origem pessoal ou agregada dos dados.
- [ ] Diferenciar produtos equivalentes de alternativas de marca ou embalagem.
- [ ] Expandir relatórios por mercado e categoria, com filtros de período.
- [ ] Permitir exportar o histórico pessoal em CSV, com valores e datas consistentes.
- [ ] Validar autorização, amostras pequenas e proteção de dados de outros usuários.

**Concluída quando:** usuário consegue entender o que está sendo comparado, avaliar
a atualidade dos dados e exportar apenas informações às quais tem acesso.

**Acompanhar:** uso das comparações, cobertura de preços e registros antigos ou incompletos.

## V6 — Facilitar compras recorrentes

- [ ] Entrevistar usuários recorrentes e identificar reposições que geram trabalho repetitivo.
- [ ] Definir listas recorrentes com revisão antes de iniciar outra compra.
- [ ] Sugerir itens frequentes com explicação e opção de remover ou dispensar sugestões.
- [ ] Criar lembretes de reposição com frequência escolhida pelo usuário.
- [ ] Reaproveitar a infraestrutura de push existente, respeitando preferências e horários.
- [ ] Validar cancelamento, falta de permissão e prevenção de notificações duplicadas.

**Concluída quando:** é possível preparar e revisar a próxima lista, controlar os
lembretes e interromper recorrências sem duplicação de itens ou compras.

**Acompanhar:** retorno ao app, reutilização das listas e desativação de lembretes.

## V7 — Operação e suporte

- [ ] Centralizar erros com contexto técnico e identificadores de requisição, sem tokens ou conteúdo privado.
- [ ] Adicionar monitoramento de disponibilidade e alertas acionáveis para o responsável.
- [ ] Automatizar retenção de backups e testar restauração em ambiente isolado.
- [ ] Ampliar o script de deploy com registro de versão e procedimento de rollback.
- [ ] Tratar separadamente rollback de aplicação e compatibilidade de migrations.
- [ ] Oferecer canal de feedback no app com envio explícito pelo usuário.
- [ ] Documentar procedimentos para indisponibilidade, falha de login e erro de sincronização.

**Concluída quando:** restauração e recuperação de uma versão falha foram ensaiadas,
alertas chegam ao responsável e existe um procedimento de atendimento utilizável.

**Acompanhar:** disponibilidade, tempo de recuperação e recorrência de incidentes.

## Como executar cada entrega

1. Escolher a próxima entrega e conferir os bloqueios externos.
2. Detalhar apenas essa entrega em tarefas menores, com critérios e estimativa.
3. Criar branch a partir da base de produção confirmada e atualizada.
4. Implementar e verificar comportamento, permissões, dados e compatibilidade de deploy.
5. Revisar e publicar; tarefas só recebem `[x]` após evidência de conclusão.
6. Executar verificações na VPS e registrar commit, resultados e pendências neste documento.
7. Avaliar dados e relatos reais antes de ampliar o escopo da próxima versão.

Para mudanças de código, rodar os testes pertinentes, typecheck e build; para o
frontend público, incluir os testes dos artefatos gerados. Reutilizar os comandos
do repositório e as instruções de deploy, sem transformar toda tarefa editorial
ou documental em alteração de código.

## Próxima sessão de trabalho

**Começar pela V1:** confirmar verificação do domínio, deploy do frontend e respostas
HTTP. Em seguida, preparar os cenários de duas contas da V3. Não iniciar orçamento
ou recorrência antes de estabilizar a colaboração.

## Referências

- [Eventos existentes e regras de privacidade](analytics-events.md).
- [Google: princípios básicos de SEO](https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=pt-br).
- [Google: inspeção de URL](https://support.google.com/webmasters/answer/9012289?hl=pt-BR).
