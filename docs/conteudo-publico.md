# Blog, receitas e guias do Gondly

A área pública fica em `/blog`, `/receitas`, `/guias/lista-de-compras`, `/guias/comparar-precos` e `/sobre`. Artigos publicados usam `/blog/:slug`. Não exige login nem API para leitura. O HTML dos textos é gerado durante o build.

## Revisar os seis rascunhos

Na raiz do projeto local:

```powershell
npm run dev:web
```

Abra `http://localhost:5173/blog?preview=1`. A faixa amarela identifica a prévia. Clique nos cards para ler os rascunhos; para ver somente receitas use `http://localhost:5173/receitas?preview=1`.

Essa prévia só existe no servidor de desenvolvimento. Não exponha o servidor Vite de desenvolvimento na internet. `?preview=1` não revela rascunhos no build de produção.

Os seis textos estão em `apps/web/src/editorial/drafts.json`. São propostas preparadas com IA e **não têm revisão humana nem teste culinário declarados**. Revise quantidades, etapas, clareza, originalidade e qualquer afirmação factual antes de publicar. Não atribua revisão a quem não a realizou. Não declare receitas testadas sem um teste real. Os exemplos de preço são hipotéticos.

## Publicar um artigo revisado

1. Revise o objeto correspondente em `drafts.json`.
2. Mova o objeto para o array de `apps/web/src/editorial/content.json`; remova-o dos rascunhos para evitar duplicação na prévia.
3. Troque `status` para `published`, preencha `author`, `reviewedBy` e `publishedAt` com nomes e data reais. `updatedAt` é opcional, para revisões posteriores, no formato `AAAA-MM-DD`.
4. Preserve um `slug` único, com letras minúsculas sem acentos, números e hífens. Ele define o endereço público; evite alterá-lo depois de divulgar.
5. Mantenha `category` como `Receitas`, `Economia` ou `Organização`. As seções contêm `title`, `paragraphs` e, opcionalmente, `items`. Receitas também têm `recipe.yield`, `recipe.ingredients` e `recipe.steps`.
6. Execute os comandos abaixo e publique a mudança pelo fluxo Git do projeto.

```powershell
npm run build:web
npm run test:editorial --workspace @gondly/web
```

O build falha se faltar autoria, revisão ou data válida de um artigo publicado. Não coloque rascunhos em `content.json`: ele é o catálogo público e entra no bundle. O arquivo separado `drafts.json` é excluído do build de produção.

Esta entrega deixa `content.json` vazio intencionalmente. Os guias e a página sobre estão disponíveis; o blog e as receitas apresentam um estado de preparação até a publicação dos primeiros textos. Revise também os textos institucionais e os guias antes de colocar a entrega no ar.

## Anúncios

O slot editorial é opcional. Na `.env.frontend` da VPS, acrescente:

```dotenv
VITE_PUBLIC_SITE_URL=https://gondly.com.br
VITE_ADSENSE_ARTICLE_SLOT=
```

Preencha o slot somente com o ID de uma unidade criada para os artigos no seu AdSense. Não reutilize um ID de outra posição por conveniência. São mantidas as configurações existentes `VITE_ENABLE_ADS`, `VITE_AD_PROVIDER=adsense` e `VITE_ADSENSE_CLIENT_ID`.

O slot aparece depois do conteúdo de um artigo publicado, apenas com configuração completa e anúncios habilitados. Não aparece em prévias, guias, sobre, listas de artigos vazias nem páginas inexistentes. Nesta primeira versão, páginas editoriais não exibem anúncios para visitantes com sessão salva; isso preserva benefícios sem depender de consulta ao backend. Falha ao ler o armazenamento também mantém os anúncios ocultos.

As posições existentes do aplicativo são bloqueadas em login, carregamento, erro e ausência de conteúdo. A aba de cesta na comparação fica sem publicidade. O benefício sem anúncios continua sendo respeitado; enquanto a informação de benefício estiver indisponível, o anúncio não aparece.

**No painel do Google:** verifique anúncios automáticos e exclusões de páginas. Tags inseridas pelo Google Tag Manager ou anúncios automáticos podem inserir publicidade fora dos componentes controlados pelo código. Configure exclusões para login, páginas institucionais, erros e fluxos privados; se quiser controle apenas pelos slots manuais, desative anúncios automáticos. Essa configuração não foi alterada por esta implementação.

