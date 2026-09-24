# Gondly Public Content Implementation Plan

Goal: entregar área editorial pública, HTML indexável e bloqueios seguros de anúncios.
Architecture: catálogo estruturado compartilhado por páginas React e geração HTML pós-build. Bootstrap público independente do bootstrap autenticado. Rascunhos somente no modo local de revisão.
Tech Stack: React 18, Vite, TypeScript, Node test runner, Nginx existente.
Spec: docs/superpowers/specs/2026-09-24-gondly-conteudo-publico-design.md

## Restrições
Preservar DEPLOY.md local e autenticação/banco/cobrança. Não publicar rascunhos automaticamente. Não inventar autoria, revisão humana ou teste culinário. Trabalhar nesta branch, execução local autorizada pelo usuário.

## Tarefas
- [ ] 1. Catálogo e critérios de publicação: criar apps/web/src/editorial/catalog.mjs, content.json, drafts.json e tests/editorial.test.mjs. Testar slug inválido, duplicado, rascunho e dados de revisão incompletos. Executar node --test apps/web/tests/*.test.mjs antes e depois da implementação.
- [ ] 2. Páginas públicas: criar PublicSite.tsx, public-main.tsx e editorial.css. Separar bootstrap de rotas públicas em main.tsx; preservar bootstrap original em app-main.tsx. Índice, receitas, guias, sobre, artigo e 404 usam o mesmo catálogo. Rascunhos via importação condicional exclusiva de DEV, preview rotulado e noindex. Navegação pública usa links HTML para funcionar sem JavaScript. Criar seis rascunhos e dois guias; guias sem alegações de autoria humana/revisão.
- [ ] 3. Build público: scripts/build-editorial.mjs carrega renderer SSR via Vite e insere HTML no template de dist. Gerar canonical, description, sitemap e robots apenas de páginas publicadas. Adicionar ao comando build web. Testar artefatos sem JavaScript e ausência de rascunhos.
- [ ] 4. Anúncios: extrair política pura, testar rotas permitidas e estado de conteúdo, bloquear login/carregamento/erro/vazio e respeitar hasNoAds. Atualizar consumidores. Slot editorial exige configuração explícita; nenhum anúncio em rascunhos ou institucionais. Não solicitar ads sem status de benefício resolvido.
- [ ] 5. Cache e hospedagem: service worker não armazena HTML autenticado nem substitui home por artigo. HTML editorial público usa cache pela URL; fallback offline não apresenta texto de outra rota. Entregar snippet Nginx com 404 editorial, preservando SPA privada. Testes Node em VM para cache e política de anúncios.
- [ ] 6. Validar typecheck/build/testes, preview visual desktop/mobile e navegação. Documentar publicação/revisão, ads.txt, exclusões de anúncios automáticos e deploy em docs/conteudo-publico.md.

## Foco da revisão
- Sessão ativa não pode redirecionar artigos para app.
- Rascunhos não podem vazar em bundle/sitemap/HTML de produção.
- Falha de API não pode impedir leitura pública nem liberar anúncios para assinantes sem publicidade.
- URLs inválidas e navegação offline não podem mostrar outro artigo.
- Troca de filtro/tab com zero resultados não pode manter anúncio carregado.

## Registro
2026-09-24: desenho aprovado e usuário pediu seguir com desenvolvimento; execução nesta sessão. Branch dedicada no checkout existente para preservar dependências e DEPLOY.md. Sem push/deploy nesta fase. Cadastro editorial será validado antes de gerar artefatos; testes usam fixtures publicadas para não simular revisão dos rascunhos reais.
