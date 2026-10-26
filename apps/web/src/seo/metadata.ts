export const marketingPaths = ["/", "/privacy", "/terms", "/contact"];

const pages: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Gondly: lista de compras compartilhada e preços de mercado",
    description: "Organize sua lista de compras de supermercado, compartilhe com outras pessoas e acompanhe o carrinho e seu histórico de preços com o Gondly.",
  },
  "/privacy": { title: "Política de privacidade | Gondly", description: "Saiba como o Gondly trata seus dados para sincronizar listas de compras, preços e compras compartilhadas." },
  "/terms": { title: "Termos de uso | Gondly", description: "Conheça as condições de uso do Gondly para organizar listas de mercado e acompanhar suas compras." },
  "/contact": { title: "Contato e suporte | Gondly", description: "Entre em contato com o Gondly para suporte, dúvidas sobre listas compartilhadas, privacidade e sugestões." },
};

export function marketingMeta(path: string) {
  return pages[path];
}

export function siteIdentity(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${origin}/#organization`, name: "Gondly", url: `${origin}/`, logo: `${origin}/gondly-logo-small.png`, email: "contato@gondly.com.br" },
      { "@type": "WebSite", "@id": `${origin}/#website`, name: "Gondly", url: `${origin}/`, inLanguage: "pt-BR", publisher: { "@id": `${origin}/#organization` } },
    ],
  };
}
