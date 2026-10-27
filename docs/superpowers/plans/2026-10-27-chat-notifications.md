# Avisos do chat durante a compra

Escopo confirmado: usuário está com o Gondly aberto preparando a lista; adicionar
banner tocável com remetente/prévia, contador de não lidas e som curto.

- [x] Testar contagem, mensagens próprias/lidas, deduplicação e política do som.
- [x] Compartilhar a lógica entre lista e compra ativa, preservando o histórico.
- [x] Adicionar banner persistente até abrir/dispensar e contador no botão do chat.
- [x] Adicionar som com desbloqueio por interação, limite de frequência e preferência de silêncio.
- [x] Validar testes, tipos, build e revisão; entrega na branch feat/chat-notifications.

Decisões: não implementar push nesta entrega; som só para evento novo de outra
pessoa, com página visível e conversa fechada. Histórico/refetch não toca som.
Dispensar o banner não marca mensagens como lidas. Abrir conversa visível marca
como lidas; mensagem própria não conta como não lida. Falha de áudio/armazenamento
não deve bloquear o chat. Não registrar conteúdo das mensagens em analytics.

Correção de recuperação: servidor busca as últimas 50 mensagens e devolve em ordem
cronológica. Respostas de histórico são mescladas com o cache para preservar
mensagens que chegam durante a requisição. Revisão identificou a limitação anterior
das primeiras 50; teste de regressão com 60 mensagens reproduziu e validou a correção.

Verificação: 15 testes de utilitários, 49 da API e 19 do frontend passaram;
typecheck completo e build web passaram. Revisão final sem bloqueios.
Os testes de áudio usam contexto simulado; reprodução real e transições de
visibilidade precisam de conferência no celular. Testes de artefatos devem rodar
após o build, pois um build simultâneo remove temporariamente os arquivos dist.

## Conferência após publicar

Atualizar API e frontend com `bash scripts/update-vps.sh all`.

1. Com duas contas na mesma lista, tocar em um controle no celular receptor para
   liberar áudio conforme a política do navegador e manter o chat fechado.
2. Enviar mensagem pela outra conta: conferir som curto, remetente, prévia e contador.
3. Dispensar o banner: o contador deve continuar; enviar outra mensagem deve exibir novo aviso.
4. Abrir pelo banner: conferir conversa e contador zerado. Mensagens próprias e
   mensagens recebidas enquanto a conversa está visível não devem tocar som.
5. Silenciar, fechar e reabrir a conversa/página: a preferência deve permanecer.
6. Conferir os mesmos passos na compra ativa. Desconectar e reconectar: conferir
   histórico recente preservado sem reproduzir sons de mensagens antigas.

Referência: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
