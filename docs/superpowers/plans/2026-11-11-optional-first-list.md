# Assistente opcional para primeira lista

Fluxo aprovado: oferecer “Gerar minha lista” e “Fazer depois” na tela inicial para contas sem listas nem compras anteriores. Manter o planejador acessível pela área de listas. Não criar listas sem revisão e confirmação.

Implementação: reutilizar DietPlanPage e o endpoint transacional existente; perguntar pessoas, período, refeições em casa e preferências alimentares. Ajustar sugestões por grupos de refeições, preservando compatibilidade para chamadas antigas sem essa opção. Estoque é revisado por item na etapa de revisão já existente.

Dispensa do convite: chave local por usuário, sem bloquear navegação. O convite não deve aparecer enquanto listas ou compras estão carregando/com erro. Não enviar respostas novas de refeições para analytics. Tutorial continua acessível manualmente.

Verificação: testes das quantidades e grupos de refeições, compatibilidade dos perfis existentes, tipos, build e testes frontend. Não há migration.

Resultados: 26 testes de utilitários e 35 testes frontend aprovados; verificação de tipos de todos os workspaces aprovada. Build web aprovado. Convite testado sem armazenamento e com dispensa isolada por conta. Descrição da lista resumida para respeitar os 500 caracteres permitidos pelo backend. Teste visual no aparelho e publicação continuam pendentes.
