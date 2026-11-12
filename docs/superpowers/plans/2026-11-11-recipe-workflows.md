# Fluxos visíveis de receitas

Escopo: receitas acessíveis no aplicativo, sugestão pelo estoque confirmado, conferência de compras recentes e criação de nova lista por receita/porções. O schema anterior sozinho não entregava esses fluxos.

Implementar módulo Nest autenticado: receitas próprias privadas (cadastro), catálogo público publicado, ingredientes, preview e lista; despensa privada e confirmação idempotente de linha de compra acessível. Não publicar automaticamente receitas de usuários nem importar compras como estoque sem confirmação.

Interface: entrada na Home, Listas e planejador; página Receitas com busca, sugestões, cadastro privado, despensa e compras recentes; detalhe com porções, preparo, cobertura de ingredientes e geração de nova lista. Sem dados falsos no catálogo de produção. Catálogo vazio permite cadastrar receita própria e informa a falta de conteúdo.

Regras: estoque em g/ml/un; converter somente equivalências explícitas; confirmar produto/ingrediente quando nome não é associado; não inferir conteúdo de pacotes. Somar ingredientes repetidos antes de descontar estoque. Quantidades desconhecidas bloqueiam geração, sem tratar como zero. Sugestões mostram cobertura de ingredientes, não certificam restrições alimentares.

Testar cálculos, permissão de receitas, isolamento da despensa, idempotência, confirmação apenas de compras finalizadas acessíveis e criação de lista sem alterar listas anteriores. Sem migration nova. Avaliações, publicação/moderação e compartilhamento comunitário permanecem módulo posterior.

## Ampliação solicitada durante a execução: meta diária de calorias

Adicionar kcal por porção e origem declarada ao cadastro/importador. O valor é informado pelo autor e não auditado; valores ausentes não são inferidos. Referência de interpretação de porções: https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label . Não há recomendação de meta pessoal nem de adequação nutricional.

Usuário informa sua própria meta para uma pessoa, período de 1 a 14 dias, data inicial, distribuição editável entre refeições e receitas permitidas. Cada receita precisa de energia conhecida e classificação da refeição. Algoritmo escolhe por proximidade da meta, usando 0,25 a 4 porções em passos de 0,25. Mostra total real e diferença; divergências exigem aceitação explícita antes de salvar.

Consolidar todos os ingredientes de todos os dias, descontar estoque uma única vez, criar lista nova e salvar cardápio na mesma transação. Guardar títulos/energia planejada como snapshots; estoque não sofre baixa automática. Nenhum fator demográfico altera a meta calórica informada.

A ampliação exige migration aditiva `20261111000300_recipe_calorie_planning`, aplicada apenas no PostgreSQL local nesta execução. A afirmação inicial de ausência de migration era para o escopo anterior à solicitação calórica.
# Validação final

- Build completo aprovado; 31 testes de utilitários, 90 de API, 4 de importação e 37 de frontend passaram.
- Integração HTTP com PostgreSQL local aprovada: privacidade, confirmação concorrente de compra, preservação de listas, meta de 1600 kcal e ingredientes consolidados com estoque descontado uma vez.
- Revisão independente concluída; associação de ingredientes na confirmação de compras também restringida ao catálogo acessível da conta, com cenário de teste.
- API e frontend responderam HTTP 200 localmente. Verificação visual ficou pendente: ferramenta de computador interrompeu por não identificar a URL do Chrome com confiança.
- Migration aplicada somente no PostgreSQL local. A VPS precisa do deploy completo com migrations.
