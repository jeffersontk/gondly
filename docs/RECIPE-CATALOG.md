# Catálogo de receitas e despensa

## Entregue nesta etapa

Schema Prisma, importador administrativo e fluxos autenticados em `/app/recipes`: cadastro de receita privada, consulta de catálogo publicado, despensa, confirmação de compras recentes, sugestão por disponibilidade, lista por receita e cardápio por meta diária informada pelo usuário. Publicação comunitária, compartilhamento por token e avaliações ainda não têm telas/endpoints nesta entrega.

| Entidade | Finalidade |
| --- | --- |
| Ingredient / IngredientAlias | Identidade global e nomes alternativos normalizados, sem confundir marcas com ingredientes |
| Recipe / RecipeStep | Receita, porções, tempos, origem, autoria, estado editorial e instruções ordenadas |
| RecipeIngredient | Quantidade/unidade, ingrediente opcional, nota e quantidade-base conhecida ou nula |
| RecipeTag | Tags classificadas em dieta, alérgeno ou refeição; não são certificações nutricionais |
| RecipeReview | Nota de 1 a 5, comentário opcional, moderação e unicidade por receita/usuário |
| PantryItem / PantryMovement | Saldo confirmado por usuário e deltas rastreáveis em unidade-base |
| MealPlan / MealPlanRecipe | Período planejado, data, refeição, receita e porções |

`Product`, `MarketListItem` e `PurchaseItem` agora aceitam `ingredientId` opcional. Registros antigos permanecem sem associação; não existe matching automático por nome nesta etapa.

## Alimentar o catálogo

Pesquisa inicial: [45 receitas e preparos para todas as refeições](research/2026-11-11-recipe-catalog-research.md), com [manifesto de fontes](research/2026-11-11-recipe-shortlist.json). Esse manifesto é uma curadoria de referências, não um lote importável; as fichas culinárias e energéticas ainda precisam ser preparadas e revisadas.

Use como formato inicial [example.json](../apps/api/prisma/recipes/example.json). O exemplo é um rascunho técnico, não uma receita culinária validada. Todas as referências de ingrediente de um lote devem estar declaradas nesse mesmo JSON.

Na pasta `apps/api`, valide sem acessar o banco:

```bash
npm run recipes:import -- prisma/recipes/example.json
```

Para gravar, defina `DATABASE_URL` explicitamente no ambiente para o banco desejado e acrescente `--write`:

```bash
npm run recipes:import -- caminho/catalogo.json --write
```

O importador não carrega `.env` automaticamente. O catálogo inteiro é validado e gravado em uma transação. Slugs existentes são atualizados; etapas e ingredientes daquela receita são substituídos. Receitas omitidas no lote não são excluídas. Aliases antigos são preservados. A unidade-base de um ingrediente existente não pode ser alterada. Não importe slugs de receitas pertencentes a usuários.

Receitas entram como `draft` e `private` por padrão. Para publicar administrativamente, informe `status: "published"`, `visibility: "public"`, `reviewedBy`, `reviewedAt` e `publishedAt` (datas ISO completas). Não invente revisores nem declare testes não realizados. A origem `imported` exige URL HTTPS e atribuição; isso não concede direitos de reprodução. `ai_assisted` identifica auxílio de IA. Autores, tokens e avaliações não podem ser definidos pelo JSON administrativo.

## Unidades e estoque

Cada ingrediente possui unidade-base `g`, `ml` ou `un`. O importador converte apenas kg→g, L→ml e unidades idênticas. Uma unidade de tomate não vira um peso estimado; pacotes e caixas precisam de conteúdo conhecido. Conversões desconhecidas ficam com `baseQuantity: null`, para revisão futura.

Compras finalizadas serão candidatas para confirmação de estoque, não entradas automáticas. A chave `(userId, sourcePurchaseItemId)` impede confirmar duas vezes a mesma linha para a mesma pessoa. Movimentos usam delta positivo para entrada, negativo para consumo e não nulo para ajuste. Saldo e movimento deverão ser atualizados na mesma transação pelo serviço de despensa; inserir um movimento diretamente não recalcula o saldo.

O schema usa associação composta entre movimento e despensa para impedir que um movimento seja ligado ao estoque de outra conta. O serviço ainda deverá verificar acesso à compra de origem e converter sua quantidade antes de registrar a entrada.

## Próximos módulos

1. Completar edição e exclusão de receitas próprias; o cadastro privado e consulta já existem. Ingredientes do catálogo são associados por identidade normalizada e unidade compatível, sem densidade/peso inferidos.
2. Publicação/moderação e consulta pública, retornando apenas receitas publicadas e visíveis. Receita privada nunca é consultável por conhecer seu slug. Compartilhamento por link usa token aleatório, revogável, consultado somente pelo servidor; não expor tokens em listagens públicas.
3. Avaliações autenticadas: verificar acesso à receita, impedir autoavaliação e moderar comentários. Exibir apenas avaliações aprovadas na média pública. Unicidade e faixa da nota já são garantidas no banco; permissões e autoavaliação dependem do serviço futuro.
4. Ampliar a despensa com baixa por preparo e lembretes de revisão. Já é possível ajustar saldo manual e confirmar compras acessíveis, sem compartilhar estoque particular por participar de uma lista.
5. Ampliar sugestões e catalogação. Receitas→compras já ajusta porções, soma ingredientes repetidos e desconta estoque confirmado; Despensa→receitas destaca cobertura parcial/completa e ingredientes faltantes. Quantidade desconhecida bloqueia a geração da lista, sem virar zero.

## Meta diária e receitas

No cadastro, `caloriesPerServing` é a energia de uma porção, não do rendimento inteiro. `nutritionSource` registra a origem declarada. Ambos podem ser omitidos, mas receitas sem essas informações não entram no planejador calórico. O importador aceita os mesmos campos e tags `kind: "meal"` com slugs `meal-breakfast`, `meal-lunch`, `meal-dinner`, `meal-snack`.

Em `/app/recipes/calorie-plan`, a pessoa informa a própria meta (por exemplo, 1600), distribuição entre refeições, receitas permitidas e período. O sistema não calcula necessidade energética individual nem valida adequação clínica. A distribuição inicial é uma convenção editável da aplicação. O catálogo de produção não é preenchido com calorias fictícias; cadastre ou importe receitas com dados conhecidos.

O cardápio exibe porções, calorias calculadas e diferença para a meta. Uma diferença precisa ser aceita antes de salvar. A geração conserva as listas existentes e salva cardápio e nova lista atomicamente. Ingredientes de todos os dias são somados antes de descontar a despensa; porções e energia planejadas ficam registradas para consulta posterior. Não há reserva/baixa automática do estoque, nem cotação inventada para ingredientes sem histórico.

Endpoints autenticados em `/recipes`: catálogo, cadastro privado, detalhe, preview/lista de uma receita, ingredients, pantry (GET/PUT), purchases/recent e purchases/:id/confirm, meal-plan/preview e meal-plan (POST), meal-plans e meal-plans/:id (GET). O perfil e estoques são sempre do usuário autenticado. Não existem endpoints anônimos de publicação nesta etapa.

## Verificação

```bash
npm run recipes:test
# DATABASE_URL e DIRECT_URL devem apontar explicitamente ao PostgreSQL local.
npm run recipes:test:db
```

O teste de integração recusa destinos fora de localhost nas portas de desenvolvimento e limpa somente suas próprias fixtures. As APIs e telas descritas acima estão implementadas. A migration foi aplicada apenas no ambiente local; publicação na VPS e verificação visual permanecem pendentes.
