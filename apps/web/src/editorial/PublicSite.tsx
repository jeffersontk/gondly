import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChefHat,
  ShoppingBasket,
  ArrowRight,
  Clock3,
} from "lucide-react";
import content from "./content.json";
import guides from "./guides.json";
import { publishedArticles } from "./catalog.mjs";
import type { Article, Section } from "./types";
import { AdSenseAd } from "../ads/AdSenseAd";
import { canShowAd } from "../ads/eligibility.mjs";

export const articles = publishedArticles(content as Article[]);
const categories = ["Todas", "Receitas", "Economia", "Organização"];
export function pageMeta(path: string, items = articles) {
  const article = items.find((item) => `/blog/${item.slug}` === path);
  const guide = guides.find((item) => item.path === path);
  const pages: Record<string, [string, string]> = {
    "/blog": [
      "Ideias para comprar melhor e cozinhar com mais intenção",
      "Receitas, organização e dicas práticas para planejar as compras da sua casa.",
    ],
    "/receitas": [
      "Da sua lista para a mesa",
      "Receitas com ingredientes e etapas para ajudar a planejar a próxima compra.",
    ],
    "/sobre": [
      "Comprar bem começa antes do mercado",
      "Conheça o Gondly e nossa proposta para organizar listas, compras e referências de preços.",
    ],
  };
  return article
    ? { title: article.title, description: article.summary, found: true }
    : guide
      ? { title: guide.title, description: guide.summary, found: true }
      : pages[path]
        ? { title: pages[path][0], description: pages[path][1], found: true }
        : {
            title: "Página não encontrada",
            description: "Explore os guias e conteúdos públicos do Gondly.",
            found: false,
          };
}

