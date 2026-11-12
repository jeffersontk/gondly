// Authoring source for the versioned JSON. These are Gondly adaptations, not transcriptions.
import { readFile, writeFile } from "node:fs/promises";
import { validateRecipeCatalog } from "./recipe-catalog.mjs";
const research = JSON.parse(await readFile(new URL("../../../docs/research/2026-11-11-recipe-shortlist.json", import.meta.url), "utf8"));
const definitions = [
  ["ovo-de-galinha", "Ovo de galinha", "un"], ["leite-integral", "Leite integral", "ml"], ["leite-desnatado", "Leite desnatado", "ml"],
  ["manteiga", "Manteiga", "g"], ["sal", "Sal", "g"], ["pimenta-do-reino", "Pimenta-do-reino", "g"], ["azeite-de-oliva", "Azeite de oliva", "ml"],
  ["queijo-meia-cura", "Queijo meia-cura", "g"], ["farinha-milho-flocada", "Farinha de milho flocada", "g"], ["vinagre", "Vinagre", "ml"],
  ["banana-sem-casca", "Banana sem casca", "g"], ["aveia-em-flocos", "Aveia em flocos", "g"], ["canela-em-po", "Canela em pó", "g"],
  ["iogurte-natural", "Iogurte natural sem açúcar", "g"], ["mel", "Mel", "g"], ["castanha-de-caju", "Castanha-de-caju sem sal", "g"],
  ["uva-passa", "Uva-passa", "g"], ["oleo-de-soja", "Óleo de soja", "ml"], ["polvilho-azedo", "Polvilho azedo", "g"], ["polvilho-doce", "Polvilho doce", "g"],
  ["farinha-de-trigo", "Farinha de trigo", "g"], ["fermento-biologico-seco", "Fermento biológico seco", "g"], ["acucar", "Açúcar", "g"],
  ["abacate-polpa", "Abacate (polpa)", "g"], ["limao-suco", "Suco de limão", "ml"], ["goma-tapioca-hidratada", "Goma de tapioca hidratada", "g"], ["beterraba-crua", "Beterraba crua", "g"],
  ["peito-de-frango-cru", "Peito de frango cru sem osso", "g"], ["arroz-branco-cru", "Arroz branco cru", "g"], ["arroz-integral-cru", "Arroz integral cru", "g"],
  ["feijao-carioca-cru", "Feijão-carioca cru", "g"], ["cebola", "Cebola", "g"], ["alho", "Alho descascado", "g"], ["abobrinha", "Abobrinha", "g"],
  ["cenoura", "Cenoura", "g"], ["pimentao", "Pimentão", "g"], ["paprica-doce", "Páprica doce", "g"],
  ["bife-bovino-cru", "Bife bovino cru", "g"], ["file-de-peixe-cru", "Filé de peixe cru sem espinhas", "g"], ["espinafre", "Espinafre", "g"],
  ["batata-inglesa", "Batata inglesa", "g"], ["lentilha-crua", "Lentilha crua", "g"], ["carne-bovina-moida-crua", "Carne bovina moída crua", "g"],
  ["tomate", "Tomate", "g"], ["creme-de-leite", "Creme de leite", "g"], ["cogumelo-champignon", "Cogumelo champignon", "g"],
  ["mostarda", "Mostarda", "g"], ["ketchup", "Ketchup", "g"], ["file-mignon-cru", "Filé mignon cru", "g"],
  ["molho-de-tomate", "Molho de tomate", "g"], ["leite-de-coco", "Leite de coco", "ml"], ["azeite-de-dende", "Azeite de dendê", "ml"],
  ["coentro", "Coentro", "g"], ["trigo-para-quibe", "Trigo para quibe", "g"], ["hortela", "Hortelã", "g"],
  ["queijo-parmesao", "Queijo parmesão", "g"], ["macarrao-seco", "Macarrão seco de trigo", "g"], ["salsao", "Salsão", "g"],
  ["abobora-descascada", "Abóbora descascada", "g"], ["mandioca-descascada", "Mandioca descascada", "g"], ["carne-bovina-panela", "Carne bovina crua para panela", "g"],
  ["ervilha-seca", "Ervilha seca", "g"], ["batata-doce", "Batata-doce", "g"], ["manjericao", "Manjericão", "g"],
  ["cuscuz-marroquino-seco", "Cuscuz marroquino seco", "g"], ["grao-de-bico-cru", "Grão-de-bico cru", "g"],
  ["queijo-mucarela", "Queijo muçarela", "g"], ["bacon", "Bacon", "g"], ["feijao-fradinho-cru", "Feijão-fradinho cru", "g"],
  ["pao-de-forma", "Pão de forma", "g"], ["ricota", "Ricota", "g"], ["fermento-quimico", "Fermento químico em pó", "g"],
  ["fuba", "Fubá", "g"], ["maca", "Maçã", "g"], ["mamao-polpa", "Mamão (polpa)", "g"], ["laranja-suco", "Suco de laranja", "ml"],
  ["pao-italiano", "Pão italiano", "g"], ["feijao-preto-cru", "Feijão-preto cru", "g"], ["carne-seca", "Carne-seca", "g"],
  ["costelinha-suina", "Costelinha suína fresca", "g"], ["linguica-calabresa", "Linguiça calabresa", "g"], ["louro", "Folha de louro", "un"]
];
const ingredients = definitions.map(([slug, name, baseUnit]) => ({ slug, name, baseUnit }));
const bySlug = new Map(ingredients.map(item => [item.slug, item]));
const allergenIngredients = {
  ovos: ["ovo-de-galinha"],
  leite: ["leite-integral", "leite-desnatado", "manteiga", "queijo-meia-cura", "iogurte-natural", "creme-de-leite", "queijo-parmesao", "queijo-mucarela", "ricota"],
  trigo: ["farinha-de-trigo", "trigo-para-quibe", "macarrao-seco", "cuscuz-marroquino-seco", "pao-de-forma", "pao-italiano"],
  castanhas: ["castanha-de-caju"], peixe: ["file-de-peixe-cru"]
};
const mealNames = { breakfast: "Café da manhã", lunch: "Almoço", dinner: "Jantar", snack: "Lanches" };
const recipes = [];
function add(number, servings, prepMinutes, cookMinutes, lines, steps, note = "") {
  const ref = research.recipes.find(item => item.id === `base-${String(number).padStart(2, "0")}`);
  if (!ref) throw new Error(`Referência ausente: ${number}`);
  const items = lines.map(([ingredient, quantity, note]) => {
    if (!bySlug.has(ingredient)) throw new Error(`Ingrediente ausente: ${ingredient}`);
    return { ingredient, quantity, unit: bySlug.get(ingredient).baseUnit, ...(note ? { note } : {}) };
  });
  const grouped = new Map();
  for (const item of items) {
    const previous = grouped.get(item.ingredient);
    if (previous) previous.quantity = Math.round((previous.quantity + item.quantity) * 1000) / 1000;
    else grouped.set(item.ingredient, item);
  }
  const tags = ref.role === "component" ? [] : ref.suggestedMeals.map(meal => ({ slug: `meal-${meal}`, name: mealNames[meal], kind: "meal" }));
  for (const [allergen, slugs] of Object.entries(allergenIngredients)) if (items.some(item => slugs.includes(item.ingredient))) tags.push({ slug: `contem-${allergen}`, name: `Contém ${allergen}`, kind: "allergen" });
  recipes.push({
    slug: `gondly-${ref.id}`, title: number === 21 ? "Canja de galinha (panela comum)" : number === 24 ? "Sopa de ervilha com especiarias (panela comum)" : ref.title, servings, prepMinutes, cookMinutes,
    description: `Versão adaptada para o Gondly com apoio de IA; não é reprodução da receita da fonte. Revisão editorial de ingredientes e coerência do cadastro pelo Codex; não testada em cozinha e sem revisão nutricional. Calorias não verificadas. ${note}`.trim(),
    origin: "ai_assisted", sourceUrl: ref.sourceUrl,
    attribution: `Referência de pesquisa: ${ref.publisher}. Formulação e instruções adaptadas para o Gondly; rendimento próprio.`,
    status: "published", visibility: "public", reviewedBy: "Codex — revisão editorial e consistência de dados; sem teste culinário ou revisão nutricional",
    reviewedAt: "2026-11-12T00:00:00.000Z", publishedAt: "2026-11-12T00:00:00.000Z", ingredients: [...grouped.values()], steps, tags
  });
}

