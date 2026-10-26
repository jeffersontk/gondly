# Deploy Gondly

## Atualizar a VPS com Docker

Na VPS atual, execute como usuario `deploy`:

```bash
cd /opt/gondly/monorepo
bash scripts/update-vps.sh
```

O script atualiza a branch atualmente selecionada pelo remoto `origin`, com fast-forward,
reconstroi a API e aguarda ate 180 segundos pelo healthcheck. Alteracoes locais ou
branches divergentes interrompem a atualizacao. Se o build falhar, o container atual
continua rodando. Se a verificacao de saude falhar depois da substituicao, o script
exibe os logs e termina com erro; nao faz rollback automatico.

Para atualizar o frontend ou ambos os servicos:

```bash
bash scripts/update-vps.sh web
bash scripts/update-vps.sh all
```

Usa `/opt/gondly/production/compose.yml` e `compose.apps.yml`, com o projeto
`gondly-prod`. Requer Bash, Git, flock e Docker Compose com suporte a `up --wait`.
Nao altera arquivos `.env` nem executa migrations: entregas com mudancas de banco
exigem aplicar as migrations conforme as instrucoes da entrega antes do reinicio.

Na primeira utilizacao, baixe o script com `git pull --ff-only` dentro do repositorio.
Depois disso, basta executar o script. Para verificar seu fluxo sem acessar a VPS:
`bash scripts/test-update-vps.sh` (usa comandos simulados).

Este monorepo esta preparado para:

- Vercel: PWA React/Vite em `apps/web`.
- Render: API NestJS em `apps/api`.
- Supabase: PostgreSQL usado pelo Prisma.

## 1. GitHub

Antes de subir:

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

Nao commite arquivos `.env`. Use apenas os `.env.example`.

## 2. Vercel

Crie um projeto apontando para o repositorio do GitHub. Use a raiz do monorepo como root do projeto. O arquivo `vercel.json` ja define:

```txt
installCommand = npm ci
buildCommand   = npm run build:web
outputDirectory = apps/web/dist
```

Variaveis de ambiente no projeto Vercel:

```env
VITE_API_URL="https://SEU-SERVICO-RENDER.onrender.com"
VITE_WS_URL="https://SEU-SERVICO-RENDER.onrender.com"
VITE_GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
VITE_APP_URL="https://SEU-PROJETO.vercel.app"
VITE_ENABLE_ADS="true"
VITE_ADSENSE_CLIENT_ID=""
```

Depois do primeiro deploy da Vercel, copie a URL final para configurar `FRONTEND_URL` e `WEB_ORIGIN` no Render.

Se o projeto da Vercel estiver com Root Directory em `apps/web`, use:

```txt
buildCommand = npm run build:web
outputDirectory = dist
```

O arquivo `apps/web/vercel.json` cobre esse cenario.

## 2.1 Google Login

O erro do Google `no registered origin` / `401: invalid_client` acontece quando o dominio atual da PWA nao esta autorizado no OAuth Client ID.

No Google Cloud Console:

1. Va em APIs & Services > Credentials.
2. Abra o OAuth 2.0 Client ID usado em `VITE_GOOGLE_CLIENT_ID`.
3. Confirme que o tipo do client e `Web application`.
4. Em `Authorized JavaScript origins`, adicione exatamente as origens usadas pela PWA:

```txt
http://localhost:5173
https://SEU-PROJETO.vercel.app
https://SEU-DOMINIO-PRODUCAO.com
```

Regras importantes:

- Use apenas origem: protocolo + dominio + porta, sem path e sem barra final.
- `https://app.exemplo.com` e `https://www.app.exemplo.com` sao origens diferentes.
- Preview URLs da Vercel mudam; para login Google, teste no dominio fixo de producao ou adicione manualmente a preview URL atual.
- `VITE_GOOGLE_CLIENT_ID` na Vercel e `GOOGLE_CLIENT_ID` no Render devem ser o mesmo Client ID Web.
- Depois de alterar o Client ID ou as envs, faca redeploy na Vercel e no Render.

## 3. Render

Use o Blueprint `render.yaml` ou crie um Web Service manualmente.

Com Blueprint:

1. No Render, escolha Blueprint.
2. Selecione o repositorio GitHub.
3. O Render detecta `render.yaml`.
4. Preencha as variaveis marcadas como `sync: false`.

