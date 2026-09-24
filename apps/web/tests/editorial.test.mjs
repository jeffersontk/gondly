import test from "node:test";
import assert from "node:assert/strict";
import {
  publishedArticles,
  validateArticles,
  publicPaths,
} from "../src/editorial/catalog.mjs";
import { canShowAd } from "../src/ads/eligibility.mjs";
const article = {
  slug: "lista-semanal",
  title: "Lista semanal",
  summary: "Planeje compras",
  category: "Organização",
  status: "published",
  author: "Editor real",
  reviewedBy: "Revisor real",
  publishedAt: "2026-09-24",
  sections: [{ title: "Comece aqui", paragraphs: ["Confira os itens."] }],
};
test("drafts never appear in public routes", () => {
  const data = [
    { ...article, status: "draft" },
    { ...article, slug: "publicado" },
  ];
  assert.deepEqual(
    publishedArticles(data).map((x) => x.slug),
    ["publicado"],
  );
  assert.ok(!publicPaths(data).includes("/blog/lista-semanal"));
});
test("publication requires real editorial metadata", () => {
  assert.throws(
    () => validateArticles([{ ...article, reviewedBy: "" }]),
    /revis/,
  );
  assert.throws(
    () => validateArticles([{ ...article, publishedAt: "2026-99-99" }]),
    /data/,
  );
});
test("duplicate or unsafe slugs fail build", () => {
  assert.throws(() => validateArticles([article, article]), /slug/);
  assert.throws(
    () => validateArticles([{ ...article, slug: "../private" }]),
    /slug/,
  );
});
const eligible = {
  enabled: true,
  hasNoAds: false,
  loading: false,
  error: false,
  hasContent: true,
  pathname: "/app/lists",
  slot: "lists_inline",
};
test("ad only on correct route with available content", () => {
  assert.equal(canShowAd(eligible), true);
  for (const override of [
    { loading: true },
    { error: true },
    { hasContent: false },
    { hasNoAds: true },
    { enabled: false },
    { pathname: "/login" },
    { pathname: "/app/lists/new" },
    { pathname: "/privacy" },
  ])
    assert.equal(canShowAd({ ...eligible, ...override }), false);
});
test("editorial slots cannot show on index or draft preview", () => {
  assert.equal(
    canShowAd({
      ...eligible,
      slot: "article_inline",
      pathname: "/blog/lista-semanal",
      published: true,
    }),
    true,
  );
  for (const pathname of ["/blog", "/receitas", "/sobre", "/blog/inexistente"])
    assert.equal(
      canShowAd({
        ...eligible,
        slot: "article_inline",
        pathname,
        published: false,
      }),
      false,
    );
});
