# PLAN: Rewrite pihole-switcher on SvelteKit (server-side API proxy + modern UI)

Branch: `rewrite/sveltekit` from `master` (do NOT touch PR #100 or `fix/workflow-merge-race`).
**Do not push to the remote.** Commit locally on the branch; the parent will review, push, and open the PR.

## 1. Goal

Replace the CRA + nginx + env.sh stack with a single SvelteKit (framework mode) Node
service that:

1. **Holds the Pi-hole API password server-side** and proxies the FTL API for the
   browser (the security fix, "Option B"). `env-config.js`-style secrets in served
   JS are eliminated entirely.
2. **Keeps 100% of current behavior** (blocking toggle w/ timed disable, resume,
   top ads/queries, whitelist/blacklist management).
3. **Modernizes the UI** (see §5) while staying dependency-light: no chart lib,
   no component framework, no icon/font CDNs.

## 2. Stack

- Svelte 5 + SvelteKit 2, TypeScript (strict), Vite, `@sveltejs/adapter-node`
- Styling: Tailwind CSS 4 via `@tailwindcss/vite` + `@tailwindcss/svelte` (no UI kit)
- Tests: Vitest (+ `jsdom` for components, `node` env for server code),
  `@testing-library/svelte`, `vitest-coverage-v8`
- Node 22 runtime. No nginx, no entrypoint scripts, no sed.
- Remove all React/CRA artifacts: `react-scripts`, `@fluentui/react`,
  `react-router-dom`, `axios`, `package-lock`/`yarn` duplication — clean
  `package.json` from scratch (npm).

## 3. Architecture

Single process. SvelteKit serves the SPA + server routes on one port (`PORT`,
default 3000).

```
src/lib/config.ts        server-side env (see §7). Client-visible config (admin URL)
                         exposed via +layout.server.ts or /config server route.
src/lib/piholeClient.ts  THE core. Server-only FTL client (plain fetch, no deps).
src/routes/api/[...path]/+server.ts
                         Catch-all proxy: forwards method+path+query+body to
                         piholeClient. Secrets never reach the browser.
src/routes/+layout.svelte, /+page.svelte (home), /filterlist/+page.svelte
```

### 3.1 piholeClient (server-only, the important part)

FTL v6 REST API (verified live against 192.168.1.12:1010):

- `POST {base}/auth` body `{"password":"<plain>"}` →
  `{session:{valid, sid, csrf, validity}}` (validity ~1800s). **Only the plain
  API password is accepted — never a hash.**
- Subsequent requests: headers `X-FTL-SID: <sid>` and `X-FTL-CSRF: <csrf>`.
- 401 ⇒ session dead ⇒ re-login and retry once.

Endpoints to support (port of current `src/services/piholeApi.ts`):

| Method | FTL path                                         | Used for                                                 |
| ------ | ------------------------------------------------ | -------------------------------------------------------- |
| POST   | `/auth`                                          | login                                                    |
| GET    | `/dns/blocking/status`                           | status (`blocking` bool + `timer`)                       |
| POST   | `/dns/blocking`                                  | `{blocking, timer}` enable / timed disable               |
| GET    | `/stats/top_domains?blocked=true\|false&count=N` | top ads / queries                                        |
| GET    | `/domains/{allow\|deny}/exact`                   | whitelist/blacklist                                      |
| POST   | `/domains/{allow\|deny}/exact`                   | add domain `{domain, comment, groups:[0], enabled:true}` |

Behavior requirements:

- Lazy auth (login on first request), cached session, **single-flight login**
  (concurrent requests share one in-flight login promise).
- On 401 from FTL: re-login once, retry the request. **Cooldown** after a
  failed login (wrong password) — ~10s — so a bad password doesn't hammer FTL;
  surface the failure as HTTP 503 JSON `{error: "auth_failed"}` to the client.
- Preserve method, query string, JSON body, and `content-type` on the way to FTL.
- Stricter-than-needed timeouts on FTL calls (e.g. 5s) so a dead FTL yields a
  quick 502, not a hung browser request.
- All public methods typed; return shapes matching what the UI needs.

### 3.2 `/api/[...path]` server route

- `GET/POST/DELETE/PUT /api/<anything>` → piholeClient → FTL `/api/<anything>`.
- 404 for FTL `not_found`; 502 for connection failure; 503 for auth failure.
- The browser calls exactly the paths the old frontend did (baseURL was `/api`):
  `/api/dns/blocking/status`, `/api/dns/blocking`,
  `/api/stats/top_domains?...`, `/api/domains/allow/exact`, `/api/domains/deny/exact`.
- No client ever sends a password. (If you want belt-and-braces, restrict the
  route to these known paths — a small allowlist — rather than blind forwarding.)

## 4. Data / state

- Home: poll blocking status every 10s while disabled (countdown driven by
  `timer` from FTL — prefer server `timer`/server-time over a client countdown
  when available; client interval as display clock), 60s while enabled.
  Poll top domains every 60s.
- Filterlist: fetch full exact list on mount + on whitelist/blacklist switch;
  client-side filter input + pagination (10/page); re-fetch after add.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`/`$derived` stores) — if
  runes prove troublesome, classic syntax is acceptable; correctness first.

## 5. UI/UX spec (the modernization)

Design language: **mobile-first dark dashboard** (this app lives on a phone in
bed), Pi-hole branding (reuse `public/` logo assets), CSS-variable theme with
`light`/`dark` (dark default, `prefers-color-scheme` fallback, toggle persisted
to `localStorage`). Green = blocking active, red = paused. System font stack,
inline SVG icons, no webfonts, no icon libs. Respect `prefers-reduced-motion`.

**Layout** (`+layout.svelte`): top bar with logo + app name, nav (Dashboard /
Filter list) as tabs, right side: status pill (● Active / ⏸ Paused) + theme
toggle. Sticky, blurred backdrop. Content max-width ~720px centered.

**Home** (`/`):

1. **Hero card**: big animated switch (custom Svelte switch, role="switch")
   controlling blocking. Below: "Pause blocking for" segmented control
   (5m / 15m / 1h / 24h) — replaces the old dropdown.
2. When paused: prominent **countdown** (mm:ss / h m) with a thin progress bar
   draining over the pause duration, and a **Resume now** button.
   (The old "hover logo to resume" easter egg is gone — explicit button instead.)
3. **Top lists**: "Top Ads" / "Top Queries" segmented tabs (replaces old tab
   header). Pure-CSS bar list: domain (truncated, full name in `title`), count,
   animated bar width (CSS transition on width), top item highlighted. Skeleton
   shimmer while loading; "updated Xs ago" microcopy. Blocked-query % badge
   (from `total_queries`/`blocked_queries` if FTL provides it in the stats call
   you choose — check `/stats/summary` or use the existing top_domains payload;
   if not easily available, skip the badge rather than adding a call).
4. Status pill in the header reflects state live; clicking it opens the Pi-hole
   admin URL (`PUBLIC_PIHOLE_ADMIN`) in a new tab.

**Filter list** (`/filterlist`):

1. Segmented pill: Whitelist / Blacklist (replaces react-select).
2. Add-domain row: input + Add button. Inline validation (basic domain/regex
   shape), busy state on submit, toast: green success ("Added example.com"),
   amber for "already on list" (FTL `UNIQUE constraint failed`), red error
   otherwise. Toasts auto-dismiss 3s, `aria-live="polite"`.
3. Table: sticky header, columns Domain / Modified / Enabled (port current
   data: domain, date_modified, enabled). Row hover, zebra optional.
   Client-side search box filtering the loaded list (substrings, case-insens.)
   with result count. Pagination 10/page with prev/next. Empty state ("No
   domains yet — add one above").
4. Loading: skeleton rows; error: banner with Retry.

**A11y**: focus-visible rings everywhere, `role="switch"`/`role="tablist"`
properly, keyboard-operable tabs and pagination, labels on all inputs.

## 6. Tests (thorough — this is a hard requirement)

`npm test` = `vitest run --coverage` and MUST pass. Structure:

`tests/unit/piholeClient.test.ts` (node env) — spin up a **real mock FTL server**
(node:http, ephemeral port) that records requests:

- logs in lazily on first call; sid+csrf headers present on all subsequent
  requests (mock asserts header values)
- method/path/query/body passthrough for every endpoint in §3.1 (incl. POST
  /dns/blocking with timer, POST /domains/deny/exact with body,
  GET /stats/top_domains?blocked=true&count=10)
- 401 → re-login exactly once → original request retried → success
- failed login (401 from /auth) → 503-equivalent error thrown to caller;
  cooldown: a second attempt within cooldown does NOT hit /auth again
- single-flight: 5 concurrent first requests → exactly 1 /auth call
- FTL connection refused → mapped to a connection error (→502 at route level)
- response bodies/paths: mock returns known JSON; client returns typed shapes

`tests/routes/api-proxy.test.ts` (node env) — call the `+server.ts` handlers
directly with `Request` objects (vi.mock piholeClient):

- forwarding (each verb), path/query/body preservation
- error mapping: auth_failed→503, connection→502, FTL not_found→404,
  FTL 500→500
- allowlist: unknown path (if you implement one) → 404

Component tests (`tests/components/*.test.ts`, jsdom + @testing-library/svelte,
vi.mock the API layer or use a local fetch mock):

- Home: status pill active/paused states; switch off → POST
  /dns/blocking with selected duration; countdown renders and decrements
  (fake timers); Resume → POST blocking:true, timer:null; segmented control
  changes duration; top-lists render bars+counts, tab switch flips
  `blocked` param; loading skeletons.
- Filterlist: renders paginated rows; search filters; add success/exists/error
  toast paths; list-type switch re-fetches `allow` vs `deny`; pagination nav;
  empty state.
- Layout: nav tabs switch routes; theme toggle flips class + persists to
  localStorage.

Plus: `npm run build` (vite build) must pass clean under TS strict.

## 7. Env vars (server process)

| Var                   | Default       | Meaning                                                                    |
| --------------------- | ------------- | -------------------------------------------------------------------------- |
| `PORT`                | `3000`        | bind port                                                                  |
| `PIHOLE_PROXY_TARGET` | `192.168.1.1` | FTL host (LAN IP or 172.17.0.1 in docker)                                  |
| `PIHOLE_FTL_PORT`     | `1010`        | FTL API port                                                               |
| `PIHOLE_API_PASSWORD` | — (required)  | **plain** FTL API password                                                 |
| `PUBLIC_PIHOLE_ADMIN` | —             | admin URL shown/linked in UI (e.g. <http://192.168.1.12:1010/admin/login>) |

No `REACT_APP_*` anything. `src/lib/config.ts` validates `PIHOLE_API_PASSWORD`
presence at boot (fail fast with a clear message).

## 8. Docker + deploy

- Multi-stage `node:22-alpine`: build (npm ci, `vite build` with SvelteKit) →
  runtime (copy `build/` + `package.json` + prod deps or use
  `npm ci --omit=dev`, `CMD ["node","build"]`, `EXPOSE 3000`, non-root user).
- Keep image name `mikicv/pihole-switcher`. Portainer template maps `3016:3000`.
- Update `docker-compose.yml` + `env.sh` removal in the repo, README deploy
  section (new env vars, Portainer snippet), `.env.example`.
- Delete: `nginx.conf`, `env.sh`, `Dockerfile-dev`, `public/env-config.js`,
  all React/CRA files, `sonar-project.properties` can stay.

## 9. E2E verification (do this last, on this machine)

The repo `.env` contains a working plain FTL API password and
`192.168.1.12:1010` is reachable from this machine:

1. `docker build -t psw-svelte-test .`
2. `docker run -d -p 3999:3000 -e PIHOLE_API_PASSWORD=<from .env> \
-e PIHOLE_PROXY_TARGET=192.168.1.12 -e PIHOLE_FTL_PORT=1010 \
-e PUBLIC_PIHOLE_ADMIN=http://192.168.1.12:1010/admin/login psw-svelte-test`
3. `curl localhost:3999/` → HTML 200; `curl localhost:3999/api/dns/blocking/status`
   → FTL JSON (proxied, no client password involved).
4. **Security gate**: `grep -r "<password>" build/ docker image contents` —
   the password value must NOT appear in any served asset (it exists only in
   the server process env). Verify served HTML/JS contain no `PIHOLE_API_PASSWORD`
   value; `PUBLIC_PIHOLE_ADMIN` in client bundle is acceptable.
5. Do NOT toggle blocking or mutate domains against the real Pi-hole — GET
   endpoints only. Leave the test container running and report its name/port.

## 10. Definition of done

- [ ] Branch `rewrite/sveltekit` with clean logical commits; no remote push
- [ ] `npm test` green (unit + component, coverage reported), `npm run build` green
- [ ] No `REACT_APP_*`, no axios, no fluentui, no nginx in the new tree
- [ ] E2E §9 done; security gate (password absent from served assets) verified
- [ ] README updated; final commit message summarizes stack + security model
- [ ] Report: what you built, test counts, E2E evidence, anything you skipped
      and why (skips must be justified, not silent)
