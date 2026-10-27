# Usabilidade de comparação de preços

Pedido: filtrar por categoria e destacar variações de preço em uma lista longa.

- [x] Testar combinação categoria/busca/marca e cálculo da faixa de preços.
- [x] Adicionar filtro visível nas abas Meus preços e Região, com opção Sem categoria.
- [x] Limitar renderização inicial a 12 cards e permitir mostrar mais, com contagem.
- [x] Destacar menor/maior preço e variação em Meus preços com texto e cores.
- [x] Validar testes, tipos, build e revisão. Entrega na branch feat/compare-category-variation.

Definição: variação significa maior menos menor preço comparável no período;
percentual usa o menor como base. Não apresentar alta/queda temporal com os
agregados atuais. Preservar os filtros existentes e a aba Cesta.

Categorias são derivadas dos resultados consultados; filtro é local e não altera
o contrato das APIs. Resumo pessoal continua abrangendo período/mercado selecionados,
com aviso explícito quando busca/marca/categoria restringem apenas a lista.
Em telas estreitas, categoria aparece acima do produto para reservar largura aos preços.

Verificação: 15 testes de utilitários, 52 da API e 21 do frontend passaram;
typecheck do frontend e build web passaram. Revisão sem bloqueios. Não foi feita
conferência visual em navegador nesta entrega; validar no celular após publicação.
Atualização desta entrega requer frontend (`scripts/update-vps.sh web`).