add(1, 1, 5, 5, [["ovo-de-galinha",2],["leite-integral",30],["manteiga",5],["sal",0.5]], [
  "Quebre os ovos separadamente e misture em uma tigela com o leite e o sal.",
  "Derreta a manteiga em uma frigideira pequena, em fogo baixo; acrescente os ovos.",
  "Mexa com espátula até não restar ovo líquido e retire do fogo. Sirva imediatamente; esta ficha corresponde apenas aos ovos, sem pão ou bebida."
]);
add(2, 1, 5, 8, [["ovo-de-galinha",2],["leite-integral",20],["queijo-meia-cura",30],["manteiga",5],["sal",0.5]], [
  "Bata os ovos com o leite e o sal; rale o queijo e reserve.",
  "Aqueça uma frigideira antiaderente em fogo baixo, derreta a manteiga e espalhe os ovos.",
  "Quando a base estiver firme, coloque o queijo, dobre e termine de cozinhar com tampa até os ovos ficarem firmes e o queijo derreter."
]);
add(3, 2, 15, 15, [["farinha-milho-flocada",120],["ovo-de-galinha",2],["manteiga",10],["sal",1],["vinagre",10]], [
  "Misture o flocão com 90 ml de água potável e metade do sal. Aguarde 10 minutos para hidratar.",
  "Coloque água na base da cuscuzeira sem atingir o cesto; distribua o flocão sem apertar e cozinhe tampado por cerca de 10 minutos após formar vapor. Misture a manteiga.",
  "Aqueça outra panela com água e vinagre, sem fervura forte. Coloque um ovo por vez com cuidado e cozinhe até clara e gema firmarem; para gema macia utilize ovo pasteurizado. Sirva um ovo sobre metade do cuscuz e use o sal restante."
]);
add(4, 2, 10, 10, [["banana-sem-casca",200],["ovo-de-galinha",2],["aveia-em-flocos",60],["canela-em-po",1],["oleo-de-soja",5]], [
  "Amasse a banana e incorpore os ovos, a aveia e a canela até obter uma massa uniforme.",
  "Unte uma frigideira antiaderente com o óleo medido e aqueça em fogo baixo.",
  "Faça quatro panquecas pequenas, virando quando a base firmar. Cozinhe os dois lados e o centro; cada porção corresponde a duas panquecas."
]);
add(5, 6, 20, 15, [["leite-integral",1000],["iogurte-natural",170]], [
  "Use utensílios limpos e leite pasteurizado. Aqueça o leite, mexendo, até 90 °C; use termômetro culinário.",
  "Deixe o leite cair para 43–45 °C e misture o iogurte natural com culturas vivas, sem açúcar. Temperatura alta demais impede a fermentação.",
  "Tampe e mantenha em iogurteira ou recipiente térmico apropriado, conforme as instruções do equipamento, por 6–8 horas até firmar. Refrigere imediatamente por pelo menos 4 horas; conserve a até 4 °C e consuma em até 3 dias. Descarte se houver mofo ou cheiro anormal."
], "Rende seis potes, não seis refeições completas. Acrescentar o tempo de fermentação e refrigeração ao tempo indicado.");
add(6, 12, 10, 30, [["aveia-em-flocos",300],["castanha-de-caju",100],["mel",80],["oleo-de-soja",30],["uva-passa",80],["canela-em-po",2]], [
  "Aqueça o forno a 160 °C e misture a aveia com as castanhas picadas e a canela.",
  "Incorpore o mel e o óleo; espalhe em assadeira e asse por 25–30 minutos, mexendo a cada 10 minutos para não queimar.",
  "Depois de esfriar completamente, adicione as passas e divida em 12 porções. Guarde em recipiente limpo e bem fechado; iogurte e frutas não estão incluídos nesta ficha."
]);
add(7, 12, 25, 30, [["polvilho-azedo",200],["polvilho-doce",100],["queijo-meia-cura",180],["ovo-de-galinha",2],["oleo-de-soja",50],["sal",3]], [
  "Aqueça o forno a 200 °C. Misture os polvilhos com o sal e ferva 180 ml de água com o óleo; despeje sobre os polvilhos e mexa com colher.",
  "Espere a massa amornar antes de incorporar os ovos, um por vez, e o queijo ralado. Amasse até conseguir modelar.",
  "Faça 24 bolinhas e coloque em assadeira com espaço entre elas. Asse por 25–30 minutos, até crescerem e dourarem. Cada porção equivale a duas unidades, sem acompanhamentos."
]);
add(8, 12, 25, 40, [["farinha-de-trigo",500],["leite-integral",300],["fermento-biologico-seco",7],["acucar",20],["sal",8],["manteiga",30]], [
  "Misture a farinha, o fermento e o açúcar. Adicione o leite levemente morno, o sal e a manteiga; sove por 10 minutos até a massa ficar lisa.",
  "Cubra e deixe crescer até dobrar, cerca de 1 hora conforme a temperatura ambiente. Modele em forma de pão untada e deixe crescer novamente por 30–45 minutos.",
  "Asse em forno preaquecido a 180 °C por 35–40 minutos, até o pão estar dourado e assado no centro. Espere esfriar antes de dividir em 12 fatias."
], "O tempo indicado não inclui as duas fermentações. Uma porção é uma fatia, não um café da manhã completo.");
add(9, 2, 10, 0, [["abacate-polpa",200],["iogurte-natural",170],["limao-suco",15],["mel",10]], [
  "Separe a polpa do abacate e pese a quantidade indicada, sem casca nem caroço.",
  "Bata a polpa com o iogurte, o suco de limão e o mel até ficar cremoso.",
  "Distribua em dois recipientes e sirva imediatamente ou mantenha refrigerado até servir. A receita não inclui granola, pão ou outras coberturas."
]);
add(10, 2, 15, 10, [["goma-tapioca-hidratada",120],["beterraba-crua",50],["queijo-meia-cura",60]], [
  "Rale finamente a beterraba descascada e esprema em peneira. Misture aos poucos o líquido extraído à goma, somente até colorir sem encharcar; peneire para desfazer grumos.",
  "Aqueça frigideira antiaderente, espalhe metade da goma e espere os grãos se unirem.",
  "Distribua metade do queijo ralado, dobre e aqueça até derreter. Repita para a segunda porção. O peso de beterraba é para compra e extração do suco, não de suco pronto."
]);

