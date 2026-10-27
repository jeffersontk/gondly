# Sugestão de mercados próximos

## Problema e resultado
Mercados sem endereço/coordenadas não entram na comparação por raio. O botão atual
atribui a posição do usuário à loja, mesmo sem confirmar onde a compra ocorreu.

Ao finalizar uma compra, o usuário solicita localização e recebe lojas próximas do
OpenStreetMap. A seleção explícita salva coordenadas da loja e endereço disponível.
Uma loja existente compatível é reutilizada; o cadastro manual continua disponível.
Os dados do mapa podem ser incompletos e nunca são apresentados como verificados.

## Implementação
1. Adicionar serviço de descoberta via Overpass: raio limitado, coordenadas de busca
   aproximadas, timeout, cache limitado e requisições iguais compartilhadas.
   Uma consulta externa por vez; outras áreas recebem indisponibilidade imediata,
   sem uma fila que possa continuar executando depois do timeout do cliente.
2. Endpoint autenticado `/markets/discover`, com validação de coordenadas e raio.
3. Identificar correspondência por placeId, nome e proximidade; permitir vincular
   um cadastro próprio sem localização apenas depois de confirmar a loja.
4. Substituir a gravação direta de GPS na finalização por sugestões e confirmação.
   Reutilizar cadastros por placeId e manter compras anteriores vinculadas ao mesmo ID.
5. Informar o uso do provedor e atribuição OSM; preservar o fluxo manual em falhas.
6. Incluir a busca também no cadastro/edição, preenchendo os dados para revisão
   antes do salvamento explícito e preservando a identidade externa na edição.

## Verificação
Testar parsing de lojas, coordenadas node/way, distância, dados ausentes, validação,
cache, correspondência entre filiais e reutilização de cadastro. Rodar typecheck,
testes pertinentes e builds. Testar consulta externa com ponto público conhecido,
sem utilizar a posição real do usuário em ferramentas de diagnóstico.

## Limites
O mapa não garante catálogo completo nem endereço completo. Sem correspondência,
o usuário pode cadastrar manualmente; não atribuir automaticamente a loja mais próxima.
Não mesclar cadastros de usuários diferentes. Configurar `OVERPASS_API_URL` para
trocar de instância; revisar capacidade antes de aumentar o volume de uso.
Provedor padrão: [Private.coffee](https://overpass.private.coffee/), que permite
uso comercial e pede consultas limitadas e identificação da aplicação.

## Validação externa pendente
Em 27/10/2026, consultas de teste em ponto público do Rio de Janeiro expiraram
tanto na instância principal do Overpass quanto na Private.coffee. HTTPS para
outro site respondeu normalmente. Não há evidência de consulta real bem-sucedida
neste ambiente; validar a conectividade/provedor antes de considerar a descoberta
externa homologada. Os testes automatizados usam respostas simuladas.

## Verificações locais concluídas
- Typecheck de todos os pacotes e builds da API e do frontend aprovados.
- 105 testes aprovados: 15 de utilitários, 62 da API e 28 do frontend.
- Endpoint registrado na API local e página de cadastro respondendo HTTP 200.
- Revisão estática concluída; indisponibilidade do provedor externo segue pendente.
