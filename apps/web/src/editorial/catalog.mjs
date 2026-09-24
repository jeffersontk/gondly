export const basePaths = [
  "/blog",
  "/receitas",
  "/guias/lista-de-compras",
  "/guias/comparar-precos",
  "/sobre",
];
export function validateArticles(articles) {
  const slugs = new Set();
  for (const article of articles) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) ||
      slugs.has(article.slug)
    )
      throw new Error("slug inválido ou duplicado");
    slugs.add(article.slug);
    if (!["draft", "published"].includes(article.status))
      throw new Error("estado editorial inválido");
    if (
      !article.title?.trim() ||
      !article.summary?.trim() ||
      !article.sections?.length
    )
      throw new Error("conteúdo incompleto");
    if (article.status === "published") {
      if (!article.author?.trim() || !article.reviewedBy?.trim())
        throw new Error("autoria e revisão obrigatórias");
      for (const date of [
        article.publishedAt,
        article.updatedAt ?? article.publishedAt,
      ]) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date
        )
          throw new Error("data inválida");
      }
    }
  }
}
export function publishedArticles(articles) {
  validateArticles(articles);
  return articles.filter((article) => article.status === "published");
}
export function publicPaths(articles) {
  return [
    ...basePaths,
    ...publishedArticles(articles).map((article) => `/blog/${article.slug}`),
  ];
}
export function isEditorialPath(path) {
  return /^\/(blog|receitas|guias|sobre)(\/|$)/.test(path);
}