const riceBeanLines = [["arroz-branco-cru",160],["feijao-carioca-cru",160],["cebola",100],["alho",12],["azeite-de-oliva",20],["sal",4]];
const riceBeanSteps = [
  "Deixe o feijão de molho em água por 8–12 horas na geladeira; descarte a água. Cozinhe em pressão com água nova por 20–30 minutos após pressurizar, respeitando o limite do fabricante. Espere toda a pressão sair antes de abrir. Refogue metade da cebola e do alho com metade do azeite, junte ao feijão e apure com metade do sal.",
  "Refogue o restante da cebola e do alho no azeite reservado, acrescente o arroz cru e 350 ml de água quente. Tempere com o sal restante e cozinhe em fogo baixo até os grãos amaciarem, completando água se necessário."
];
add(11, 4, 25, 50, [...riceBeanLines,["peito-de-frango-cru",600],["abobrinha",300],["cenoura",200],["pimentao",150],["azeite-de-oliva",20],["paprica-doce",2],["sal",3]], [
  ...riceBeanSteps,
  "Corte a abobrinha, a cenoura e o pimentão. Misture com 15 ml do azeite adicional, páprica e metade do sal adicional; asse a 200 °C por 25–35 minutos, virando na metade.",
  "Divida o frango em quatro filés, tempere com o sal adicional restante e grelhe com os 5 ml de azeite reservados até atingir 74 °C no centro. Divida arroz, feijão, frango e legumes igualmente em quatro pratos."
], "Inclui arroz e feijão feitos a partir dos grãos crus. Remolho do feijão não está no tempo ativo.");
add(12, 4, 20, 50, [...riceBeanLines,["bife-bovino-cru",600],["abobrinha",500],["azeite-de-oliva",15],["sal",3],["pimenta-do-reino",0.5]], [
  ...riceBeanSteps,
  "Corte a abobrinha em meias-luas, misture com 10 ml do azeite adicional e metade do sal adicional. Asse a 200 °C por cerca de 25 minutos.",
  "Tempere os bifes com pimenta e o sal restante; grelhe em frigideira quente com o restante do azeite, até pelo menos 63 °C no centro, e deixe repousar 3 minutos. Monte quatro pratos com arroz, feijão, bife e abobrinha."
]);
add(13, 4, 25, 40, [["file-de-peixe-cru",600],["espinafre",300],["batata-inglesa",600],["lentilha-crua",180],["cebola",100],["alho",10],["azeite-de-oliva",35],["limao-suco",20],["sal",5]], [
  "Cozinhe a lentilha em água até amaciar, sem desfazer. Refogue a cebola e metade do alho em 10 ml de azeite; incorpore à lentilha e use 2 g do sal.",
  "Cozinhe as batatas até amaciarem, escorra e amasse levemente cada uma. Regue com 10 ml de azeite e 1 g de sal; asse a 220 °C até dourar.",
  "Refogue o espinafre lavado com o alho restante, 5 ml de azeite e 1 g de sal. Tempere o peixe com limão e o sal restante, grelhe com 10 ml de azeite até o centro atingir 63 °C. Distribua os quatro preparos igualmente entre quatro pratos."
]);
add(14, 4, 30, 55, [...riceBeanLines,["abobrinha",800],["carne-bovina-moida-crua",400],["tomate",200],["azeite-de-oliva",10],["sal",2]], [
  ...riceBeanSteps,
  "Corte as abobrinhas ao meio no comprimento e retire parte da polpa com colher, sem furar a casca. Pique a polpa e o tomate.",
  "Refogue a carne no azeite adicional, mexendo para desfazer os grumos. Acrescente tomate, polpa e sal adicional; cozinhe até a carne atingir 71 °C. Recheie as abobrinhas e asse a 200 °C por 25–30 minutos até amaciarem. Sirva duas metades com um quarto do arroz e do feijão."
], "A abobrinha é recheada com carne bovina; não é uma versão vegetariana.");
add(15, 4, 20, 25, [["peito-de-frango-cru",600],["cebola",120],["cogumelo-champignon",150],["creme-de-leite",200],["ketchup",50],["mostarda",20],["azeite-de-oliva",15],["sal",3]], [
  "Corte o frango em cubos, pique a cebola e fatie os cogumelos.",
  "Aqueça o azeite e doure o frango em pequenas levas. Junte a cebola e os cogumelos, refogue e acrescente ketchup, mostarda, sal e 80 ml de água.",
  "Cozinhe até o frango atingir 74 °C, abaixe o fogo e misture o creme de leite. Aqueça sem fervura forte e divida em quatro porções. Arroz e batata não estão incluídos nesta ficha."
]);
add(16, 4, 20, 25, [["file-mignon-cru",600],["cebola",150],["alho",10],["molho-de-tomate",150],["azeite-de-oliva",20],["sal",4],["pimenta-do-reino",0.5]], [
  "Corte a carne em cubos pequenos e seque com papel de cozinha; pique a cebola e o alho.",
  "Doure a carne em pequenas levas no azeite quente. Acrescente cebola, alho, sal e pimenta e mexa até a cebola amaciar.",
  "Junte o molho e 150 ml de água; cozinhe em fogo baixo até a carne estar completamente cozida e o molho encorpar. Rende quatro porções do picadinho, sem arroz, ovo ou farofa."
]);
add(17, 4, 25, 25, [["file-de-peixe-cru",800],["cebola",200],["tomate",300],["pimentao",200],["leite-de-coco",200],["azeite-de-dende",20],["limao-suco",30],["coentro",15],["sal",4]], [
  "Tempere o peixe com limão e sal; reserve na geladeira enquanto corta a cebola, o tomate e o pimentão em fatias.",
  "Em panela larga, faça uma base com parte dos legumes. Distribua o peixe e cubra com os legumes restantes; acrescente leite de coco, dendê e 100 ml de água.",
  "Tampe e cozinhe em fogo baixo por 15–25 minutos, sem mexer vigorosamente, até o peixe atingir 63 °C. Acrescente o coentro. Sirva em quatro porções; arroz e pirão não estão incluídos."
], "Versão com leite de coco pronto; não corresponde à formulação energética da referência com leite caseiro.");
add(18, 6, 25, 40, [["trigo-para-quibe",200],["carne-bovina-moida-crua",500],["cebola",150],["hortela",10],["azeite-de-oliva",20],["sal",4],["pimenta-do-reino",0.5]], [
  "Cubra o trigo com água e deixe hidratar por cerca de 30 minutos. Escorra e esprema muito bem em peneira ou pano limpo.",
  "Misture o trigo com a carne crua, a cebola bem picada, a hortelã, o sal, a pimenta e metade do azeite.",
  "Espalhe em refratário untado com o azeite restante, em camada de até 3 cm. Asse a 200 °C por 35–40 minutos, até o centro atingir 71 °C. Divida em seis porções."
]);
add(19, 4, 35, 35, [["ovo-de-galinha",2],["leite-integral",700],["farinha-de-trigo",180],["carne-bovina-moida-crua",400],["cebola",100],["molho-de-tomate",150],["manteiga",25],["oleo-de-soja",15],["queijo-parmesao",30],["sal",5]], [
  "Misture ovos, 350 ml de leite, 150 g da farinha e 1 g do sal. Unte frigideira com o óleo medido e faça oito discos finos, cozinhando ambos os lados.",
  "Refogue a carne com a cebola e 2 g de sal até atingir 71 °C. Acrescente o molho de tomate e apure; distribua o recheio nos oito discos e enrole.",
  "Derreta a manteiga, mexa com os 30 g de farinha restantes por 1 minuto e incorpore os 350 ml de leite restantes aos poucos. Cozinhe até engrossar, tempere com 2 g de sal, cubra as panquecas, polvilhe o queijo e asse a 200 °C por 15 minutos. Cada porção contém duas panquecas."
]);
add(20, 4, 20, 45, [["macarrao-seco",320],["carne-bovina-moida-crua",400],["cebola",120],["cenoura",100],["salsao",50],["alho",10],["molho-de-tomate",500],["azeite-de-oliva",20],["sal",6]], [
  "Pique a cebola, a cenoura, o salsão e o alho. Refogue no azeite, acrescente a carne e cozinhe mexendo até atingir 71 °C.",
  "Adicione o molho, 200 ml de água e metade do sal. Cozinhe em fogo baixo por cerca de 30 minutos, completando água para não queimar.",
  "Cozinhe a massa em água com o sal restante, pelo tempo da embalagem. Escorra e misture ao molho; divida em quatro porções. Queijo para finalizar não está incluído."
]);

