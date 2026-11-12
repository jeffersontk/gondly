# Starter recipe catalog implementation plan

> Executar com a skill superpowers:executing-plans, em etapas verificáveis.

**Objetivo:** cadastrar os 45 preparos pesquisados em um catálogo compartilhado, utilizável para gerar listas, e preparar a mesma carga para a VPS.

**Arquitetura:** reutilizar o importador transacional e idempotente existente. Fichas adaptadas para o Gondly terão quantidades explícitas, instruções próprias, fonte, origem ai_assisted e revisão editorial técnica identificada, sem alegar teste culinário ou nutricional. Não preencher calorias sem fonte correspondente à formulação.

**Especificação:** aprovação do usuário para cadastrar a seleção de `docs/research/2026-11-11-recipe-shortlist.json` e proposta de fichas padronizadas apresentada nesta conversa.

**Stack:** JSON, Node, Prisma/PostgreSQL, NestJS e React existentes; sem novas dependências ou migrations.

## Restrições e pontos de revisão

- Preservar receitas e listas dos usuários; reimportar os mesmos slugs sem duplicar receitas, ingredientes ou etapas.
- Incluir todas as partes dos pratos feitos e registrar peso cru/cozido; não deixar receitas principais com quantidades desconhecidas.
- Não transportar calorias das referências para as adaptações; preparos sem energia continuam fora do planejador calórico.
- Distinguir acompanhamento de refeição; sem tags de refeição para arroz, feijão e outros componentes isolados.
- Mostrar origem e limites da revisão na interface e não afirmar publicação na VPS sem executá-la.

## Execução

- [x] Preparar lote com 45 receitas e ingredientes canônicos, fonte, rendimento, instruções e alérgenos.
- [x] Validar o contrato do importador e calcular ingredientes de todas as receitas, sem quantidades desconhecidas.
- [x] Exibir fonte e atribuição no detalhe da receita.
- [x] Importar duas vezes no PostgreSQL local explícito, conferir disponibilidade do catálogo e ausência de duplicatas.
- [x] Fornecer script de importação na VPS usando a imagem atualizada, sem imprimir credenciais.
- [x] Revisar e executar verificações antes de commitar e enviar a branch.

## Registro de execução

- 45 receitas e 82 ingredientes cadastrados no PostgreSQL local em `127.0.0.1:15432`; a carga foi repetida e as mesmas 45 fichas permaneceram.
- Build completo aprovado, 31 testes de utilitários, 90 de API, 5 de catálogo e 37 de frontend aprovados; mais 3 verificações de integração com PostgreSQL real aprovadas.
- A integração consultou todas as receitas por uma conta nova, verificou a fonte, calculou os ingredientes e criou uma lista de prato feito mantendo a lista anterior.
- Revisão independente encontrou colisão entre slugs canônicos e nomes já cadastrados por usuários. Correção implementada e teste PostgreSQL observado falhar antes e passar depois: reutilizar ID/slug existente por nome normalizado com unidade compatível; incompatibilidades continuam bloqueadas atomicamente.
- Sintaxe Bash do script da VPS aprovada; API e frontend locais responderam HTTP 200. Verificação visual manual não realizada nesta etapa.
- Decisão editorial: todas são formulações adaptadas com IA. Nenhuma recebeu valores calóricos de outra formulação. Revisão técnica/editorial do Codex identificada sem alegar teste culinário ou revisão nutricional.
- Execução da carga na VPS permanece com o usuário; sem conexão ao servidor neste ambiente.
