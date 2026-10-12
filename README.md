# Amplify Hope API

Node.js/Express backend for the Amplify Hope donation platform. Handles Stripe checkout, billing portal, magic-link authentication, and Stripe webhook processing.

## Getting Started

```bash
nvm install        # installs Node 24 from .nvmrc
yarn               # install dependencies
cp .env.example .env  # fill in values from a teammate
```

### Running locally

```bash
docker compose up -d   # starts local Postgres on port 5432
yarn start:dev         # ts-node-dev with hot reload
```

The API listens on port **3002**.

## Testing

```bash
yarn test:unit     # runs all *.unit.ts files with Mocha
yarn typecheck     # tsc --noEmit
yarn lint          # ESLint
```

## Deployment

Deployed via GitLab CI (`.gitlab-ci.yml`). Pipelines are triggered on pushes to `main`.

| Stage | Trigger | What it does |
|-------|---------|-------------|
| test | auto | unit tests + Snyk scan |
| build | auto (main only) | builds Docker image, pushes to Docker Hub |
| deploy:staging | auto (main only) | SSH to stage EC2, pulls image, restarts container |
| deploy:production | manual | SSH to prod EC2, pulls image, restarts container |

Containers run with `--restart unless-stopped` so they survive EC2 reboots.

After each deploy, `docker image prune -af` runs to prevent disk accumulation.

## Infrastructure

| Resource | Details |
|----------|---------|
| Compute | Single EC2 instance per environment (prod + stage), Docker container |
| Database | AWS RDS PostgreSQL — shared instance, separate DB per environment |
| Reverse proxy | nginx on the EC2 host, SSL via certbot/Let's Encrypt |
| Docker images | Docker Hub — `agiannellah/ah-api` |

## Endpoints

| Environment | URL |
|-------------|-----|
| Local | http://localhost:3002 |
| Staging | https://api-stage.amplifyhope.cc |
| Production | https://api.amplifyhope.cc |

### Routes

- `GET /health` — DB connectivity check (returns 503 if DB unreachable)
- `GET /products/:type` — Stripe products (one-time or recurring)
- `POST /checkout` — Create Stripe checkout session
- `GET /checkout-sessions/:id` — Fetch session status
- `POST /create-portal-session` — Stripe billing portal
- `POST /stripe-webhooks` — Stripe event handler
- `POST /login` — Send magic link via Resend
- `GET /verify` — Verify magic link JWT, redirect to billing portal

## Stripe API Versions

A Stripe API version is used in two independent places:

- **API calls (this app → Stripe).** The app never sets `apiVersion`, so the `stripe` SDK sends the version it was released with on every request (`stripe@23.0.0` → `2026-09-30.endive`). Upgrading the SDK upgrades the version for all API calls. The account's default API version is not used by this app.
- **Webhook events (Stripe → this app).** Each webhook endpoint renders event payloads with the API version it was created with. This is fixed at creation and is independent of the SDK, so moving it means creating a new endpoint.

When upgrading, review the [Stripe changelog](https://docs.stripe.com/changelog) for breaking changes in the resources used here (Checkout Sessions, Prices, Products, Customers, Billing Portal, Invoices) and test in Stripe test mode before production.

### Migrating webhook endpoints to a new API version

The handler (`src/controllers/webhooks/stripe-webhooks.ts`) supports running the old and new endpoints side by side. The new endpoint is identified by a `?version=` query param on its URL and verified with its own signing secret.

| Env var | Purpose |
|---------|---------|
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the original endpoint (no `?version=`) |
| `STRIPE_WEBHOOK_SECRET_NEXT` | Signing secret of the new endpoint (URL has `?version=`) |
| `STRIPE_WEBHOOK_ACTIVE_VERSION` | Which endpoint is processed. Empty = original. Set to the `?version=` value = new |

Steps (do staging with the test key first, then production):

1. **Create the new endpoint** in Stripe (Dashboard or API) with the same URL plus `?version=<api version>` (for example `https://api-stage.amplifyhope.cc/stripe-webhooks?version=2026-09-30`), the same enabled events, and `api_version` set to the target version. Keep it disabled.
2. **Deploy with `STRIPE_WEBHOOK_SECRET_NEXT`** set to the new endpoint's signing secret and `STRIPE_WEBHOOK_ACTIVE_VERSION` empty.
3. **Enable the new endpoint.** Every event is now delivered twice. The original endpoint is processed as before. The new one is acknowledged with `200 {"ignored": true}` and not processed, so Stripe won't retry it.
4. **Switch processing:** set `STRIPE_WEBHOOK_ACTIVE_VERSION` to the `?version=` value and restart. The new endpoint is processed, and the original endpoint returns `400`, so Stripe keeps retrying those events.
5. **Monitor** the new endpoint (Stripe Dashboard delivery logs and the app logs). To roll back, clear `STRIPE_WEBHOOK_ACTIVE_VERSION` and restart. Events the original endpoint rejected with `400` are re-sent while Stripe is still retrying them.
6. **Disable the original endpoint** once you're confident. Stripe won't re-deliver events it returned `400` for after that. Keep both env vars set, because the new endpoint's URL still carries `?version=`.

This supports one migration at a time. `STRIPE_WEBHOOK_SECRET_NEXT` is a single secret used for any URL with a `?version=` param.

## Local Database

Runs as a Docker container (see `docker-compose.yml`). Schema lives at `src/init-db/00_SCHEMA.sql`. To reset:

```bash
yarn rebuild-db
```

## Useful Scripts

```bash
yarn format      # Prettier
yarn typecheck   # TypeScript check without emit
yarn build       # compile to build/src/ (used in Docker)
```

## Links

- [Frontend repo](https://gitlab.com/amplifyhope/ah-website-ui)
- [Docker Hub](https://hub.docker.com/r/agiannellah/ah-api)
- [Amplify Hope](https://amplifyhope.cc)
