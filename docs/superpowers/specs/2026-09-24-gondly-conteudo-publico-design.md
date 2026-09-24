# Área pública editorial do Gondly

Data: 2026-09-24
Status: proposta para revisão do responsável pelo produto.

## Objetivo e decisões aceitas

Criar artigos públicos de receitas, economia e organização de compras, conectados ao Gondly. O usuário escolheu começar com artigos preparados com ajuda de IA e revisão humana, em vez de um gerador de receitas em tempo real. Integrar esta entrega aos ajustes de posicionamento de anúncios e descoberta das páginas públicas. A aprovação do AdSense depende do Google; esta entrega não a garante.

## Abordagem recomendada

Conteúdo estruturado versionado no repositório, com HTML gerado no build e navegação no frontend React/Vite existente. Evita dependência de login, API e banco para ler artigos. Usar uma fonte única para conteúdo, URLs, metadados e sitemap. Manter a aplicação privada e sua autenticação existentes.

Alternativas consideradas: CMS com painel editorial facilita edição por pessoas não técnicas, mas adiciona autenticação, armazenamento e manutenção; páginas somente renderizadas no cliente são mais simples, mas não entregam o texto no HTML inicial. Nesta etapa, preferir geração estática e edição via Git.

## Páginas e experiência

- /blog: índice com categorias Receitas, Economia e Organização, cards com resumo e navegação acessível.
- /blog/:slug: título, resumo, autoria real, datas reais, sumário quando útil, conteúdo completo e artigos relacionados.
- /receitas: seleção dos artigos de receitas, apontando para seus URLs canônicos em /blog, sem duplicar o texto integral.
- /guias/lista-de-compras e /guias/comparar-precos: guias públicos completos com exemplos práticos.
- /sobre: propósito do Gondly e explicação do processo editorial, sem inventar equipe, credenciais ou avaliações.
- Integrar links ao blog, receitas, guias e sobre na landing e na navegação pública. Reutilizar privacidade, termos e contato existentes.
- Usar identidade visual atual (paper, ink, mint), layout responsivo, foco visível e hierarquia de títulos.
- A leitura funciona com ou sem sessão. Chamadas para organizar compras levam ao fluxo existente de acesso ao aplicativo. Importação automática de ingredientes fica fora desta etapa, pois exige um fluxo próprio de persistência e autenticação.
- Slug inexistente apresenta página de conteúdo não encontrado, sem anúncio nem redirecionamento para login. A configuração de hospedagem deve devolver HTTP 404 para URLs editoriais inexistentes.

## Conteúdo e publicação

Preparar seis rascunhos originais: planejamento semanal de compras; comparação de embalagens por preço unitário; organização da despensa; organização da compra com orçamento definido; receita de macarrão com legumes; receita de omelete de legumes.

Cada receita deve conter ingredientes, quantidades, rendimento estimado, etapas e substituições pertinentes. Não inventar custo atual, informação nutricional, teste culinário ou promessa de economia. Valores usados em comparações serão exemplos explicitamente hipotéticos. Informações factuais que precisem de comprovação devem ter fontes verificadas.

Modelo de conteúdo: slug, título, resumo, categoria, seções estruturadas, estado draft/published, autoria, datas de publicação e atualização e dados opcionais de receita. Autoria e revisão só são atribuídas com confirmação humana. Rascunhos podem ser visualizados localmente para revisão, mas não entram no build público, sitemap, relacionados ou anúncios. Publicação exige revisão explícita do conteúdo; não confundir aprovação técnica do desenho com revisão editorial dos textos.

Não usar HTML arbitrário inserido com dangerouslySetInnerHTML para o corpo dos artigos. Campos estruturados renderizados por componentes compartilhados reduzem divergências entre HTML estático e navegação.

## Anúncios e indexação

Remover /login da permissão de anúncios. Impedir anúncios em carregamento, erro e estados vazios nas posições existentes de home, listas, histórico e comparação. Preservar o benefício de usuários sem anúncios e as flags existentes.

Artigos publicados poderão ter um bloco identificado como Publicidade após conteúdo substancial, mediante configuração explícita de slot editorial; ausência de slot não gera solicitação. Não reutilizar arbitrariamente IDs de outras posições. Rascunhos, páginas institucionais, resultados vazios e páginas inexistentes não exibem anúncios. Verificar também se anúncios automáticos ou tags externas podem contornar os bloqueios do aplicativo; eventuais exclusões no painel do Google serão documentadas.

Preservar o ads.txt existente e conferir sua resposta pública como texto, sem fallback HTML da SPA. Gerar sitemap apenas com páginas públicas publicadas, URLs canônicas e metadados específicos. robots.txt deve permitir conteúdo público; não é mecanismo de proteção de dados. Nenhum dado privado entra no HTML gerado.

Revisar o service worker: hoje uma navegação pode substituir o cache da raiz pelo HTML de qualquer página. Com HTML por rota, guardar e recuperar navegações pela URL apropriada, evitando apresentar um artigo como home ou outro artigo offline. Testar atualização de conteúdo e ausência de cache de respostas privadas.

## Arquivos e deploy

Mudanças previstas em apps/web: rotas, páginas e componentes públicos, dados editoriais, geração estática, política de anúncios, service worker e metadados. Scripts de build devem preservar os artefatos e comandos usados pelo Docker atual.

Documentar ajuste do Nginx para servir páginas estáticas e retornar 404 nas rotas editoriais inexistentes, mantendo fallback da aplicação nas rotas privadas. Conferir a configuração real de deploy antes de orientar sua alteração. Preservar a modificação já existente em DEPLOY.md; criar documentação específica para esta entrega.

## Validação e critérios de aceite

- Typecheck e build web passam.
- Testes de elegibilidade de anúncios cobrem login, erro, vazio, carregamento e benefício sem anúncios.
- Testes de publicação excluem rascunhos de todas as saídas públicas.
- HTML inicial de um artigo publicado contém seu título e texto sem executar JavaScript.
- Metadados e sitemap correspondem ao catálogo publicado; não existem links quebrados entre páginas editoriais.
- Abrir URL pública diretamente e recarregar funciona; usuário autenticado também consegue ler.
- URLs editoriais inválidas retornam 404 na hospedagem configurada e não mostram anúncios.
- Navegação móvel, teclado, estados vazios e cache do service worker são verificados.
- Entregar rascunhos para revisão e instruções para publicar, atualizar a VPS e solicitar nova análise no AdSense. Cadastro de pagamento e pedido de revisão dependem do titular da conta.

## Fora do escopo

Gerador de receitas online, painel de CMS, integração com provedor de IA, mudanças no banco/autenticação/cobrança, importação automática de ingredientes e negociação de patrocínios.