`ads.txt` já existe em `apps/web/public/ads.txt`. Seu conteúdo precisa ser entregue como texto em `https://gondly.com.br/ads.txt`, nunca como a página HTML do aplicativo. A ausência desse arquivo no painel antigo não prova que o arquivo falta no deploy atual.

## Atualizar o frontend na VPS

Execute depois que a mudança estiver integrada e disponível na branch usada em produção. Não há migration nem alteração na API ou PostgreSQL nesta entrega.

```bash
sudo -u deploy -H git -C /opt/gondly/monorepo status --short
sudo -u deploy -H git -C /opt/gondly/monorepo pull --ff-only
sudo -u deploy -H git -C /opt/gondly/monorepo log -1 --oneline
```

Se houver mudanças locais no repositório da VPS, confira-as antes do pull. Não as descarte.

O Dockerfile criado manualmente na VPS fica fora do repositório, em `/opt/gondly/production/Dockerfile`. Confira sua etapa `web` e faça uma cópia antes de editar:

```bash
cd /opt/gondly/production
cp -p Dockerfile "Dockerfile.backup-$(date +%Y%m%d-%H%M%S)"
nano Dockerfile
```

Na etapa `FROM nginx:stable-alpine AS web`, substitua **apenas o bloco que escreve `/etc/nginx/conf.d/default.conf`** (o bloco `COPY <<'NGINX'` até a linha final `NGINX`) por:

```dockerfile
COPY deploy/nginx.public.conf /etc/nginx/conf.d/default.conf
```

Preserve o `COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html`, o restante do Dockerfile e a leitura da `.env.frontend` via segredo de build. Esse caminho funciona com o contexto de build `/opt/gondly/monorepo` usado no deploy atual. Se a configuração real for diferente, ajuste o caminho de origem antes de construir.

A configuração versionada `deploy/nginx.public.conf` serve o HTML editorial e devolve HTTP 404 para artigos inexistentes, preservando o fallback SPA das rotas do aplicativo. Não precisa mudar os domínios nem o Caddy compartilhado da Flynance.

```bash
cd /opt/gondly/production
docker compose -f compose.yml -f compose.apps.yml config --quiet
docker compose -f compose.yml -f compose.apps.yml build web
docker compose -f compose.yml -f compose.apps.yml run --rm --no-deps web nginx -t
docker compose -f compose.yml -f compose.apps.yml up -d --no-deps --wait web
docker compose -f compose.yml -f compose.apps.yml ps
```

Só execute o `up` depois do build e do `nginx -t` terminarem com sucesso. Variáveis `VITE_*` são incorporadas no build: alterar `.env.frontend` e reiniciar o container não basta.

Valide após atualizar:

```bash
curl -I https://gondly.com.br/blog
curl -I https://gondly.com.br/guias/comparar-precos
curl -I https://gondly.com.br/blog/artigo-que-nao-existe
curl -sS https://gondly.com.br/ads.txt
curl -sS https://gondly.com.br/robots.txt
curl -sS https://gondly.com.br/sitemap.xml
```

Os dois primeiros retornam 200; o artigo inexistente retorna 404. Abra um guia no navegador, atualize a página e teste também em celular. Após publicar um artigo, confira seu endereço diretamente e verifique seu texto no código-fonte HTML.

O service worker muda de versão e remove o cache antigo. Guarda páginas editoriais por URL; uma navegação não substitui a home. O shell estático do app continua disponível para navegação offline, mas HTML de respostas privadas não é guardado no cache de navegação. Uma página editorial não visitada retorna uma mensagem de indisponibilidade offline em vez do texto de outro artigo.

## Nova análise do AdSense

Depois de revisar e publicar conteúdo, validar o site e concluir as informações de pagamento/vinculação no painel, solicite nova revisão. Não solicite revisão contando apenas com a tela de preparação do blog. A aprovação e os prazos são determinados pelo Google, não pelo build.

Referências oficiais: [site não pronto para anúncios](https://support.google.com/adsense/answer/12176698?hl=pt-BR) e [anúncios em telas sem conteúdo](https://support.google.com/publisherpolicies/answer/11112688?hl=pt-BR).
