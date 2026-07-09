# Self-host Aegis

This recipe boots a private Aegis vault on any machine that can run
Docker Compose — a home server, a $5 VPS, or a laptop for local
development. The stack has three moving parts:

- **Postgres 16** — stores every table under `public` + the `auth`
  schema used by GoTrue.
- **PostgREST** — exposes the `public` schema over HTTP with the same
  wire protocol as Supabase's Data API, so `@supabase/supabase-js`
  works unchanged.
- **GoTrue** — email/password auth, JWTs signed with the same secret
  PostgREST validates.

Everything ships as SQL migrations under `supabase/migrations/`, so a
self-hosted Aegis is bit-for-bit the schema the hosted product runs.

---

## 1. Prerequisites

- Docker 24+ with the Compose plugin (`docker compose version`).
- `openssl` and Node.js 20+ on the host (only to mint keys once).
- ~500 MB free disk for the Postgres volume.

## 2. Four env vars

Everything is driven by four values. Copy the template:

```bash
cd self-host
cp .env.example .env
```

Fill in `.env`:

1. **`POSTGRES_PASSWORD`** — the DB superuser password.
   ```bash
   openssl rand -base64 32
   ```
2. **`JWT_SECRET`** — HS256 secret shared by PostgREST and GoTrue.
   ```bash
   openssl rand -base64 48
   ```
3. **`ANON_KEY`** and **`SERVICE_ROLE_KEY`** — JWTs signed with the
   secret above.
   ```bash
   JWT_SECRET="$(grep ^JWT_SECRET .env | cut -d= -f2-)" \
     node scripts/mint-keys.mjs >> .env
   ```

That's it — no other configuration is required for a working single-node
install.

## 3. Boot the stack

```bash
docker compose up -d
docker compose logs -f migrate   # watch migrations apply
```

Wait until the `migrate` container exits `0`. The stack now serves:

- **Data API** — `http://localhost:3000`
- **Auth API** — `http://localhost:9999`
- **Postgres** — internal only (add a `ports:` entry in
  `docker-compose.yml` if you want direct access).

## 4. Create the first admin user

GoTrue has no built-in admin UI. Create the first user via its REST
API, then promote them:

```bash
# 4a. Sign up (auto-confirmed because GOTRUE_MAILER_AUTOCONFIRM=true).
curl -sS -X POST http://localhost:9999/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-passphrase"}'

# 4b. Grab the user id.
USER_ID=$(docker compose exec -T db psql -U postgres -d aegis -tAc \
  "select id from auth.users where email='you@example.com'")

# 4c. Grant the admin role (schema comes from the shipped migrations).
docker compose exec -T db psql -U postgres -d aegis -c \
  "insert into public.user_roles (user_id, role) values ('$USER_ID', 'admin');"
```

## 5. Point the web client at your instance

Build the client with your instance's URLs:

```bash
VITE_SUPABASE_URL=http://localhost:3000 \
VITE_SUPABASE_PUBLISHABLE_KEY="$(grep ^ANON_KEY self-host/.env | cut -d= -f2-)" \
  bun run build
```

For a real deployment, terminate TLS in front of PostgREST and GoTrue
(Caddy, nginx, or Cloudflare Tunnel all work) and set `SITE_URL` in
`.env` to the public URL of the client.

## 6. Verify RLS with the same test we ship

The hosted product blocks `anon` from reading vault rows. Prove your
self-hosted install does too — the exact test that runs in Aegis CI:

```bash
SUPABASE_URL=http://localhost:3000 \
SUPABASE_ANON_KEY="$(grep ^ANON_KEY self-host/.env | cut -d= -f2-)" \
  node --test tests/rls/anonymous-cannot-read.spec.mjs
```

A green run means Row-Level Security is on for every user-facing table
and unauthenticated callers cannot read vault data.

---

## Backups

The Postgres data lives in the named volume `aegis_aegis-db-data`.
Take a nightly dump:

```bash
docker compose exec -T db pg_dump -U postgres -Fc aegis > aegis-$(date +%F).dump
```

Restore with `pg_restore -d aegis -c` after `docker compose up -d db`.

## Upgrading

```bash
git pull
docker compose pull
docker compose up -d
docker compose logs -f migrate
```

Migrations are additive and idempotent — the runner applies only files
newer than the last successful run recorded in Postgres.

## Expose the stack over HTTPS with Cloudflare Tunnel

`docker compose up -d` binds PostgREST and GoTrue to `localhost` only. To
reach them from a browser on the public internet — without opening a
port, renting a static IP, or issuing certificates yourself — put a
Cloudflare Tunnel in front. Traffic terminates TLS at Cloudflare's edge
and rides an outbound-only tunnel back to your box.