Variaveis obrigatorias no Render:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:SENHA@aws-0-REGIAO.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:SENHA@db.PROJECT_REF.supabase.co:5432/postgres"
GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET=""
FRONTEND_URL="https://SEU-PROJETO.vercel.app"
WEB_ORIGIN="https://SEU-PROJETO.vercel.app"
CORS_ORIGINS="https://SEU-PROJETO.vercel.app,https://SEU-DOMINIO-PRODUCAO.com,https://www.SEU-DOMINIO-PRODUCAO.com"
API_PUBLIC_URL="https://SEU-SERVICO-RENDER.onrender.com"
MERCADO_PAGO_ACCESS_TOKEN="seu-token-mercado-pago"
MERCADO_PAGO_WEBHOOK_SECRET=""
```

No Supabase, use a URL de pooler/transacao em `DATABASE_URL` e a URL direta em `DIRECT_URL`.
O usuario do pooler precisa estar no formato `postgres.PROJECT_REF`; se usar apenas `postgres`
contra o host `*.pooler.supabase.com`, o Render pode cair com erro como
`tenant/user postgres.PROJECT_REF not found`.

Para dominio proprio, configure a API com as duas origens quando usar raiz e `www`, por exemplo:

```env
FRONTEND_URL="https://gondly.com.br"
WEB_ORIGIN="https://www.gondly.com.br"
CORS_ORIGINS="https://gondly.com.br,https://www.gondly.com.br,https://gondly-web.vercel.app"
```

O Blueprint tambem define:

```txt
buildCommand     = npm ci --include=dev && npm run prisma:generate && npm run build:api
preDeployCommand = npm run prisma:deploy
startCommand     = npm run start:api
```

O backend usa `PORT` quando existir, como exigido pelo Render.

Se criar o Web Service manualmente, prefira deixar `Root Directory` vazio para o Render executar pela raiz do monorepo:

```txt
Root Directory = vazio
Build Command  = npm ci --include=dev && npm run prisma:generate && npm run build:api
Start Command  = npm run start:api
```

Se voce ja configurou `Root Directory` como `apps/api`, use comandos locais do pacote da API:

```txt
Root Directory = apps/api
Build Command  = npm install --include=dev && npm run prisma:generate && npm run build
Start Command  = npm run start
```

## 4. Mercado Pago

Configure o webhook no Mercado Pago apontando para:

```txt
https://SEU-SERVICO-RENDER.onrender.com/billing/webhook/mercado-pago
```

O checkout e criado no backend em:

```txt
POST /billing/remove-ads/checkout
```

O entitlement `no_ads` so e liberado depois que o webhook consulta o pagamento na API do Mercado Pago.

## 4.1 Lembretes de finalizar compra (Web Push) na VPS

O app avisa os participantes 1h e 2h depois do último item colocado no carrinho, se a compra continuar aberta.
A própria API verifica as compras a cada 5 minutos; como ela roda continuamente na VPS, não é preciso agendador externo.
Entre 23h e 7h (horário de Brasília) nada é enviado, e compras abertas há mais de 12h não geram lembrete.

1. Gere as chaves VAPID uma única vez, fora do repositório (não commitar):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. No arquivo de ambiente da API na VPS (o mesmo que contém `DATABASE_URL`), acrescente:

   ```dotenv
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:contato@gondly.app
   ```

   Sem as chaves o push fica desligado e o app mantém só o lembrete dentro do app. Não troque as chaves depois:
   isso invalida as inscrições dos aparelhos.
   Opcional: `CRON_SECRET` habilita `POST /push/reminders/run` (header `x-cron-secret`) para disparar a verificação manualmente.

3. Esta entrega tem migrations novas (`purchase_item_claims` e `push_reminders`). Aplique `prisma migrate deploy`
   com o novo código antes de subir a API, como no fluxo atual de deploy da VPS.

No iPhone, notificações push só funcionam com o app instalado na tela de início (iOS 16.4+).

## 5. Ordem Recomendada

1. Subir o repositorio no GitHub.
2. Criar o serviço da API no Render.
3. Criar o projeto da PWA no Vercel com `VITE_API_URL` apontando para o Render.
4. Atualizar `FRONTEND_URL` e `WEB_ORIGIN` no Render com a URL final da Vercel.
5. Atualizar `API_PUBLIC_URL` no Render com a URL final da API.
6. Configurar webhook no Mercado Pago.
7. Fazer um login real e testar `/app/billing`.