add(21, 4, 20, 40, [["peito-de-frango-cru",400],["arroz-integral-cru",120],["batata-inglesa",200],["cenoura",200],["cebola",100],["salsao",50],["azeite-de-oliva",10],["sal",4]], [
  "Corte o frango e os legumes em cubos pequenos. Refogue a cebola e o salsão no azeite em panela comum.",
  "Acrescente o frango, o arroz integral, a cenoura, a batata, o sal e 1,5 litro de água. Cozinhe tampado em fogo baixo por 35–40 minutos, mexendo de vez em quando.",
  "Confira se o arroz e os legumes estão macios e o frango atingiu 74 °C; ajuste a consistência com água quente. Divida em quatro tigelas. Esta adaptação usa panela comum, não tempo de panela elétrica."
]);
add(22, 4, 20, 30, [["abobora-descascada",800],["cebola",120],["cenoura",100],["alho",10],["azeite-de-oliva",15],["sal",3]], [
  "Pique a abóbora descascada, a cenoura, a cebola e o alho.",
  "Refogue cebola e alho no azeite. Junte os legumes, o sal e 800 ml de água; cozinhe por cerca de 25 minutos até amaciarem.",
  "Retire do fogo e bata com mixer apropriado para líquidos quentes, sem respingar. Volte ao fogo para aquecer e distribua em quatro porções. Pão, sementes e proteína adicional não estão incluídos."
]);
add(23, 4, 25, 50, [["mandioca-descascada",600],["carne-bovina-panela",400],["cebola",120],["alho",10],["tomate",200],["azeite-de-oliva",15],["sal",4]], [
  "Corte a carne em cubos pequenos e a mandioca em pedaços. Refogue a carne com o azeite, a cebola e o alho em panela de pressão.",
  "Acrescente tomate, sal e 1,2 litro de água, respeitando o limite da panela. Cozinhe por 25 minutos após pressurizar e deixe toda a pressão sair antes de abrir.",
  "Adicione a mandioca e cozinhe sem pressão por mais 20–25 minutos até ficar completamente macia. Retire os fios centrais da mandioca e desfie parte da carne; sirva em quatro tigelas."
]);
add(24, 4, 15, 35, [["ervilha-seca",250],["cebola",120],["alho",10],["cenoura",150],["azeite-de-oliva",15],["paprica-doce",2],["sal",3]], [
  "Lave a ervilha e pique a cebola, o alho e a cenoura.",
  "Refogue os temperos no azeite, acrescente ervilha, cenoura, páprica, sal e 1,2 litro de água. Cozinhe em panela comum por 30–35 minutos, mexendo e completando água até a ervilha se desfazer.",
  "Amasse parte dos grãos para engrossar e distribua em quatro porções. Não encha panela de pressão com esta mistura espumante; a adaptação foi escrita para panela comum."
]);
add(25, 4, 25, 30, [["batata-inglesa",300],["cenoura",200],["abobrinha",200],["cebola",100],["alho",10],["manjericao",20],["castanha-de-caju",30],["queijo-parmesao",20],["azeite-de-oliva",25],["sal",4]], [
  "Corte batata, cenoura e abobrinha em cubos. Refogue a cebola e metade do alho com 10 ml de azeite.",
  "Acrescente batata, cenoura, 3 g de sal e 1 litro de água. Cozinhe por 15 minutos, junte a abobrinha e cozinhe por mais 10 minutos.",
  "Triture manjericão, castanha, queijo, alho e azeite restantes com 1 g de sal e um pouco do caldo morno. Misture o pesto à sopa fora do fogo e distribua em quatro porções."
]);
add(26, 4, 25, 50, [["cuscuz-marroquino-seco",200],["grao-de-bico-cru",160],["abobrinha",400],["cebola",100],["azeite-de-oliva",25],["limao-suco",20],["sal",4]], [
  "Deixe o grão-de-bico de molho na geladeira por 8–12 horas, descarte a água e cozinhe em água nova até ficar macio. Para pressão, siga o limite e a liberação segura do fabricante.",
  "Cubra o cuscuz com 220 ml de água fervente, metade do sal e 10 ml de azeite. Tampe por 5 minutos e solte com garfo, conferindo também a hidratação indicada na embalagem.",
  "Refogue a cebola e a abobrinha no azeite restante; junte o grão-de-bico escorrido, o sal restante e o cuscuz. Finalize com limão e divida em quatro porções. O peso do grão-de-bico na ficha é seco, antes do remolho."
]);
add(27, 4, 25, 55, [["macarrao-seco",320],["grao-de-bico-cru",180],["molho-de-tomate",400],["cebola",100],["alho",10],["azeite-de-oliva",20],["sal",5]], [
  "Deixe o grão-de-bico de molho na geladeira por 8–12 horas e cozinhe em água nova até amaciar. Reserve parte da água do cozimento.",
  "Refogue a cebola e o alho no azeite; adicione o molho, 3 g de sal e o grão-de-bico. Bata metade do molho com mixer apropriado para dar cremosidade, usando água do cozimento se necessário.",
  "Cozinhe a massa conforme a embalagem em água com o sal restante. Escorra, misture ao molho e divida em quatro pratos."
]);
add(28, 4, 30, 20, [["farinha-de-trigo",300],["fermento-biologico-seco",4],["azeite-de-oliva",15],["sal",5],["molho-de-tomate",150],["queijo-mucarela",240],["manjericao",5]], [
  "Misture farinha e fermento, adicione 180 ml de água, 10 ml de azeite e o sal. Sove por 8–10 minutos, cubra e deixe dobrar de volume por aproximadamente 1 hora.",
  "Unte uma assadeira com o azeite restante, abra a massa e leve ao forno preaquecido a 230 °C por 5–7 minutos.",
  "Distribua molho e queijo, volte ao forno por 10–15 minutos até assar a base e derreter o queijo. Finalize com manjericão e corte em oito fatias; cada porção tem duas fatias."
], "O tempo indicado não inclui a fermentação.");
add(29, 6, 30, 45, [["farinha-de-trigo",200],["manteiga",100],["ovo-de-galinha",3],["creme-de-leite",200],["leite-integral",100],["bacon",150],["sal",3],["pimenta-do-reino",0.5]], [
  "Misture farinha, manteiga fria em cubos e 1 g de sal até formar uma farofa; junte até 40 ml de água fria para unir. Forre uma forma de 22 cm e refrigere por 30 minutos.",
  "Fure a base, cubra com papel próprio para forno e pesos culinários; asse a 180 °C por 15 minutos. Retire os pesos e o papel. Doure o bacon em frigideira e escorra a gordura liberada.",
  "Misture ovos, creme, leite, sal restante e pimenta. Espalhe o bacon sobre a base e despeje o creme. Asse por mais 25–30 minutos, até o centro atingir 71 °C e firmar. Espere amornar e divida em seis porções."
]);
add(30, 4, 25, 45, [["farinha-milho-flocada",240],["feijao-fradinho-cru",160],["cenoura",200],["abobrinha",200],["cebola",100],["azeite-de-oliva",20],["sal",4]], [
  "Lave o feijão-fradinho e cozinhe em água até amaciar; escorra. Pique a cebola e corte os legumes em cubos pequenos.",
  "Misture o flocão com 180 ml de água e metade do sal; hidrate por 10 minutos e cozinhe no cesto da cuscuzeira por 10 minutos depois de formar vapor.",
  "Refogue cebola e legumes no azeite, acrescente o feijão cozido e o sal restante. Solte o cuscuz com garfo, misture ao refogado e distribua em quatro porções."
]);

