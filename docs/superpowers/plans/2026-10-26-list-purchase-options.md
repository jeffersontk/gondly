# Opções de compra dos itens

Pedido: substituir o select de disponibilidade por radios Comprar/Não precisa
comprar este mês e permitir informar quantidade e unidade para os itens a comprar.

- [x] Testar duas opções, compatibilidade de at_home e quantidade fracionada.
- [x] Criar controle por item com quantidade/unidade, salvamento e erro visível.
- [x] Atualizar resumo, filtros e rótulos, sem migration destrutiva dos dados antigos.
- [x] Validar propagação da quantidade na lista compartilhada e compra em andamento nos testes de serviço.
- [x] Executar testes, typecheck, build e revisão antes do push.

Decisão: manter at_home no contrato da API para dados antigos e exibir como
not_needed na interface. Campos de quantidade salvam explicitamente para evitar
requisições a cada tecla. Quantidade da compra já precificada não será sobrescrita
por uma alteração de planejamento da lista.

Validação: 15 testes de utilitários, 48 testes da API e 18 testes do frontend;
typecheck completo e build web passaram. Revisão sem bloqueios encontrados.
Não foi realizado teste manual de interação no navegador nem teste de concorrência
com banco real nesta entrega; conferir o fluxo com duas contas após o deploy.
Publicação requer atualizar API e frontend (`scripts/update-vps.sh all`).
