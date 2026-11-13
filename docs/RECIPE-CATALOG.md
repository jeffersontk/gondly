# Catálogo de receitas e despensa

## Entregue nesta etapa

### Publicação comunitária imediata — 13/11/2026

O autor agora escolhe publicar no cadastro ou no detalhe, e pode retirar a publicação. Receitas existentes não são publicadas automaticamente. `publish` exige booleano explícito; somente o dono de uma receita `user_created` pode alterar sua visibilidade. A publicação comunitária não registra revisão editorial fictícia. As migrations de 13/11 permitem esse fluxo, preservando a revisão exigida para importações editoriais e o bloqueio de receitas não publicadas visíveis por link.

Na VPS, `/receitas` e `/receitas/:slug` são páginas HTML dinâmicas da API, sem login ou rebuild por publicação. Só retornam `published + public`; receitas privadas, retiradas ou de usuários sem autoria remanescente não são expostas. O nome de exibição do autor aparece, mas e-mail, tokens, despensa e compras não. Existe paginação de 20 fichas e sitemap de até 10.000 receitas em `/sitemap-recipes.xml`, anunciado no robots.txt. Acima desse volume, será necessário dividir os sitemaps.

As páginas usam canonical e JSON-LD Recipe/ItemList com informações existentes, sem avaliações, fotos ou calorias inventadas. Sem foto apropriada não se promete elegibilidade para resultados enriquecidos. Conteúdo é escapado; não é aceito HTML executável de usuários. A página não carrega anúncios nesta entrega, e publicação não implica aprovação pelo AdSense.

A retirada retorna 404 no site e remove a entrada do sitemap; caches e índices externos do Google têm seus próprios prazos de atualização. As páginas comunitárias não são armazenadas nem recuperadas pelo cache offline do service worker.

Deploy exige `bash scripts/update-vps.sh all` para aplicar migrations e atualizar API, web e Nginx. O proxy usa o alias `gondly-prod-api:3333`, confirmado no Compose de produção enviado pelo usuário, na rede compartilhada `proxy`. O proxy real da VPS ainda precisa ser conferido após o deploy. Em desenvolvimento, o Vite encaminha `/receitas` para a API em 3333.

Schema Prisma, importador administrativo e fluxos autenticados em `/app/recipes`: cadastro privado ou publicação escolhida pelo autor, consulta de catálogo publicado, despensa, confirmação de compras recentes, sugestão por disponibilidade, lista por receita e cardápio por meta diária informada pelo usuário. Compartilhamento restrito por token e avaliações ainda não têm telas/endpoints.

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

### Catálogo inicial cadastrado — 12/11/2026

O lote [starter.json](../apps/api/prisma/recipes/starter.json) contém 45 receitas/preparos e 82 ingredientes canônicos. Foi importado no PostgreSQL **local** e está disponível a usuários autenticados em `/app/recipes`. As receitas são adaptações do Gondly com apoio de IA, instruções próprias, fonte de pesquisa e revisão editorial técnica pelo Codex identificada. Não foram testadas em cozinha nem revisadas nutricionalmente.

Todas as fichas têm quantidades-base conhecidas e podem gerar uma lista. Os pratos feitos incluem os componentes; arroz, feijão e outros acompanhamentos isolados não recebem tags de refeição. As formulações adaptadas **não herdam as calorias das referências**: os 45 registros ficam fora do planejador por meta calórica até existir energia conferida para a mesma formulação.

A fonte editável do catálogo é `apps/api/scripts/build-starter-recipe-catalog.mjs`; execute-o na pasta `apps/api` após editar as formulações e versione o JSON regenerado. A fonte/atribuição também aparece no detalhe da receita. A revisão registrada é editorial e de consistência, não um selo de segurança alimentar ou aprovação nutricional.

Na VPS, depois de atualizar a imagem da API e aplicar migrations, rode:

```bash
cd /opt/gondly/monorepo
bash scripts/import-starter-recipes-vps.sh
```

O script importa pela imagem da API e pelos arquivos Compose já usados no deploy. Não imprime variáveis de conexão. Pode ser reexecutado: os slugs estáveis são atualizados sem duplicar fichas e o importador recusa substituir receitas de usuários. Nome normalizado já existente é reutilizado quando a unidade-base é compatível, preservando o ID e referências; conflitos de unidade/alias interrompem a transação inteira.

Para apenas validar o JSON dentro da imagem, use `bash scripts/import-starter-recipes-vps.sh check`. A importação na VPS **não foi executada por este ambiente**.

Validação local adicional após importar o lote, com `DATABASE_URL` e `DIRECT_URL` explicitamente locais:

```bash
node --require ts-node/register --test e2e/starter-catalog.e2e-spec.ts
```

Esse teste exige o catálogo local já importado, cria somente uma conta de teste temporária e confere as 45 receitas, proveniência, cálculo de ingredientes, geração de lista e preservação de listas anteriores.

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

O importador não carrega `.env` automaticamente. O catálogo inteiro é validado e gravado em uma transação. Slugs de receitas existentes são atualizados; etapas e ingredientes daquela receita são substituídos. Receitas omitidas no lote não são excluídas. Aliases antigos são preservados. Ingrediente com nome normalizado já conhecido pode ser reutilizado mesmo com outro slug; sua unidade-base não pode ser alterada. Não importe slugs de receitas pertencentes a usuários.

