# Catálogo de receitas, ingredientes e despensa

Escopo aprovado: implementar o schema proposto para os dois caminhos de geração. Alimentação inicial administrativa por JSON. Ampliação solicitada: receitas de usuários com autoria, visibilidade privada/por link/pública e avaliações únicas por usuário, de 1 a 5 estrelas, com comentário opcional e moderação.

1. Criar ingredientes globais e aliases, receitas com passos/ingredientes/tags, origem e estado editorial.
2. Relacionar ingredientes a produtos, itens da lista e snapshots de compra sem alterar histórico existente.
3. Criar estoque confirmado por usuário, movimentos rastreáveis e deduplicação de entradas da mesma compra. Compra histórica não vira estoque automaticamente.
4. Criar planejamento de receitas por data/refeição/porções. Quantidade qualitativa sem conversão fica explicitamente desconhecida.
5. Migration aditiva com constraints, importador administrativo transacional com validação e modo de verificação sem escrita. Exemplo de receita em rascunho, sem alegar teste culinário.
6. Validar Prisma, gerar cliente, aplicar migration somente no PostgreSQL local e testar integridade e importação repetida. Registrar entrega; geração, matching e telas serão módulos seguintes.

Unidades-base de ingrediente: g, ml ou un. Conversão de embalagens exige conteúdo conhecido; não inferir equivalência por nome ou preço. Disponibilidade e movimentos são privados por usuário. Serviços futuros precisam verificar propriedade/participação antes de consultar compras e despensa.

Nesta etapa são entregues schema, migration, importador e testes. Endpoints e telas de receitas de usuários, compartilhamento, avaliações e geração serão implementados em seguida. Serviços deverão impedir autoavaliação, garantir que receitas privadas não sejam retornadas, gerar tokens aleatórios revogáveis e filtrar receitas/avaliações conforme moderação. Slug público não concede acesso a receita privada. Importação administrativa não aceita autor, tokens nem avaliações.

## Evidências

- Prisma validate e geração de cliente concluídos.
- Migration aplicada no PostgreSQL local, porta 15432; a porta de desenvolvimento anterior estava indisponível no Windows. Nenhuma migration executada em produção.
- Diff entre banco e datamodel sem diferenças.
- 26 testes de utilitários, 87 da API, 3 do importador e 1 integração de schema/importação no PostgreSQL aprovados.
- Typecheck de todos os workspaces e build da API aprovados.
- Importador em modo de validação verificou o JSON de exemplo sem gravação. Integração usa fixtures isoladas e limpa seus dados.
