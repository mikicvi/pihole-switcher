[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mikicvi_pihole-switcher&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mikicvi_pihole-switcher) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=mikicvi_pihole-switcher&metric=coverage)](https://sonarcloud.io/summary/new_code?id=mikicvi_pihole-switcher) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=mikicvi_pihole-switcher&metric=bugs)](https://sonarcloud.io/summary/new_code?id=mikicvi_pihole-switcher) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=mikicvi_pihole-switcher&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=mikicvi_pihole-switcher)

# Pihole switcher

This project was built to serve as frontend for local Pihole instance.

It's goal was to simplify interaction with pihole, and enable user to switch off/on pihole ad blocking service on the network for "X" amount of time, and display top ads and top requests.

Primary design of the app was mobile oriented, but it looks pretty decent on desktop too.

## Features

-   Enable or disable ad blocking service
-   Display current status of the service
-   Easy access to pihole control dashboard
-   Interactive Pie chart displaying top ads or top queries
-   Light/Dark mode
-   Add whitelist, blacklist domains

## Setting up

The app is a single SvelteKit (Node) service: it serves the UI **and** proxies
the Pi-hole FTL API. The API password lives only in the server process — it is
never shipped to the browser.

-   To build a docker image execute from root of project:

`npm install && npm run build`

`docker build -t pihole-switcher-prod .`

On linux, image can be exported like:

`docker save pihole-switcher-prod:latest | gzip > pihole-switcher-prod.tar.gz`

```
docker run -d -p 3016:3000 \
  -e PIHOLE_API_PASSWORD=<pihole api password> \
  -e PIHOLE_PROXY_TARGET=172.17.0.1 \
  -e PUBLIC_PIHOLE_ADMIN=http://192.168.1.12:1010/admin/login \
  pihole-switcher-prod:latest
```

The browser calls same-origin `/api/*` routes; the server forwards them to FTL
with its own session (this also sidesteps the FTL CORS bug on list endpoints,
pi-hole/FTL issue #2261).

-   `PIHOLE_API_PASSWORD` (required): the **plain** FTL API password. FTL v6
    only accepts the plain password at `/api/auth` — not the hashed form.
-   `PIHOLE_PROXY_TARGET`: the address of the Pi-hole **as seen from the
    container** (e.g. `172.17.0.1` for a Pi-hole on the Docker host, a LAN IP,
    or a Docker service name if both run in the same compose network).
-   `PIHOLE_FTL_PORT` (default `1010`): FTL API port.
-   `PUBLIC_PIHOLE_ADMIN` (optional): the URL the "open admin" link in the
    header points to.

---

If you prefer docker compose instead (see `docker-compose.yml`):

```docker compose
services:
  pihole-switcher:
    image: mikicv/pihole-switcher:latest
    ports:
      - "3016:3000"
    environment:
      - PIHOLE_API_PASSWORD=<pihole api password>
      - PIHOLE_PROXY_TARGET=<pihole address as seen from the container, e.g. 172.17.0.1>
      - PIHOLE_FTL_PORT=1010
      - PUBLIC_PIHOLE_ADMIN=<optional pi-hole admin URL, e.g. http://192.168.1.12:1010/admin/login>
```

**_Make sure you replace pihole password and your pihole base URL with your actual Pihole password and ensure that the pihole-switcher-prod:latest image is available on your system._**

# High level overview

This app interacts with pihole HTTP API

-   View API endpoints at pihole API documentation: e.g http://192.168.1.1:8080/api/docs

## Development:

-   Requires Node 22+ and a reachable Pi-hole instance (bare-metal or docker).
-   `npm install`
-   `npm run dev` — Vite dev server with SSR on port 5173. Set the same env
    vars (e.g. in `.env.local`):

    ```
    PIHOLE_API_PASSWORD=<plain FTL API password>
    PIHOLE_PROXY_TARGET=192.168.1.12
    PIHOLE_FTL_PORT=1010
    PUBLIC_PIHOLE_ADMIN=http://192.168.1.12:1010/admin/login
    ```

-   `npm test` — Vitest (unit tests against a real mock FTL HTTP server,
    route handler tests, component tests with Testing Library).
-   `npm run check` — svelte-check (strict TS).

# Preview

<img width="543" alt="switcher-preview-1" src="https://github.com/mikicvi/pihole-switcher/assets/88291034/92129741-993b-45a3-a902-614ddfbc9414">
<img width="543" alt="switcher-preview-2" src="https://github.com/mikicvi/pihole-switcher/assets/88291034/bf67b1b4-b7e7-480c-be2f-3ff7cabed6ef">

## Notice:

-   This is a work in progress. Any suggestions are more than welcome, as well as feature suggestions and PR's.
-   This project is built on TypeScript/NodeJS/SvelteKit, so any contributions should be within this stack.

---

Contact: <mika5566@gmail.com>
