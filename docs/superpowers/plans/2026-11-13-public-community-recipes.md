# Receitas públicas da comunidade

**Decisão do usuário:** publicação imediata quando o próprio autor escolher publicar. Não exigir aprovação administrativa. Privadas existentes continuam privadas.

**Plano:** expor catálogo e páginas HTML públicas renderizadas na API, acessíveis por `/receitas` e `/receitas/:slug` via proxy do web, com conteúdo completo, autor de exibição, atribuição, canonical e dados estruturados somente de fatos existentes. O autor pode publicar e retirar a própria receita; não controla as de outros. Não inserir anúncios ou inventar avaliações/fotos para satisfazer rich results. Sitemap próprio de receitas ligado ao sitemap principal; páginas privadas e retiradas retornam 404 sem cache público. Publicação é independente de deploy/rebuild.

**Validação:** integração HTTP anônima para indexação, consentimento explícito, retirada, controle de dono, sanitização, ausência de dados particulares e publicação sem alegar revisão. Verificar build, regressões e configuração de proxy. Publicação imediata aceita pelo usuário; esta implementação não garante aprovação no AdSense.

## Resultado

- Implementado cadastro com opt-in booleano e publicação/retirada pelo dono; privado continua sendo o padrão. Revisão editorial não é inventada.
- Publicação exige novas migrations apenas de constraints, aplicadas no PostgreSQL local explícito. O catálogo editorial continua exigindo revisão; receita comunitária pode ser publicada por seu autor conforme a decisão do usuário.
- Páginas HTML públicas e sitemap dinâmicos com DTO de seleção restrita, textos escapados e JSON-LD sem fotos, avaliações ou energia fabricadas. Autoria removida não vira atribuição ao catálogo.
- Catálogo paginado, atalhos para criar lista e publicar, aviso de autoria e atualização das informações de privacidade/compartilhamento.
- Service worker não guarda nem recupera receitas comunitárias offline, inclusive após retirada. Outras páginas editoriais mantêm o comportamento anterior.
- Revisão independente sem problemas importantes confirmados. Alias do proxy confirmado no Compose fornecido pelo usuário; proxy real Nginx ainda não executado na VPS.
- Testes: 31 utilitários, 90 API, 5 catálogo, 38 frontend e 4 integrações PostgreSQL aprovados. Cenário HTTP inclui publicação explícita, não dono, conteúdo HTML, roundtrip do JSON-LD, sem e-mail, sem foto inventada e retirada com 404/sitemap atualizado.
- Vite encaminha páginas e sitemap locais para a API; deploy é destinado à VPS com o overlay Nginx existente. Não há publicação na VPS por este ambiente nem verificação visual manual nesta etapa.
