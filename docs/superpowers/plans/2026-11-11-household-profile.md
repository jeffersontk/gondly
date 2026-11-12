# Perfil da casa no assistente

Escopo autorizado: coletar informações úteis para planejar compras. Cada pessoa tem faixa etária opcional, gênero opcional, porção habitual e dias por semana em casa por refeição. Não coletar nome completo, nascimento, peso, altura ou informações clínicas.

Implementar tipos compartilhados, formulário reutilizável e armazenamento privado em User.planningProfile (JSON versionado), com salvar/excluir explícitos. Dieta e restrições continuam na configuração da casa. Nenhuma informação demográfica deve ir para analytics nem para descrição de listas compartilhadas.

Apenas porção escolhida e frequência de refeições afetam a escala atual; idade e gênero ficam como contexto, sem coeficientes nutricionais inventados. Exibir os fatores relativos da porção e o aviso de que o catálogo quantitativo ainda é provisório, sem referência de consumo validada. O cálculo por receitas depende do módulo seguinte.

Testar validação, isolamento por usuário, restauração/exclusão de perfil e ausência de influência de gênero/idade nas quantidades. Aplicar migration somente local, validar tipos e builds, atualizar documentação e enviar branch.

## Entrega e limites

Perfil com versão 1, validado no servidor, sob `/users/me/planning-profile` (GET, PUT, DELETE autenticados). Não há parâmetro de usuário vindo do cliente. Resposta de leitura usa no-store e o frontend não grava essa consulta no cache offline. Falhas não sobrescrevem o perfil salvo.

Os fatores 0,75/1/1,25 são relações explícitas de porção escolhidas pelo usuário, não referências nutricionais. Pessoas com menos de 3 anos são excluídas do catálogo genérico e precisam de itens adicionados na revisão. Porções e frequência não corrigem a falta de um cardápio: a interface mostra que a estimativa ainda usa quantidades-base provisórias. Não foram coletados dados clínicos nem datas de nascimento.

Verificação: 28 testes de utilitários, 87 de API, 3 de importação e 36 frontend aprovados; integração HTTP com PostgreSQL local validou salvar, carregar, excluir, autenticação, isolamento entre duas contas e rejeição de campos de propriedade. Tipos e builds completos aprovados. Testes frontend executados em sequência após falha nativa do V8/Vite no modo paralelo; validação visual em aparelho continua pendente.
