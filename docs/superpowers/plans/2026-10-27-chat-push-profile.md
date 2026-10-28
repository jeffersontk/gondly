# Mensagens: áudio, push e preferências no perfil

## Problema
O chat emitia apenas eventos WebSocket; não havia envio de push para mensagens.
O contexto de áudio só era preparado na tela da lista, sem preparar a saída de
áudio móvel nem tentar retomar um contexto previamente liberado e suspenso.

## Entrega
- Preparar áudio por interação desde a entrada no app, sem tocar mensagens antigas.
- Retomar o contexto liberado quando necessário e manter limite de sons em rajadas.
- Mover o controle de som para Perfil/Ajustes, com botão de teste e preferência por dispositivo.
- Enviar push após salvar mensagens, ao dono e membros atualmente aceitos, excluindo o autor.
- Falhas do push não afetam gravação ou entrega pelo canal em tempo real.
- Usar notificação do sistema fora da conversa visível e conectada; abrir a conversa ao tocar.
- Respeitar preferência de som no service worker. Volume, modo silencioso e permissões
  do sistema continuam controlados pelo usuário e pelo navegador.
- Permitir ativar/desativar push pelo perfil e informar ausência de configuração da API.
- Em desenvolvimento, registrar worker só de notificações após ativação explícita,
  sem interceptar requisições nem cachear o código servido pelo Vite.

## Configuração
API: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. As chaves devem permanecer
estáveis entre reinícios; a chave privada nunca é versionada. Ambiente local iniciado
com chaves salvas fora do repositório. Produção exige configuração própria e permissão
do navegador em cada dispositivo. No iOS, validar no PWA instalado na tela inicial.

## Verificação
Testar destinatários e permissões, ausência de envio ao próprio autor, falha isolada de
push, áudio móvel preparado por interação, retomada de contexto, limitação de rajadas,
notificações com app oculto, preferência silenciosa e supressão de duplicata em conversa
visível/conectada. Rodar testes, tipos e builds e verificar configuração local de push.
Entrega real e som físico dependem de teste no aparelho com autorização do usuário.
