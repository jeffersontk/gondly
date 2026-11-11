# Catálogo de receitas e despensa

## Entregue nesta etapa

Schema Prisma e migration aditiva para catálogo, autoria, compartilhamento, avaliações, despensa e planejamento. Importador administrativo de JSON com validação e transação. Não há endpoints públicos nem telas de receitas nesta entrega.

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

1. CRUD autenticado de receitas próprias; apenas o autor edita. Ingredientes do catálogo são associados por IDs revisados.
2. Publicação/moderação e consulta pública, retornando apenas receitas publicadas e visíveis. Receita privada nunca é consultável por conhecer seu slug. Compartilhamento por link usa token aleatório, revogável, consultado somente pelo servidor; não expor tokens em listagens públicas.
3. Avaliações autenticadas: verificar acesso à receita, impedir autoavaliação e moderar comentários. Exibir apenas avaliações aprovadas na média pública. Unicidade e faixa da nota já são garantidas no banco; permissões e autoavaliação dependem do serviço futuro.
4. Despensa: confirmar compras recentes acessíveis, registrar consumo/ajustes e revisar disponibilidade antiga. Não compartilhar estoque particular por participar de uma lista.
5. Receitas→compras: ajustar porções, somar ingredientes compatíveis e descontar estoque confirmado. Despensa→receitas: destacar cobertura, quantidades desconhecidas e ingredientes faltantes. Nunca converter quantidades qualitativas para zero.

## Verificação

```bash
npm run recipes:test
# DATABASE_URL e DIRECT_URL devem apontar explicitamente ao PostgreSQL local.
npm run recipes:test:db
```

O teste de integração recusa destinos fora de localhost nas portas de desenvolvimento e limpa somente suas próprias fixtures. A migration foi aplicada apenas no ambiente local. Deploy e criação de APIs/telas permanecem pendentes.
