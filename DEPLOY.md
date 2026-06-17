# Deploy Gondly

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
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres"
GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET=""
FRONTEND_URL="https://SEU-PROJETO.vercel.app"
WEB_ORIGIN="https://SEU-PROJETO.vercel.app"
API_PUBLIC_URL="https://SEU-SERVICO-RENDER.onrender.com"
MERCADO_PAGO_ACCESS_TOKEN="seu-token-mercado-pago"
MERCADO_PAGO_WEBHOOK_SECRET=""
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

## 5. Ordem Recomendada

1. Subir o repositorio no GitHub.
2. Criar o serviço da API no Render.
3. Criar o projeto da PWA no Vercel com `VITE_API_URL` apontando para o Render.
4. Atualizar `FRONTEND_URL` e `WEB_ORIGIN` no Render com a URL final da Vercel.
5. Atualizar `API_PUBLIC_URL` no Render com a URL final da API.
6. Configurar webhook no Mercado Pago.
7. Fazer um login real e testar `/app/billing`.
