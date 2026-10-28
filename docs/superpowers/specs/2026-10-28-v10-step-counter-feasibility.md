# Estudo de Viabilidade Técnica: Contador de Passos em PWA e Dispositivos Móveis (V10)

Data: 28/10/2026  
Status: Concluído  
Contexto: Avaliação da viabilidade técnica de contagem de passos durante as compras no Gondly.

---

## 1. Escopo Definido

- **Escopo Inicial Aprovado:** Acompanhamento da contagem de passos durante a **sessão de compra ativa** no mercado (da abertura do carrinho na loja até o fechamento no caixa).
- **Justificativa:** O usuário mantém o aplicativo aberto para consultar a lista, riscar itens e registrar preços enquanto caminha pelos corredores. O trajeto até o mercado (ônibus, carro ou caminhada externa) traz variações de transporte que demandariam geolocalização contínua de alta precisão, gerando alto consumo de bateria.

---

## 2. Investigação de Sensores e Permissões por Plataforma

### 2.1 Android (Chrome / Chromium PWA)
- **APIs Web:**
  - `DeviceMotionEvent` (`devicemotion`): Amplamente suportado em páginas HTTPS. Fornece `acceleration` e `accelerationIncludingGravity` em $m/s^2$.
  - `Generic Sensor API` (`Accelerometer`, `LinearAccelerationSensor`): Suportado no Chrome Android, porém exige permissões de política e nem sempre está habilitado em todos os webviews ou browsers secundários.
- **Permissões:** Em navegadores Chromium, eventos de movimento não exigem diálogo modal de permissão explícita por padrão, desde que em contexto seguro (HTTPS) e ativados por contexto da página.
- **Comportamento em Segundo Plano e Tela Bloqueada:**
  - **Limitação Crítica do Navegador:** O Chromium no Android suspende ou limita severamente a taxa de amostragem de `devicemotion` e timers JavaScript quando o PWA entra em background ou a tela do aparelho é desligada.
  - O navegador faz isso intencionalmente para economia de bateria e proteção de privacidade (evitar rastreamento de giroscópio/acelerômetro em segundo plano).

### 2.2 iOS (Safari / WebKit PWA)
- **APIs Web:**
  - `DeviceMotionEvent`: Suportado.
- **Permissões:**
  - Desde o iOS 12.2+, a chamada `DeviceMotionEvent.requestPermission()` é estritamente obrigatória.
  - Essa chamada **precisa ser disparada diretamente por um gesto do usuário** (ex.: toque no botão "Iniciar contagem" ou "Ativar sensor").
  - Se chamada fora de um manipulador de evento de clique direto, a promise é rejeitada.
- **Comportamento em Segundo Plano e Tela Bloqueada:**
  - **Congelamento Imediato:** No iOS, qualquer PWA adicionado à Tela de Início ou aba do Safari tem a execução de JavaScript completamente congelada quando a tela é bloqueada ou o usuário muda de app. Não há execução de sensores em background via Web API no iOS.

### 2.3 Desktop e Navegadores sem Sensores
- Sensores de acelerômetro retornam valores nulos ou o evento `devicemotion` nunca é disparado.
- Requer detecção graciosa de suporte para não emitir erros no console nem bloquear o fluxo de compra.

---

## 3. Comparação de Alternativas Técnicas

| Critério | Alternativa A: PWA Foreground Session (Adotada) | Alternativa B: PWA com Audio Worker Hack | Alternativa C: Integração Nativa (Health Connect / HealthKit) |
|---|---|---|---|
| **Arquitetura** | Sensor no cliente (`devicemotion`) durante a tela ativa | Manter áudio silencioso tocando para impedir suspensão | App nativo via Capacitor ou TWA com plugins de saúde |
| **Suporte PWA Atual** | 100% nativo da Web, sem dependências externas | Instável; rejeitado por políticas de energia de SOs | Requer empacotamento, publicação em lojas e build nativo |
| **Comportamento Tela Ativa** | Alta precisão para caminhada em corredores | Alta precisão | Excelente (lê do coprocessador do chip) |
| **Comportamento Tela Bloqueada** | Pausado (retoma ao desbloquear) | Drena bateria e pode ser morto pelo SO a qualquer momento | Continua contando em background no SO |
| **Consumo de Bateria** | Muito baixo (amostragem adaptativa $50-60\text{Hz}$) | Alto (mantém CPU acordada) | Mínimo (hardware dedicado do aparelho) |
| **Privacidade** | Dados locais, usuário decide se salva ao finalizar | Dados locais | Requer permissão sensível de saúde do Android/iOS |
| **Complexidade** | Baixa a moderada | Alta e frágil | Muito alta (novo ciclo de publicação e release) |

---

## 4. Decisão de Implementação na V10

1. **Abordagem Adotada:**
   - **Alternativa A (Foreground Shopping Session):** O contador opera durante a compra com a tela do app ativa (que é o momento em que o usuário manipula o carrinho, confere itens e adiciona produtos).
   - O algoritmo utiliza filtro de pico de aceleração (peak detection):
     - Módulo de aceleração: $r = \sqrt{a_x^2 + a_y^2 + a_z^2}$.
     - Filtro dinâmico: identifica picos entre $1.15g$ e $2.0g$ com intervalo refratário mínimo de $280\text{ms}$ para descartar trepidação e movimentos curtos do carrinho.
     - Estimativa de distância baseada no passo médio padrão ($0.75\text{m}$).
2. **Controles Disponíveis ao Usuário:**
   - Ativação 100% opcional (o usuário clica para iniciar).
   - Botões de Pausar, Retomar e Zerar.
   - Mensagem amigável quando o sensor não é suportado ou a permissão foi negada: *"Sensor indisponível neste aparelho. A contagem de passos é opcional e não afeta sua compra."*
3. **Privacidade e Retenção de Dados:**
   - Ao finalizar a compra, se passos foram contados, o usuário pode escolher se deseja armazenar o registro no histórico ou descartar.
   - Os dados são salvos no campo opcional `stepCount` da `Purchase`.
   - Na página de detalhes da compra, o usuário possui a opção de **excluir os dados de passos** a qualquer momento.
4. **Próximo Passo Futuro (se houver demanda para tela bloqueada):**
   - Caso os usuários solicitem acompanhamento com o celular no bolso durante trajetos longos, a alternativa C (empacotamento Capacitor com Health Connect/HealthKit) deverá ser agendada em entrega futura com esforço estimado em 2 sprints de desenvolvimento mobile.

