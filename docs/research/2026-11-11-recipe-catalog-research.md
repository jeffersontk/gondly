# Pesquisa para o catálogo inicial do Gondly

Pesquisa realizada em 11/11/2026. São **45 candidatos**, incluindo preparos básicos para compor refeições. É uma seleção editorial para uso cotidiano, não um ranking dos pratos mais consumidos. Os links individuais foram consultados; as fontes principais selecionadas são Panelinha e Vitat/Tecnonutri.

O [arquivo estruturado](2026-11-11-recipe-shortlist.json) registra identificação, link, fonte, refeições sugeridas, papel no cardápio e observações sobre energia quando disponível. **Ainda não é um lote importável nem receitas publicadas no app.** Não contém transcrição de instruções, fotos nem pesos estimados sem referência.

## Seleção e cobertura

| Grupo inicial | Quantidade | Exemplos |
| --- | ---: | --- |
| Café da manhã | 10 | Ovos, cuscuz, tapioca, panqueca de banana, pão de queijo, iogurte |
| Almoço | 11 | Pratos feitos com frango/carne/peixe/abobrinha, feijoada, moqueca, estrogonofe |
| Jantar | 11 | Canja, sopas, escondidinho, massas, cuscuz com leguminosas |
| Lanches | 10 | Vitamina, sanduíche, torta de frango, bolos, muffins, frutas |
| Bases e acompanhamentos | 3 | Arroz branco, arroz integral e feijão |
| **Total** | **45** | Uma receita pode atender mais de um horário sem ser duplicada |

O identificador de grupo organiza a pesquisa. Não limita uma receita a um único horário nem indica que ela, sozinha, seja uma refeição nutricionalmente completa. `suggestedMeals` e `role` são propostas editoriais do Gondly.

## Fontes e achados relevantes

