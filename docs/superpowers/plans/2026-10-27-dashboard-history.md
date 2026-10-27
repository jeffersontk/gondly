# Resumo coerente com histórico

Problema: histórico mostra R$ 1.060,81 + R$ 22,95 em outubro, mas resumo e última
compra mostram apenas R$ 22,95. Investigar sem alterar valores das compras.

Causas reproduzidas no código: relatórios filtram pelo proprietário enquanto o
histórico inclui compras compartilhadas; cache do resumo não é invalidado ao
finalizar/remover compras e não refaz a consulta ao retornar à tela.

- [x] Reproduzir o total esperado R$ 1.083,76, duas compras e última compra compartilhada.
- [x] Aplicar aos relatórios o mesmo predicado de acesso do histórico, preservando filtros.
- [x] Testar atualização real do QueryClient e carregamento do resumo ao voltar à home.
- [x] Invalidar relatórios após finalizar/excluir/limpar histórico e evento de conclusão compartilhada.
- [x] Executar testes, tipos, build e revisão. Entrega na branch fix/dashboard-shared-history.

Escopo: compras concluídas e não excluídas que o usuário pode ver; cada compra
conta uma vez, pelo valor final pago. Não dividir valores entre participantes nem
incluir compras ativas/canceladas. Sem migration ou edição de dados de produção.

Verificação: teste de regressão retornou R$ 22,95 antes da correção e R$ 1.083,76
depois; 15 testes de utilitários, 50 da API e 20 do frontend passaram. Build web,
typecheck completo e revisão passaram. Os valores dos prints foram reproduzidos
em fixture; não houve acesso ao banco de produção nem conferência da conta ao vivo.

Após publicar API e frontend (`bash scripts/update-vps.sh all`), abrir novamente
a home, comparar o resumo com compras concluídas do mês no histórico e conferir
a última compra. Confirmar também a atualização após finalizar ou excluir uma
compra em cenário de teste e com participante de uma lista compartilhada.