Receitas entram como `draft` e `private` por padrão. Para publicar administrativamente, informe `status: "published"`, `visibility: "public"`, `reviewedBy`, `reviewedAt` e `publishedAt` (datas ISO completas). Não invente revisores nem declare testes não realizados. A origem `imported` exige URL HTTPS e atribuição; isso não concede direitos de reprodução. `ai_assisted` identifica auxílio de IA. Autores, tokens e avaliações não podem ser definidos pelo JSON administrativo.

## Unidades e estoque

Cada ingrediente possui unidade-base `g`, `ml` ou `un`. O importador converte apenas kg→g, L→ml e unidades idênticas. Uma unidade de tomate não vira um peso estimado; pacotes e caixas precisam de conteúdo conhecido. Conversões desconhecidas ficam com `baseQuantity: null`, para revisão futura.

Compras finalizadas serão candidatas para confirmação de estoque, não entradas automáticas. A chave `(userId, sourcePurchaseItemId)` impede confirmar duas vezes a mesma linha para a mesma pessoa. Movimentos usam delta positivo para entrada, negativo para consumo e não nulo para ajuste. Saldo e movimento deverão ser atualizados na mesma transação pelo serviço de despensa; inserir um movimento diretamente não recalcula o saldo.

O schema usa associação composta entre movimento e despensa para impedir que um movimento seja ligado ao estoque de outra conta. O serviço ainda deverá verificar acesso à compra de origem e converter sua quantidade antes de registrar a entrada.

## Próximos módulos

1. Completar edição e exclusão de receitas próprias; o cadastro privado e consulta já existem. Ingredientes do catálogo são associados por identidade normalizada e unidade compatível, sem densidade/peso inferidos.
2. Ampliar ferramentas de denúncia/moderação e compartilhamento restrito por token. Publicação imediata pelo dono e consulta anônima de receitas públicas já existem. Receita privada nunca é consultável por conhecer seu slug. Futuro compartilhamento restrito deve usar token aleatório, revogável e consultado somente pelo servidor, sem expor tokens em listagens públicas.
3. Avaliações autenticadas: verificar acesso à receita, impedir autoavaliação e moderar comentários. Exibir apenas avaliações aprovadas na média pública. Unicidade e faixa da nota já são garantidas no banco; permissões e autoavaliação dependem do serviço futuro.
4. Ampliar a despensa com baixa por preparo e lembretes de revisão. Já é possível ajustar saldo manual e confirmar compras acessíveis, sem compartilhar estoque particular por participar de uma lista.
5. Ampliar sugestões e catalogação. Receitas→compras já ajusta porções, soma ingredientes repetidos e desconta estoque confirmado; Despensa→receitas destaca cobertura parcial/completa e ingredientes faltantes. Quantidade desconhecida bloqueia a geração da lista, sem virar zero.

## Meta diária e receitas

No cadastro, `caloriesPerServing` é a energia de uma porção, não do rendimento inteiro. `nutritionSource` registra a origem declarada. Ambos podem ser omitidos, mas receitas sem essas informações não entram no planejador calórico. O importador aceita os mesmos campos e tags `kind: "meal"` com slugs `meal-breakfast`, `meal-lunch`, `meal-dinner`, `meal-snack`.

Em `/app/recipes/calorie-plan`, a pessoa informa a própria meta (por exemplo, 1600), distribuição entre refeições, receitas permitidas e período. O sistema não calcula necessidade energética individual nem valida adequação clínica. A distribuição inicial é uma convenção editável da aplicação. O catálogo de produção não é preenchido com calorias fictícias; cadastre ou importe receitas com dados conhecidos.

O cardápio exibe porções, calorias calculadas e diferença para a meta. Uma diferença precisa ser aceita antes de salvar. A geração conserva as listas existentes e salva cardápio e nova lista atomicamente. Ingredientes de todos os dias são somados antes de descontar a despensa; porções e energia planejadas ficam registradas para consulta posterior. Não há reserva/baixa automática do estoque, nem cotação inventada para ingredientes sem histórico.

Endpoints autenticados em `/recipes`: catálogo, cadastro, detalhe, publicação/retirada por dono (`:id/publication`), preview/lista de uma receita, ingredients, pantry (GET/PUT), purchases/recent e purchases/:id/confirm, meal-plan/preview e meal-plan (POST), meal-plans e meal-plans/:id (GET). O perfil e estoques são sempre do usuário autenticado. Os endpoints anônimos são apenas de leitura das páginas públicas e sitemap; publicação exige autenticação.

## Verificação

```bash
npm run recipes:test
# DATABASE_URL e DIRECT_URL devem apontar explicitamente ao PostgreSQL local.
npm run recipes:test:db
```

O teste de integração recusa destinos fora de localhost nas portas de desenvolvimento e limpa somente suas próprias fixtures. As APIs e telas descritas acima estão implementadas. A migration foi aplicada apenas no ambiente local; publicação na VPS e verificação visual permanecem pendentes.
