import { Controller, Get, Header, NotFoundException, Param, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const where = { visibility: "public" as const, status: "published" as const, OR: [{ origin: { not: "user_created" as const } }, { authorId: { not: null } }] };
const origin = () => {
  try { const url = new URL(process.env.PUBLIC_SITE_URL ?? process.env.FRONTEND_URL ?? "https://gondly.com.br"); return url.protocol === "https:" ? url.origin : "https://gondly.com.br"; }
  catch { return "https://gondly.com.br"; }
};
const publicSelect = {
  id: true, title: true, slug: true, description: true, servings: true, prepMinutes: true, cookMinutes: true,
  publishedAt: true, updatedAt: true, origin: true, sourceUrl: true, attribution: true,
  author: { select: { name: true } },
  ingredients: { orderBy: { position: "asc" as const }, select: { quantity: true, unit: true, optional: true, note: true, ingredient: { select: { name: true } } } },
  steps: { orderBy: { position: "asc" as const }, select: { instruction: true } },
};
function document(title: string, description: string, route: string, content: string, structured?: object) {
  const url = origin() + route;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Gondly</title><meta name="description" content="${escape(description.slice(0,160))}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description.slice(0,160))}"><meta property="og:url" content="${escape(url)}"><link rel="stylesheet" href="/recipe-site.css">${structured ? `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,"\\u003c")}</script>` : ""}</head><body><header><a class="brand" href="/">Gondly</a><nav><a href="/receitas">Receitas</a><a href="/blog">Blog</a><a href="/app/recipes">Minhas receitas</a></nav></header><main>${content}</main><footer><a href="/sobre">Sobre</a> · <a href="/privacy">Privacidade</a> · <a href="/contact">Contato</a><p>Receitas da comunidade são publicadas por seus autores. Confira ingredientes e restrições antes de preparar.</p></footer></body></html>`;
}
@Controller("public-recipe-pages")
export class PublicRecipesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("sitemap.xml") @Header("Content-Type", "application/xml; charset=utf-8") @Header("Cache-Control", "no-store")
  async sitemap() {
    const recipes = await this.prisma.recipe.findMany({ where, select: { slug: true, updatedAt: true }, orderBy: { id: "asc" }, take: 10000 });
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(origin())}/receitas</loc></url>${recipes.map(recipe => `<url><loc>${escape(origin())}/receitas/${escape(recipe.slug)}</loc><lastmod>${recipe.updatedAt.toISOString()}</lastmod></url>`).join("")}</urlset>`;
  }
  @Get() @Header("Content-Type", "text/html; charset=utf-8") @Header("Cache-Control", "no-store")
  async index(@Query("page") pageInput?: string) {
    const page = Math.min(10000, Math.max(1, Number.parseInt(typeof pageInput === "string" ? pageInput : "1",10) || 1));
    const recipes = await this.prisma.recipe.findMany({ where, select: { title: true, slug: true, description: true, prepMinutes: true, cookMinutes: true, author: { select: { name: true } } }, orderBy: [{ publishedAt: "desc" }, { id: "asc" }], skip: (page-1)*20, take: 21 });
    if (page > 1 && !recipes.length) throw new NotFoundException("Página não encontrada.");
    const items = recipes.slice(0,20);
    return document("Receitas da comunidade", "Receitas com ingredientes, rendimento e modo de preparo compartilhadas no Gondly.", page === 1 ? "/receitas" : `/receitas?page=${page}`, `<p class="eyebrow">DA LISTA À MESA</p><h1>Receitas para a sua rotina</h1><p>Explore receitas da comunidade e do catálogo Gondly. Confira o preparo e transforme os ingredientes em uma lista de compras.</p><a class="button" href="/app/recipes/new">Compartilhar minha receita</a><section class="grid">${items.map(recipe => `<article><p class="eyebrow">${escape(recipe.author?.name ?? "Catálogo Gondly")}</p><h2><a href="/receitas/${escape(recipe.slug)}">${escape(recipe.title)}</a></h2><p>${escape(recipe.description.slice(0,250))}</p><p>${recipe.prepMinutes + recipe.cookMinutes} min</p><a href="/receitas/${escape(recipe.slug)}">Ver ingredientes e preparo →</a></article>`).join("") || "<p>Ainda não há receitas publicadas.</p>"}</section><nav class="pagination">${page > 1 ? `<a href="/receitas?page=${page-1}">← Anterior</a>` : ""}${recipes.length > 20 ? `<a href="/receitas?page=${page+1}">Próxima →</a>` : ""}</nav>`, { "@context":"https://schema.org", "@type":"ItemList", itemListElement: items.map((recipe,index) => ({ "@type":"ListItem", position:(page-1)*20+index+1, url:`${origin()}/receitas/${recipe.slug}` })) });
  }
  @Get(":slug") @Header("Content-Type", "text/html; charset=utf-8") @Header("Cache-Control", "no-store")
  async recipe(@Param("slug") slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) throw new NotFoundException("Receita não encontrada.");
    const recipe = await this.prisma.recipe.findFirst({ where: { ...where, slug }, select: publicSelect });
    if (!recipe) throw new NotFoundException("Receita não encontrada.");
    const author = recipe.author?.name ?? (recipe.origin === "ai_assisted" ? "Catálogo Gondly · com apoio de IA" : "Catálogo Gondly");
    const lines = recipe.ingredients.map(item => `${item.quantity == null ? "Quantidade a confirmar" : Number(item.quantity).toLocaleString("pt-BR")} ${item.unit} de ${item.ingredient.name}${item.optional ? " (opcional)" : ""}${item.note ? ` — ${item.note}` : ""}`);
    const schema = { "@context":"https://schema.org", "@type":"Recipe", name:recipe.title, description:recipe.description, author:{"@type":recipe.author ? "Person":"Organization", name:author}, recipeYield:`${Number(recipe.servings)} porções`, prepTime:`PT${recipe.prepMinutes}M`, cookTime:`PT${recipe.cookMinutes}M`, recipeIngredient:lines, recipeInstructions:recipe.steps.map(step => ({"@type":"HowToStep",text:step.instruction})), ...(recipe.publishedAt ? {datePublished:recipe.publishedAt.toISOString()}:{}), dateModified:recipe.updatedAt.toISOString(), url:`${origin()}/receitas/${recipe.slug}` };
    return document(recipe.title,recipe.description,`/receitas/${recipe.slug}`, `<a href="/receitas">← Todas as receitas</a><article class="recipe"><p class="eyebrow">RECEITA · ${escape(author)}</p><h1>${escape(recipe.title)}</h1><p>${escape(recipe.description)}</p><p class="facts">${Number(recipe.servings)} porções · Preparo: ${recipe.prepMinutes} min · Cozimento: ${recipe.cookMinutes} min</p>${recipe.author ? "<p>Publicada pelo autor, sem revisão editorial prévia do Gondly.</p>" : ""}<h2>Ingredientes</h2><ul>${lines.map(line=>`<li>${escape(line)}</li>`).join("")}</ul><h2>Modo de preparo</h2><ol>${recipe.steps.map(step=>`<li>${escape(step.instruction)}</li>`).join("")}</ol>${recipe.sourceUrl?.startsWith("https://") ? `<aside><a href="${escape(recipe.sourceUrl)}" rel="ugc nofollow noopener noreferrer">Referência culinária</a><p>${escape(recipe.attribution)}</p></aside>`:""}<a class="button" href="/app/recipes/${encodeURIComponent(recipe.id)}">Montar lista com estes ingredientes</a><p>Ao entrar, você pode ajustar porções e descontar sua despensa particular. Esses dados não aparecem nesta página.</p></article>` ,schema);
  }
}
