# Preparações a partir das opções do plano

Gerar automaticamente uma sugestão culinária privada para cada combinação diária estruturada do plano. Usar somente carboidrato/proteína escolhidos, vegetais listados e temperos explicitamente permitidos. Preservar arroz+feijão como composição única; quantidade de vegetais é total, não por vegetal. Alternar o vegetal pelos dias. Não inferir calorias, conversão cru/cozido, prescrição ou peso de compra.

Implementar função pura compartilhada com nomes/porções e passos culinários para os alimentos reconhecidos. Partes não reconhecidas permanecem no cartão do plano, sem fabricar preparo. UI mostra título do prato, ingredientes, porções e detalhes de preparo, identificados como sugestão do Gondly. Escolhas existentes do calendário seguem como fonte; Trocar atualiza a preparação. Sem publicação ou gravação no catálogo público.

Testes: combinação exata, fontes de quantidades, vegetais total150g, temperos alternativos, mudança por dia e troca, nenhum alimento externo, casos sem informação retornam fallback.
