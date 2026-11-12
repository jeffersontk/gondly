# Ajuste opcional de porções por referência adulta

Escopo aprovado: considerar sexo, idade e atividade como referência inicial; a porção manual informada prevalece. Não inferir sexo por gênero. Preservar perfis v1 existentes em modo manual e armazenamento privado.

Referência: Dietary Guidelines for Americans 2020–2025, apêndice 2, tabela A2-2, páginas impressas 140–141 (PDF 153–154). URL: https://odphp.health.gov/sites/default/files/2026-02/dietary_guidelines_for_americans-2020-2025.pdf . Valores conferidos diretamente no PDF em 11/11/2026. É uma edição explicitamente identificada, não uma alegação de diretriz mais recente.

Implementar campos opcionais biologicalSex, ageYears, activityLevel e portionMode; referências apenas para adultos 18+. A escala da aplicação usa o valor tabular dividido por 2000 como convenção explícita, não como equivalência validada para gramas de ingredientes. O modo de referência é opt-in; casos fora do escopo usam porções manuais. Gênero não altera o cálculo. Dados incompletos não recebem um sexo, idade ou atividade padrão.

Limite material: a fonte estima energia populacional, não quilos de cada produto. O catálogo quantitativo atual continua provisório e não deve ser apresentado como plano nutricional. O motor de receitas/cardápio segue pendente e não faz parte desta alteração.

Verificar números em fronteiras etárias, prioridade manual, campos omitidos/perfis antigos, validação de tipos/idade, privacidade dos dados e persistência HTTP. Rodar testes, tipos e builds; enviar branch. Sem nova migration: perfil já é JSON versionado.

## Verificação concluída

- 31 testes de utilitários, 87 de API, 3 de importação e 36 frontend aprovados.
- Integração HTTP/PostgreSQL local aprovada com leitura e escrita dos campos novos, compatibilidade com perfil antigo e rejeição de idade inválida.
- Tipos e builds completos aprovados. Nenhuma migration nova ou alteração de produção.
- Verificação visual em aparelho e publicação na VPS continuam pendentes.