function ArticleAd({ path, published }: { path: string; published: boolean }) {
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setGuest(!localStorage.getItem("gondly.token"));
      } catch {
        setGuest(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);
  const client = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  const slot = import.meta.env.VITE_ADSENSE_ARTICLE_SLOT;
  const allowed = canShowAd({
    enabled:
      import.meta.env.PROD &&
      import.meta.env.VITE_ENABLE_ADS === "true" &&
      import.meta.env.VITE_AD_PROVIDER === "adsense",
    hasNoAds: !guest,
    loading: false,
    hasContent: true,
    pathname: path,
    slot: "article_inline",
    published,
  });
  // Public reading never depends on the billing API. Signed-in visitors see no editorial ads.
  return allowed && client && slot ? (
    <AdSenseAd clientId={client} slotId={slot} className="ed-ad" />
  ) : null;
}
function Sections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((section, index) => (
        <section key={section.title} id={`parte-${index + 1}`}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
function Cards({ items }: { items: Article[] }) {
  return (
    <div className="ed-cards">
      {items.map((article, i) => (
        <a
          className="ed-card"
          href={`/blog/${article.slug}${article.status === "draft" ? "?preview=1" : ""}`}
          key={article.slug}
        >
          <div className={`ed-card-art tone-${i % 3}`} aria-hidden="true">
            {article.category === "Receitas" ? (
              <ChefHat />
            ) : article.category === "Economia" ? (
              <ShoppingBasket />
            ) : (
              <BookOpen />
            )}
            <span>GONDLY / {article.category.toLocaleUpperCase("pt-BR")}</span>
          </div>
          <div className="ed-card-copy">
            <span className="ed-kicker">
              {article.category}
              {article.status === "draft" ? " · Rascunho" : ""}
            </span>
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
            <span className="ed-card-link">
              Ler artigo <ArrowUpRight size={18} />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
function GuideCards() {
  return (
    <section className="ed-guides">
      <div className="ed-section-heading">
        <span className="ed-kicker">COMECE PELO BÁSICO</span>
        <h2>Pequenos hábitos. Compras mais conscientes.</h2>
      </div>
      <div className="ed-guide-grid">
        {guides.map((guide, i) => (
          <a href={guide.path} className="ed-guide" key={guide.path}>
            <span className="ed-number">0{i + 1}</span>
            <div>
              <h3>{guide.title}</h3>
              <p>{guide.summary}</p>
              <span>
                Ler o guia <ArrowRight size={17} />
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
export function PublicSite({
  path,
  preview = false,
  items = articles,
  category = "Todas",
}: {
  path: string;
  preview?: boolean;
  items?: Article[];
  category?: string;
}) {
  const visible = preview ? items : publishedArticles(items);
  const article = visible.find((item) => `/blog/${item.slug}` === path);
  const guide = guides.find((item) => item.path === path);
  const meta = pageMeta(path, visible);
  const index = path === "/blog" || path === "/receitas";
  const filtered = visible.filter((item) =>
    path === "/receitas"
      ? item.category === "Receitas"
      : category === "Todas" || item.category === category,
  );
  return (
    <div className="editorial">
      <a href="#conteudo" className="ed-skip">
        Pular para o conteúdo
      </a>
      <header className="ed-header">
        <a href="/" aria-label="Gondly, início">
          <img
            src="/gondly-logo-small.webp"
            width="150"
            height="50"
            alt="Gondly"
          />
        </a>
        <nav aria-label="Navegação principal">
          <a href="/blog" aria-current={path === "/blog" ? "page" : undefined}>
            Blog
          </a>
          <a
            href="/receitas"
            aria-current={path === "/receitas" ? "page" : undefined}
          >
            Receitas
          </a>
          <a
            href="/sobre"
            aria-current={path === "/sobre" ? "page" : undefined}
          >
            Sobre
          </a>
        </nav>
        <a className="ed-button ed-button-small" href="/login">
          Acessar Gondly <ArrowUpRight size={16} />
        </a>
      </header>
      {preview && (
        <div className="ed-preview" role="status">
          Prévia local · Textos gerados com auxílio de IA, pendentes de revisão.
          Não publicados.
        </div>
      )}
      <main id="conteudo">
        {index ? (
          <>
            <section className="ed-hero">
              <div>
                <span className="ed-kicker">
                  <span className="ed-dot" /> O DIA A DIA, BEM PLANEJADO
                </span>
                <h1>
                  {path === "/receitas" ? (
                    <>
                      Da sua lista
                      <br />
                      para <em>a mesa.</em>
                    </>
                  ) : (
                    <>
                      Boas ideias.
                      <br />
                      Melhores <em>compras.</em>
                    </>
                  )}
                </h1>
                <p>
                  {meta.description} Um espaço para transformar pequenas
                  decisões em uma rotina mais organizada.
                </p>
                <a className="ed-text-link" href="/guias/lista-de-compras">
                  Comece pelo guia de compras <ArrowRight size={18} />
                </a>
              </div>
              <div className="ed-illustration" aria-hidden="true">
                <div className="ed-sticker">
                  <ChefHat size={25} /> Da lista à mesa
                </div>
                <div className="ed-paper">
                  <span>UMA COMPRA BEM PENSADA</span>
                  <h2>
                    Leve uma lista.
                    <br />
                    Volte com um plano.
                  </h2>
                  {[
                    "Conferir a despensa",
                    "Planejar as refeições",
                    "Comparar as embalagens",
                  ].map((t) => (
                    <div className="ed-check" key={t}>
                      <span>✓</span>
                      {t}
                    </div>
                  ))}
                  <div className="ed-paper-footer">
                    <ShoppingBasket size={32} />
                    <span>
                      Menos improviso.
                      <br />
                      Mais intenção.
                    </span>
                  </div>
                </div>
                <span className="ed-orbit" />
              </div>
            </section>
            <section className="ed-library" aria-labelledby="artigos-title">
              <div className="ed-library-heading">
                <div>
                  <span className="ed-kicker">PARA LER NO SEU TEMPO</span>
                  <h2 id="artigos-title">
                    {path === "/receitas" ? "Na cozinha" : "Explore as ideias"}
                  </h2>
                </div>
                {path === "/blog" && (
                  <nav aria-label="Categorias" className="ed-filters">
                    {categories.map((c) => (
                      <a
                        key={c}
                        aria-current={category === c ? "page" : undefined}
                        href={`/blog?${new URLSearchParams({ ...(preview ? { preview: "1" } : {}), categoria: c })}`}
                      >
                        {c}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
              {filtered.length ? (
                <Cards items={filtered} />
              ) : (
                <div className="ed-empty">
                  <BookOpen size={30} />
                  <h3>
                    {path === "/receitas"
                      ? "Receitas em preparação"
                      : category === "Todas"
                        ? "Os primeiros artigos estão em preparação"
                        : "Ainda não há artigos nesta categoria"}
                  </h3>
                  <p>
                    Enquanto isso, explore nossos guias práticos para organizar
                    a lista e comparar preços.
                  </p>
                  <a href="/guias/lista-de-compras">
                    Ler o guia de compras <ArrowRight size={17} />
                  </a>
                </div>
              )}
            </section>
            <GuideCards />
          </>
        ) : article || guide ? (
          <article className="ed-reading">
            <a className="ed-back" href={preview ? "/blog?preview=1" : "/blog"}>
              ← Todos os conteúdos
            </a>
            <span className="ed-kicker">
              {article?.category ?? "GUIA PRÁTICO"}
            </span>
            <h1>{meta.title}</h1>
            <p className="ed-lead">{meta.description}</p>
            {article?.status === "published" && (
              <p className="ed-byline">
                Por {article.author} · Revisão: {article.reviewedBy} · Publicado
                em {article.publishedAt}
                {article.updatedAt
                  ? ` · Atualizado em ${article.updatedAt}`
                  : ""}
              </p>
            )}
            <div className="ed-reading-meta">
              <Clock3 size={16} />
              <span>Leia, adapte e leve para a sua rotina.</span>
            </div>
            <nav className="ed-toc" aria-label="Neste conteúdo">
              <strong>Neste conteúdo</strong>
              {(article?.sections ?? guide!.sections).map((s, i) => (
                <a key={s.title} href={`#parte-${i + 1}`}>
                  {s.title}
                </a>
              ))}
            </nav>
            {article?.recipe && (
              <section className="ed-recipe">
                <h2>Ingredientes e preparo</h2>
                <p>Rendimento: {article.recipe.yield}</p>
                <h3>Ingredientes</h3>
                <ul>
                  {article.recipe.ingredients.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <h3>Como preparar</h3>
                <ol>
                  {article.recipe.steps.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ol>
              </section>
            )}
            <div className="ed-prose">
              <Sections sections={article?.sections ?? guide!.sections} />
            </div>
            {article && !preview && (
              <ArticleAd
                path={path}
                published={article.status === "published"}
              />
            )}
            {article &&
              visible.some(
                (x) =>
                  x.slug !== article.slug && x.category === article.category,
              ) && (
                <section className="ed-related">
                  <h2>Continue a leitura</h2>
                  {visible
                    .filter(
                      (x) =>
                        x.slug !== article.slug &&
                        x.category === article.category,
                    )
                    .slice(0, 3)
                    .map((x) => (
                      <a
                        key={x.slug}
                        href={`/blog/${x.slug}${preview ? "?preview=1" : ""}`}
                      >
                        {x.title} <ArrowUpRight size={16} />
                      </a>
                    ))}
                </section>
              )}
          </article>
        ) : path === "/sobre" ? (
          <article className="ed-reading">
            <span className="ed-kicker">SOBRE O GONDLY</span>
            <h1>{meta.title}</h1>
            <p className="ed-lead">
              Organização para a lista, clareza para a compra e referências para
              a próxima decisão.
            </p>
            <div className="ed-prose">
              <Sections
                sections={[
                  {
                    title: "Uma ferramenta para as compras da casa",
                    paragraphs: [
                      "O Gondly reúne listas, compras e registros de preços. A proposta é ajudar você a planejar o que falta, acompanhar o carrinho e consultar suas referências na próxima ida ao mercado.",
                      "Uma rotina varia de casa para casa. Por isso, nossos guias propõem métodos que você pode adaptar, sem prometer uma economia fixa nem substituir sua decisão.",
                    ],
                  },
                  {
                    title: "Conteúdo que se conecta à sua rotina",
                    paragraphs: [
                      "Nossa área pública aborda organização de compras, comparação de preços e receitas. Você pode ler sem criar uma conta. O aplicativo está disponível quando quiser organizar suas próprias listas.",
                    ],
                  },
                  {
                    title: "Como preparamos os artigos",
                    paragraphs: [
                      "A IA pode auxiliar na preparação dos rascunhos. Antes da publicação, o fluxo editorial exige revisão humana de texto, quantidades e instruções, com autoria, revisão e data identificadas. Rascunhos não são publicados automaticamente.",
                      "Receitas não são apresentadas como testadas sem um teste documentado. Exemplos de preços são identificados como hipotéticos e não representam ofertas em tempo real.",
                    ],
                  },
                  {
                    title: "Publicidade com identificação",
                    paragraphs: [
                      "Quando houver publicidade, ela será identificada e separada do conteúdo. Consulte também as páginas de privacidade e termos para conhecer as condições de uso. Para falar sobre o conteúdo, use nossa página de contato.",
                    ],
                  },
                ]}
              />
            </div>
            <a className="ed-text-link" href="/contact">
              Fale com o Gondly <ArrowUpRight size={18} />
            </a>
          </article>
        ) : (
          <section className="ed-reading">
            <span className="ed-kicker">404</span>
            <h1>Essa página não está na lista.</h1>
            <p className="ed-lead">
              O endereço pode ter mudado ou ainda não ter sido publicado.
            </p>
            <a className="ed-button" href="/blog">
              Explorar o blog <ArrowRight size={18} />
            </a>
          </section>
        )}
        <section className="ed-cta">
          <div>
            <span className="ed-kicker">AGORA, COLOQUE EM PRÁTICA</span>
            <h2>
              Sua próxima compra
              <br />
              começa com uma boa lista.
            </h2>
            <p>Organize o que falta e acompanhe suas compras no Gondly.</p>
          </div>
          <a className="ed-button" href="/login">
            Organizar minha lista <ArrowUpRight size={19} />
          </a>
        </section>
      </main>
      <footer className="ed-footer">
        <div>
          <a href="/" className="ed-wordmark">
            Gondly
          </a>
          <p>Planeje. Compare. Compre com intenção.</p>
        </div>
        <nav aria-label="Rodapé">
          <a href="/blog">Blog</a>
          <a href="/receitas">Receitas</a>
          <a href="/sobre">Sobre</a>
          <a href="/privacy">Privacidade</a>
          <a href="/terms">Termos</a>
          <a href="/contact">Contato</a>
        </nav>
      </footer>
    </div>
  );
}