add(31, 2, 5, 0, [["banana-sem-casca",160],["leite-desnatado",300]], [
  "Pese a banana já descascada e coloque no liquidificador limpo.",
  "Acrescente o leite desnatado gelado e bata até ficar uniforme, sem adicionar açúcar nesta versão.",
  "Divida igualmente entre dois copos e consuma logo após o preparo. Esta formulação própria não usa as calorias ou o tamanho de porção da referência."
]);
add(32, 2, 10, 8, [["pao-de-forma",120],["banana-sem-casca",160],["ricota",100],["mel",15],["manteiga",5]], [
  "Amasse a ricota, corte a banana em rodelas e divida o pão em dois pares de fatias.",
  "Recheie cada sanduíche com metade da ricota e da banana e distribua o mel.",
  "Aqueça uma frigideira em fogo baixo com a manteiga medida e doure os sanduíches dos dois lados. Sirva um sanduíche por porção."
]);
add(33, 10, 15, 40, [["banana-sem-casca",400],["aveia-em-flocos",200],["ovo-de-galinha",3],["oleo-de-soja",60],["acucar",60],["fermento-quimico",10],["canela-em-po",2]], [
  "Aqueça o forno a 180 °C. Amasse a banana e misture com ovos, açúcar e 55 ml do óleo.",
  "Incorpore aveia e canela; por último, mexa delicadamente com o fermento. Unte uma forma com os 5 ml de óleo reservados e despeje a massa.",
  "Asse por 35–40 minutos, até um palito sair sem massa crua. Espere amornar antes de cortar em dez porções."
]);
add(34, 10, 15, 40, [["fuba",200],["farinha-de-trigo",100],["ovo-de-galinha",3],["leite-integral",250],["acucar",150],["oleo-de-soja",80],["fermento-quimico",12]], [
  "Preaqueça o forno a 180 °C. Bata os ovos com açúcar, leite e 75 ml de óleo.",
  "Misture fubá e farinha; incorpore os líquidos e finalize com o fermento sem bater demais. Unte uma forma com o óleo restante.",
  "Despeje a massa e asse por 35–40 minutos, verificando com palito se o centro está assado. Divida o bolo frio em dez porções."
]);
add(35, 12, 25, 25, [["fuba",150],["farinha-de-trigo",100],["leite-integral",250],["manteiga",50],["acucar",60],["ovo-de-galinha",3],["sal",1]], [
  "Misture fubá e farinha. Em uma panela, aqueça leite, manteiga, açúcar e sal até começar a ferver.",
  "Acrescente as farinhas de uma vez e mexa em fogo baixo até a massa se soltar da panela. Deixe amornar bem antes de incorporar os ovos, um por vez, mexendo até a massa ficar uniforme.",
  "Com duas colheres, faça 24 montinhos em assadeira com papel próprio para forno. Asse a 200 °C por cerca de 25 minutos até crescerem e dourarem. Uma porção corresponde a duas broinhas."
]);
add(36, 6, 20, 25, [["farinha-de-trigo",180],["aveia-em-flocos",40],["ovo-de-galinha",2],["leite-integral",150],["espinafre",150],["queijo-meia-cura",100],["azeite-de-oliva",30],["fermento-quimico",8],["sal",2]], [
  "Lave o espinafre, cozinhe brevemente em panela tampada com a água das folhas, esprema bem e pique. Aqueça o forno a 180 °C.",
  "Misture ovos, leite e 25 ml do azeite; incorpore farinha, aveia, sal, espinafre e queijo. Acrescente o fermento por último.",
  "Unte seis cavidades grandes de muffin com o azeite restante e distribua a massa até dois terços da altura. Asse por 20–25 minutos, até o centro firmar. Esta versão leva aveia e farinha branca, não reproduz a formulação integral da referência."
]);
add(37, 2, 10, 5, [["maca",300],["mel",10],["canela-em-po",1],["limao-suco",10]], [
  "Lave as maçãs, retire os caroços e corte em cubos; o peso indicado é da parte comestível, sem sementes.",
  "Misture com mel, canela, limão e 20 ml de água em recipiente próprio para micro-ondas, com tampa ventilada.",
  "Aqueça por 3 minutos, mexa com cuidado e aqueça por mais 1–2 minutos até amaciar. Deixe o vapor sair antes de abrir completamente e divida em duas porções."
]);
add(38, 2, 10, 0, [["mamao-polpa",200],["banana-sem-casca",160],["laranja-suco",80]], [
  "Higienize as frutas antes de descascar e separe a polpa de mamão sem sementes.",
  "Corte o mamão e a banana em pedaços pequenos; misture com o suco de laranja.",
  "Separe em duas tigelas e sirva logo após o preparo. Não adicionar açúcar nesta versão; coberturas não estão incluídas."
]);
add(39, 4, 15, 10, [["pao-italiano",200],["tomate",300],["alho",5],["manjericao",10],["azeite-de-oliva",20],["sal",2]], [
  "Pique o tomate e misture com o manjericão rasgado, metade do azeite e o sal.",
  "Corte o pão em oito fatias, pincele o azeite restante e torre em forno a 200 °C por 5–8 minutos.",
  "Esfregue levemente o alho nas torradas e distribua o tomate por cima. Sirva duas bruschettas por porção imediatamente para não amolecer o pão."
]);
add(40, 8, 30, 45, [["peito-de-frango-cru",500],["tomate",300],["cebola",100],["azeite-de-oliva",10],["ovo-de-galinha",3],["leite-integral",400],["oleo-de-soja",60],["farinha-de-trigo",250],["fermento-quimico",12],["sal",5]], [
  "Cozinhe o frango em água até atingir 74 °C, desfie e reserve. Refogue a cebola no azeite, acrescente tomate, frango e 3 g de sal; deixe o recheio perder o excesso de líquido.",
  "Bata ovos, leite e 55 ml do óleo, misture a farinha e o sal restante e incorpore o fermento por último.",
  "Unte um refratário com o óleo restante, coloque metade da massa, o recheio e a massa restante. Asse a 180 °C por 35–45 minutos até firmar o centro. Divida em oito porções. Esta versão usa peso de frango cru e não herda o valor energético da referência."
]);
add(41, 8, 35, 90, [["feijao-preto-cru",500],["carne-seca",300],["costelinha-suina",400],["linguica-calabresa",200],["cebola",180],["alho",20],["azeite-de-oliva",15],["louro",2]], [
  "No dia anterior, deixe o feijão de molho na geladeira e dessalgue a carne-seca separadamente, também refrigerada, trocando a água várias vezes. Descarte ambas as águas antes de cozinhar.",
  "Cozinhe a carne-seca em água nova até amaciar e corte em pedaços. Doure a costelinha com o azeite em panela grande; acrescente feijão, carne-seca, louro e água suficiente para cobrir.",
  "Cozinhe em panela comum por 60–90 minutos até feijão e carnes ficarem macios; complete com água quente. Adicione a calabresa fatiada, cebola e alho picados nos últimos 25 minutos e apure o caldo. Prove antes de adicionar sal, pois as carnes já são salgadas. Rende oito porções sem arroz, farofa, couve ou laranja."
]);
add(42, 6, 35, 70, [["mandioca-descascada",1000],["carne-seca",600],["leite-integral",200],["manteiga",30],["cebola",180],["alho",15],["tomate",250],["azeite-de-oliva",15],["queijo-mucarela",100]], [
  "Dessalgue a carne-seca na geladeira por 24–48 horas, trocando a água; cozinhe em água nova até amaciar e desfie. Refogue com azeite, cebola, alho e tomate até o recheio ficar úmido, sem excesso de líquido.",
  "Cozinhe a mandioca até ficar completamente macia. Escorra, retire os fios centrais e amasse ainda quente; misture leite e manteiga em fogo baixo para formar o purê.",
  "Coloque a carne em refratário, cubra com o purê e a muçarela. Leve ao forno a 200 °C por cerca de 20 minutos até aquecer bem e dourar. Prove antes de acrescentar sal; divida em seis porções. O tempo de dessalga não está incluído."
]);
add(43, 4, 10, 20, [["arroz-branco-cru",200],["alho",5],["azeite-de-oliva",10],["sal",2]], [
  "Aqueça o azeite em panela média e refogue o alho picado sem deixar queimar.",
  "Acrescente o arroz, misture por 1 minuto e junte 450 ml de água quente e o sal. Tampe parcialmente e cozinhe em fogo baixo até os grãos amaciarem, completando água se necessário.",
  "Desligue, deixe descansar tampado por 5 minutos e solte com garfo. Divida em quatro porções de acompanhamento; o peso de compra é do arroz cru."
]);
add(44, 4, 10, 25, [["arroz-integral-cru",200],["cebola",60],["azeite-de-oliva",10],["sal",2]], [
  "Refogue a cebola picada no azeite na panela de pressão. Acrescente arroz, sal e 500 ml de água, sem exceder o limite de enchimento do fabricante.",
  "Feche corretamente e cozinhe em fogo baixo por cerca de 20 minutos após pegar pressão, respeitando as orientações da panela e do arroz utilizado.",
  "Desligue e espere a pressão sair naturalmente antes de abrir. Se necessário, termine de amaciar sem pressão com um pouco de água. Divida em quatro porções de acompanhamento."
]);
add(45, 6, 15, 40, [["feijao-carioca-cru",300],["cebola",100],["alho",10],["azeite-de-oliva",15],["sal",3],["louro",1]], [
  "Lave e deixe o feijão de molho na geladeira por 8–12 horas; descarte a água e enxágue.",
  "Cubra com água nova e junte o louro. Cozinhe na pressão por 20–30 minutos depois de pressurizar, respeitando o limite do fabricante, e espere toda a pressão sair antes de abrir.",
  "Refogue cebola e alho no azeite, acrescente uma concha de feijão e amasse. Devolva à panela, junte o sal e ferva sem pressão até o caldo encorpar. Divida em seis porções de acompanhamento; o remolho não está no tempo ativo."
]);

const catalog = { ingredients, recipes: recipes.sort((a, b) => a.slug.localeCompare(b.slug)) };
validateRecipeCatalog(catalog);
await writeFile(new URL("../prisma/recipes/starter.json", import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Catálogo gerado: ${ingredients.length} ingredientes, ${recipes.length} receitas. Calorias ausentes não foram inferidas.`);
