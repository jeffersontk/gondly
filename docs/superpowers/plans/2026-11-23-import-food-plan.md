# Importar plano alimentar

Escopo autorizado: receber arquivo na tela Meu plano e montar o plano privado no Gondly. Extrair PDF textual no navegador, também aceitar DOCX/TXT. Identificar refeições por título e horário, preservar o texto e todas as quantidades, separar apenas opções numeradas explícitas e apresentar revisão editável obrigatória. Não transformar alternativas OU em ingredientes cumulativos, não estimar calorias, não criar receitas públicas ou instruções inexistentes. PDF digitalizado sem texto apresenta orientação de colar/digitar o conteúdo.

Persistir estrutura revisada em campo JSON opcional de MealPlan, com período definido pelo usuário e versão para gravação concorrente. Não guardar arquivo original nem texto completo fora das refeições revisadas. Guardas de autenticação e filtro userId em todas as operações. Escolhas por dia e refeição no calendário, sem assumir primeira opção. Cardápios existentes continuam disponíveis e listas existentes não são alteradas.

1. Testar parser com alternativas, conteúdo multipágina, refeições sem hora e arquivos vazios.
2. Implementar extração reutilizável e parser conservador com revisão do texto.
3. Migração aditiva, DTOs validados, criação privada, listagem unificada e escolha por data com versão.
4. Formulário de importação/revisão e refeições importadas no calendário.
5. Testes API de isolamento, datas inválidas, concorrência e persistência; typecheck/build; verificar arquivo real sem versionar dados pessoais. Iniciar local após migração.

A lista automática a partir do texto prescrito depende de futura estruturação de ingredientes e confirmação de pesos de compra; não inferir esses dados nesta importação.
