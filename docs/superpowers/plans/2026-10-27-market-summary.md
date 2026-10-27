# Resumo do mercado coerente com histórico

Problema relatado: Guanabara apresenta total e contagem zerados, enquanto uma
compra de R$ 1.060,81 já aparece no histórico.

- [x] Reproduzir resumo zerado ao excluir compra de outro criador em lista compartilhada.
- [x] Aplicar o mesmo predicado de acesso do histórico, preservando o acesso ao mercado.
- [x] Conferir total final, contagem, ticket médio, última compra e produto efetivamente comprado.
- [x] Atualizar o cache market-summary ao finalizar/excluir/limpar compras e ao reabrir a tela.
- [x] Concluir build, testes completos, tipos e revisão. Entrega na branch fix/market-shared-summary.

Regressões: teste de serviço passou de R$ 0 para R$ 1.060,81, uma compra e ticket
de R$ 1.060,81. Depois detectou produto pendente no ranking; corrigido para usar
itens com preço pago positivo, conforme a definição de carrinho do app.
Teste com QueryClient real confere invalidação e recarregamento do detalhe do mercado.
Revisão sem bloqueios. Não houve acesso à conta ou ao banco de produção.
Verificação completa: 15 testes de utilitários, 52 da API e 20 do frontend passaram,
assim como typecheck completo e build web.

Depois de publicar API e frontend (`scripts/update-vps.sh all`), abrir novamente
o mercado e comparar os números com o histórico. O vínculo é pelo ID do mercado;
cadastros diferentes com o mesmo nome não são mesclados por esta correção.
