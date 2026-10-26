# SEO Google — Implementation Plan

**Goal:** Entregar paginas publicas com HTML completo e metadados consistentes no dominio gondly.com.br.
**Spec:** ../specs/2026-10-26-seo-google-design.md (aprovado na conversa).
**Architecture:** Reaproveitar componentes React no prerender do Vite; manter um shell separado para rotas privadas e preservar o fluxo de login existente.
**Tech Stack:** React, Vite, Node test runner, Nginx, Docker Compose.

- [x] Testar home e paginas legais no render de servidor e metadados/artefatos de producao.
- [x] Prerenderizar home e paginas legais sem acessar dados do usuario; adicionar canonical e JSON-LD de marca/site.
- [x] Separar shell do app e atualizar metadados na navegacao; preservar offline e rotas privadas.
- [x] Versionar Dockerfile web/Nginx de producao e documentar adocao na VPS e Search Console.
- [x] Rodar testes, typecheck, build e revisar diff. Envio na branch `feat/seo-google`.

## Rulings

- Usar a branch solicitada no checkout atual, sem criar outro worktree; nao existem alteracoes de codigo pendentes.
- Nao publicar artigos automaticamente; o catalogo permanece vazio ate revisao editorial.
- Nao alterar autenticacao de gondly.app; o dominio confirmado e gondly.com.br.
- Corrigir tambem os fallbacks da Vercel para nao entregar a nova home em URLs privadas.
- Review: corrigidos os dois problemas identificados (fallback Vercel e caminho do overlay).
- Validacao: build web, typecheck completo, 61 testes de utils/API e 17 testes do frontend passaram;
  fluxo do script validado com comandos simulados e overlay validado com Docker Compose config.
- Limitacao: Docker Desktop nao esta rodando; Nginx/container precisam de verificacao HTTP apos deploy.