This flow works on any host that can run Docker: a home server behind
NAT, a Raspberry Pi, a laptop, or a $4 VPS.

### 1. Prerequisites

- A domain on a Cloudflare account (free plan is fine).
- The self-host stack already running (`docker compose ps` shows
  `db`, `rest`, `auth` as healthy).
- Two subdomains you want to use, e.g.:
  - `api.vault.example.com` → PostgREST (port 3000)
  - `auth.vault.example.com` → GoTrue (port 9999)

### 2. Create the tunnel in the Cloudflare dashboard

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels**.
2. **Create a tunnel** → connector **Cloudflared** → name it `aegis`.
3. Copy the install command for **Docker**. It looks like:
   ```
   docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoi...
   ```
   Copy only the token (the `eyJ...` part) — you will paste it into `.env`.

### 3. Add cloudflared to the compose stack

Append this service to `self-host/docker-compose.yml` (same `networks:
[aegis]` block as the other services):

```yaml
  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on: [rest, auth]
    networks: [aegis]
```

Add the token to `self-host/.env`:

```
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...paste-from-dashboard...
```

Bring the tunnel up:

```bash
docker compose up -d tunnel
docker compose logs -f tunnel   # wait for "Registered tunnel connection"
```

### 4. Map hostnames to services

Back in the tunnel's dashboard page → **Public Hostnames** → **Add a
public hostname**. Do this twice:

| Subdomain | Domain | Type | URL |
| --- | --- | --- | --- |
| `api`  | `vault.example.com` | HTTP | `rest:3000` |
| `auth` | `vault.example.com` | HTTP | `auth:9999` |

The URL uses the compose service name (`rest`, `auth`) because
cloudflared is on the same `aegis` docker network. Cloudflare provisions
DNS and SSL for both hostnames within a minute.

Verify:

```bash
curl https://api.vault.example.com/    # PostgREST OpenAPI root
curl https://auth.vault.example.com/health
```

### 5. Point the web client at the tunnel

Rebuild with the public URLs:

```bash
VITE_SUPABASE_URL=https://api.vault.example.com \
VITE_SUPABASE_PUBLISHABLE_KEY="$(grep ^ANON_KEY self-host/.env | cut -d= -f2-)" \
  bun run build
```

Update `SITE_URL` in `self-host/.env` to the public URL of the client
(e.g. `https://vault.example.com`) so GoTrue's email links point at the
right place, then `docker compose up -d auth` to reload it.

### 6. Lock it down (recommended)

- **Zero Trust → Access → Applications**: put an Access policy in front
  of the `auth` hostname if you don't want the internet hitting the
  signup endpoint. Combine with `GOTRUE_DISABLE_SIGNUP=true` after
  creating your admin user.
- **WAF → Rate limiting**: cap `/token` and `/signup` on the auth
  hostname to blunt credential stuffing.
- **Origin does not need port 443 open.** If you accidentally opened it
  earlier, close it — the tunnel is the only ingress path.

### Tunnel troubleshooting

| Symptom | Fix |
| --- | --- |
| `tunnel` logs `Unauthorized: Failed to get tunnel` | Token is wrong or the tunnel was deleted in the dashboard. Re-copy the token, update `.env`, `docker compose up -d tunnel`. |
| `curl` returns Cloudflare error 1033 | No public hostname is mapped yet, or DNS hasn't propagated. Wait 60s, then recheck the **Public Hostnames** table. |
| Client gets CORS errors from `api.vault.example.com` | PostgREST allows all origins by default. If you added a stricter CORS setup, whitelist the client's public URL. |
| Auth emails link to `http://localhost:5173` | `SITE_URL` still points at localhost. Update `.env` and restart `auth`. |


## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `rest` logs `JWSError JWSInvalidSignature` | `JWT_SECRET` differs between what signed `ANON_KEY` and what PostgREST loaded. Re-mint keys with the current secret. |
| `auth` logs `pq: role "supabase_auth_admin" does not exist` | The db volume was created before `init/00-roles.sql` ran. Wipe the volume: `docker compose down -v && docker compose up -d`. |
| Client gets `401` on every read | Missing `GRANT` on the table. Every new `public` table needs `GRANT` statements in the same migration (see `AGENTS.md`). |
| `migrate` container loops | Look at the last `->` line in its logs; a migration failed. Fix the SQL, then `docker compose up -d migrate` to re-run. |

Security reports: `security@aegis.example` (see `SECURITY.md`).