- [Panelinha: café da manhã](https://panelinha.com.br/home/cafe-da-manha), [almoço cotidiano](https://panelinha.com.br/home/receitas-de-almoco-dia-a-dia), [clássicos](https://panelinha.com.br/home/classicos) e [sopas](https://panelinha.com.br/categoria/sopas): referências culinárias e de rendimento. Não registramos calorias por porção para essas versões nesta pesquisa; isso não significa que tenham zero calorias.
- [Vitat: panqueca de banana](https://vitat.com.br/receitas/56990-panqueca-de-banana): a página declara 237,77 kcal por porção de 179 g, rendimento de 1 porção. É outra formulação, não uma tabela nutricional para a panqueca do Panelinha.
- [Vitat: vitamina de banana](https://vitat.com.br/receitas/7332-vitamina-de-banana?amp=true): declara 64,45 kcal por porção de 135 g e rendimento de 2 porções. A instrução menciona adoçar a gosto, enquanto a lista só contém leite e banana. Açúcar adicional não deve ser tratado como incluído no valor declarado.
- [Vitat: torta de frango](https://vitat.com.br/receitas/78602-torta-de-frango): declara 278,95 kcal por porção de 129 g e rendimento de 15 porções. O frango consta como cozido; converter isso diretamente em peso cru de compra criaria erro.
- [TBCA](https://www.tbca.net.br/): possível referência para uma futura ficha energética calculada a partir da formulação padronizada, com identificação do alimento, estado cru/cozido e método documentados. Não calculamos novas calorias nesta entrega.

Receitas Nestlé e Receiteria também foram pesquisados. Algumas páginas individuais retornaram bloqueio/indisponibilidade na ferramenta; não foram incluídas como fichas verificadas nem contornamos o bloqueio.

## Como transformar a pesquisa em receitas utilizáveis

O projeto já possui schema e importador administrativo. O trabalho restante é preparar os dados de cada ficha, não criar outro banco ou instalar um serviço de busca em produção.

1. **Definir a versão do Gondly:** escolher formulação, rendimento e ingredientes de cada candidato. Usar instruções próprias revisadas e manter a origem de consulta; não copiar integralmente textos ou fotos dos sites.
2. **Padronizar ingredientes e medidas:** registrar g, ml ou un e estado do alimento. Colheres, xícaras, filés, unidades médias e pesos de alimento cozido precisam de conversão documentada, não uma tabela genérica aplicada a tudo.
3. **Preparar o conteúdo culinário:** descrição, ingredientes, preparo, tempos, rendimento, tags de refeição e alérgenos conferidos. Uma classificação como vegetariana exige verificar toda a formulação; não inferir pelo título.
4. **Conferir energia por porção:** usar apenas dados que correspondam à mesma receita, rendimento e opcionais. Quando calculado pelo Gondly, rotular como estimativa, documentar fonte e método. Quando desconhecido, omitir `caloriesPerServing` e `nutritionSource`.
5. **Importar como rascunho:** campos existentes `origin`, `sourceUrl` e `attribution`, ingredientes globais e aliases; nada de revisor, data de publicação ou aprovação inventados.
6. **Revisar e publicar:** identificar a revisão realmente realizada. Aí o catálogo publicado passa a aparecer para todos os usuários, sem exigir cadastro individual de cada receita.
7. **Habilitar no planejador calórico:** somente versões com energia por porção conferida e classificação de refeição. Não oferecer um acompanhamento sozinho como substituto do almoço.

O formato importável está em `apps/api/prisma/recipes/example.json`; o contrato está em `docs/RECIPE-CATALOG.md`. Comandos existentes, na pasta `apps/api`:

```bash
# Só valida o futuro lote, sem gravar no banco.
npm run recipes:import -- prisma/recipes/catalogo-revisado.json

# Grava apenas quando o lote existir e DATABASE_URL apontar ao destino correto.
npm run recipes:import -- prisma/recipes/catalogo-revisado.json --write
```

`catalogo-revisado.json` é o nome proposto para o próximo artefato; **não foi criado** nesta pesquisa. Não executar esses comandos com o JSON de pesquisa.

## Composição das refeições e limite atual

Hoje o planejador escolhe **uma receita por horário** e ajusta porções pela energia declarada. A pesquisa identificou dois caminhos possíveis para alimentar esse fluxo:

- **Primeiro lote recomendado:** cadastrar fichas compostas já revisadas, por exemplo frango + arroz + feijão + legumes, com todos os ingredientes e calorias do conjunto. Reutiliza o motor atual.
- **Evolução posterior:** permitir várias receitas no mesmo horário, com proporções independentes de prato, acompanhamento e bebida. Exige alterar o motor e a interface; não basta adicionar tags.

No [pê-efe de frango do Panelinha](https://panelinha.com.br/receita/pe-efe-file-frango-legumes-assados), arroz e feijão aparecem como links para outros preparos. Um extrator que leia apenas os ingredientes da página perderia parte da refeição. Todas as referências auxiliares precisam ser incorporadas ou excluídas explicitamente da versão cadastrada.

O esquema atual não registra porção em gramas, método energético nem o papel prato/acompanhamento em campos próprios. O manifesto de pesquisa preserva esses dados observados; uma evolução do schema pode estruturá-los. Não há garantia de adequação nutricional apenas por atingir 1.600 kcal.

## Ordem sugerida para preparar os lotes

1. Bases e refeições do dia a dia: arroz, feijão, ovos, cuscuz, tapioca, pratos feitos e opções de leguminosas.
2. Variedade: massas, canja, sopas, escondidinho, estrogonofe, moqueca e quibe.
3. Lanches e preparos para vários dias: iogurte, granola, pães, sanduíches, tortas, bolos e muffins.

A prioridade para o planejador de calorias é cobrir os quatro horários com fichas consistentes. Completar 45 títulos sem ingredientes, rendimento e energia compatíveis não resolveria o cardápio.

## Índice completo

Os links e papéis de todos os 45 candidatos estão no JSON associado. Nenhuma alteração de código, importação em banco ou deploy foi realizada nesta pesquisa.

| ID | Grupo | Receita e fonte | Papel proposto |
| --- | --- | --- | --- |
| base-01 | Café da manhã | [Ovo mexido cremoso](https://panelinha.com.br/receita/ovo-mexido-cremoso) | Componente |
| base-02 | Café da manhã | [Omelete a jato](https://panelinha.com.br/receita/omelete-a-jato) | Prato |
| base-03 | Café da manhã | [Cuscuz de milho com ovo pochê](https://panelinha.com.br/receita/cuscuz-milho-com-ovo-poche) | Prato |
| base-04 | Café da manhã | [Panqueca de banana](https://panelinha.com.br/receita/panqueca-de-banana) | Prato |
| base-05 | Café da manhã | [Iogurte caseiro](https://panelinha.com.br/receita/iogurte-caseiro) | Componente |
| base-06 | Café da manhã | [Granola caseira](https://panelinha.com.br/receita/granola-caseira) | Componente |
| base-07 | Café da manhã | [Pão de queijo](https://panelinha.com.br/receita/pao-de-queijo) | Componente |
| base-08 | Café da manhã | [Pão de forma caseiro](https://panelinha.com.br/receita/pao-de-forma-caseiro) | Componente |
| base-09 | Café da manhã | [Creme de abacate levinho](https://panelinha.com.br/receita/creme-de-abacate-levinho) | Componente |
| base-10 | Café da manhã | [Tapioca cor-de-rosa com queijo meia cura](https://panelinha.com.br/receita/tapioca-cor-de-rosa-com-queijo-meia-cura) | Prato |
| base-11 | Almoço | [Pê-efe de filé de frango grelhado e legumes assados](https://panelinha.com.br/receita/pe-efe-file-frango-legumes-assados) | Conjunto de preparos |
| base-12 | Almoço | [Pê-efe de bife com abobrinha assada](https://panelinha.com.br/receita/pe-efe-de-bife-com-abobrinha) | Conjunto de preparos |
| base-13 | Almoço | [Pê-efe de peixe com espinafre, batata bolinha ao murro e lentilha](https://panelinha.com.br/receita/pe-efe-de-peixe-com-espinafre-batata-lentilha) | Conjunto de preparos |
| base-14 | Almoço | [Pê-efe de abobrinha recheada com arroz e feijão](https://panelinha.com.br/receita/pe-efe-abobrinha-arroz-feijao) | Conjunto de preparos |
| base-15 | Almoço | [Estrogonofe de frango](https://panelinha.com.br/receita/estrogonofe-de-frango) | Prato |
| base-16 | Almoço | [Picadinho de filé mignon](https://panelinha.com.br/receita/picadinho-de-file-mignon) | Prato |
| base-17 | Almoço | [Moqueca baiana com leite de coco caseiro](https://panelinha.com.br/receita/moqueca-baiana-com-leite-de-coco-caseiro) | Prato |
| base-18 | Almoço | [Quibe assado](https://panelinha.com.br/receita/quibe-assado) | Prato |
| base-19 | Almoço | [Panqueca de carne com molho branco](https://panelinha.com.br/receita/panqueca-de-carne-com-molho-branco) | Prato |
| base-20 | Almoço | [Macarrão à bolonhesa](https://panelinha.com.br/receita/macarrao-bolonhesa) | Prato |
| base-21 | Jantar | [Canja de galinha na pressão](https://panelinha.com.br/receita/canja-de-galinha-na-pressao) | Prato |
| base-22 | Jantar | [Sopa de abóbora](https://panelinha.com.br/receita/sopa-de-abobora) | Componente |
| base-23 | Jantar | [Sopa de mandioca com carne na pressão](https://panelinha.com.br/receita/sopa-de-mandioca-com-carne-na-pressao) | Prato |
| base-24 | Jantar | [Sopa de ervilha com especiarias na pressão](https://panelinha.com.br/receita/sopa-de-ervilha-com-especiarias-na-pressao) | Prato |
| base-25 | Jantar | [Sopa de legumes com pesto](https://panelinha.com.br/receita/sopa-de-legumes-com-pesto) | Componente |
| base-26 | Jantar | [Cuscuz marroquino com abobrinha e grão-de-bico](https://panelinha.com.br/receita/cuscuz-marroquino-com-abobrinha-e-grao-de-bico) | Prato |
| base-27 | Jantar | [Macarrão com molho de grão-de-bico](https://panelinha.com.br/receita/macarrao-molho-de-grao-de-bico) | Prato |
| base-28 | Jantar | [Pizza caseira de muçarela](https://panelinha.com.br/receita/pizza-de-mucarela-caseira) | Prato |
| base-29 | Jantar | [Quiche lorraine](https://panelinha.com.br/receita/quiche-lorraine) | Prato |
| base-30 | Jantar | [Cuscuz de milho com feijão-fradinho e legumes](https://panelinha.com.br/receita/cuscuz-de-milho-com-feijao-fradinho-e-legumes) | Prato |
| base-31 | Lanches | [Vitamina de banana](https://vitat.com.br/receitas/7332-vitamina-de-banana?amp=true) | Componente |
| base-32 | Lanches | [Sanduíche de banana com ricota e mel](https://panelinha.com.br/receita/sanduiche-de-banana-com-ricota-e-mel) | Prato |
| base-33 | Lanches | [Bolo de banana com aveia](https://panelinha.com.br/receita/bolo-de-banana-com-aveia) | Componente |
| base-34 | Lanches | [Bolo de fubá](https://panelinha.com.br/receita/bolo-de-fuba) | Componente |
| base-35 | Lanches | [Broinha de fubá](https://panelinha.com.br/receita/broinha-de-fuba) | Componente |
| base-36 | Lanches | [Muffins de espinafre com queijo](https://panelinha.com.br/receita/muffins-integrais-com-queijo-e-espinafre) | Prato |
| base-37 | Lanches | [Maçã cozida no micro-ondas](https://panelinha.com.br/receita/maca-cozida-no-microondas) | Componente |
| base-38 | Lanches | [Salada de duas frutas](https://panelinha.com.br/receita/salada-de-2-frutas) | Componente |
| base-39 | Lanches | [Bruschetta de tomate](https://panelinha.com.br/receita/bruschetta-de-tomate) | Componente |
| base-40 | Lanches | [Torta de frango](https://vitat.com.br/receitas/78602-torta-de-frango) | Prato |
| base-41 | Almoço | [Feijoada](https://panelinha.com.br/receita/feijoada) | Prato |
| base-42 | Jantar | [Escondidinho de mandioca com carne-seca](https://panelinha.com.br/receita/escondidinho-de-mandioca-com-carne-seca) | Prato |
| base-43 | Bases e acompanhamentos | [Arroz branco soltinho](https://panelinha.com.br/receita/arroz-branco-para-4) | Componente |
| base-44 | Bases e acompanhamentos | [Arroz integral na pressão](https://panelinha.com.br/receita/arroz-integral-pressao) | Componente |
| base-45 | Bases e acompanhamentos | [Feijão caseiro](https://panelinha.com.br/receita/feijao-caseiro) | Componente |
