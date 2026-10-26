# SEO do Gondly: proposta inicial

## Objetivo

Facilitar que o Google encontre e compreenda o Gondly e suas paginas publicas,
comecando por pesquisas da marca e por lista de compras de supermercado.
Indexacao e posicionamento dependem do Google; nao ha promessa de prazo ou posicao.

## Diagnostico em 26/10/2026

- Branch criada: `feat/seo-google`, a partir de `a56d87e`.
- `https://gondly.com.br/` responde HTTP 200. Seu HTML inicial tem o titulo
  `Gondly`, descricao generica e `div#root` vazio. A landing depende de JavaScript.
  Isso nao prova impedimento de indexacao, mas podemos entregar o conteudo diretamente.
- `www.gondly.com.br` redireciona para o dominio sem www.
- robots.txt permite rastreamento e aponta para um sitemap XML acessivel.
- O build ja gera HTML estatico para blog, receitas, guias e sobre.
- `content.json` esta vazio: nenhum artigo publicado.
- O sitemap inclui paginas legais que ainda usam o shell da aplicacao.
- O Nginx mostrado da VPS usa fallback para index.html em todas as rotas;
  a configuracao versionada para paginas publicas tem tratamento de 404 mais adequado.
- `gondly.app` responde HTTP 401 com autenticacao basica. Confirmar qual dominio e oficial;
  nao remover essa protecao sem confirmar a finalidade desse ambiente.
- O print da busca mostra correcao para outra palavra. Isso, sozinho, nao comprova
  ausencia do site no indice. A verificacao deve usar o Search Console.

## Abordagens

1. Corrigir primeiro a base tecnica e a pagina inicial (recomendada): aproveitar o
   prerender existente, melhorar metadados e validar o deploy. Resolve lacunas concretas
   sem exigir producao imediata de artigos.
2. Comecar por artigos e novas paginas de busca: amplia os assuntos cobertos, mas
   exige conteudo original e revisado enquanto as lacunas tecnicas permanecem.

## Primeira entrega proposta

- Gerar HTML inicial com conteudo real da landing, preservando login Google e PWA.
- Separar o HTML de entrada do app do HTML publico para evitar servir a landing
  como conteudo de todas as rotas internas.
- Definir titulo, descricao, URL canonica e metadados sociais por pagina publica.
- Adicionar dados estruturados de marca/site coerentes com o conteudo visivel;
  nao inventar avaliacoes, depoimentos ou resultados.
- Revisar sitemap, URLs com barra final, paginas legais e respostas de paginas inexistentes.
- Impedir indexacao de rotas de login, convite e app com a estrategia adequada,
  sem bloquear os arquivos que o Google precisa para renderizar paginas publicas.
- Versionar a configuracao Nginx/Docker de producao necessaria para essa entrega,
  acompanhada de instrucoes de atualizacao para a VPS.
- Documentar verificacao de propriedade, envio do sitemap e inspecao da home no Search Console.

## Validacao

Testar o HTML gerado para home e paginas publicas, metadados, canonical e sitemap;
confirmar que conteudo privado nao entra no build publico; rodar os testes do frontend,
typecheck e build. Depois do deploy, conferir HTTP, redirecionamentos e HTML servido.
Acompanhar indexacao no Search Console separadamente dos testes de codigo.

## Confirmacoes e acompanhamento

- Dominio canonico confirmado pelo usuario: `https://gondly.com.br`.
- O usuario ja tem uma propriedade verificada no Search Console?
- Primeira entrega tecnica aprovada na conversa: "vamos fazer os ajustes para aparecer no google".

## Referencia

https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=pt-br
