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

This project was built to be served from docker.

-   To build a docker image execute from root of project:

`yarn install && yarn build`

`docker build -t pihole-switcher-prod .`

On linux, image can be exported like:

`docker save pihole-switcher-prod:latest | gzip > pihole-switcher-prod.tar.gz`

```
docker run -d -p 3016:80 \
  -e REACT_APP_PIHOLE_PASSWORD=<pihole password> \
  -e REACT_APP_PIHOLE_BASE=/api \
  -e PIHOLE_PROXY_TARGET=172.17.0.1 \
  -e REACT_APP_PIHOLE_ADMIN=http://192.168.1.12:1010/admin \
  pihole-switcher-prod:latest
```

The recommended setup is to proxy the Pi-hole API through the app's own origin (the `REACT_APP_PIHOLE_BASE=/api` + `PIHOLE_PROXY_TARGET` combination above). The container's nginx then serves `/api/*` from your Pi-hole, so the browser never makes a cross-origin request.

Why: Pi-hole/FTL has a bug where responses for the list endpoints (`/api/domains/*`, `/api/clients`, `/api/groups`) are missing the `Access-Control-Allow-Origin` header (see pi-hole/FTL issue #2261), which breaks direct cross-origin calls from this app — the filter list comes back empty while the status page still works. The proxy sidesteps the bug entirely and keeps working once FTL fixes it upstream.

-   `PIHOLE_PROXY_TARGET` must be the address of the Pi-hole **as seen from the container** (e.g. `172.17.0.1` for a Pi-hole on the Docker host, a LAN IP, or a Docker service name if both run in the same compose network). FTL is expected on port `1010`.
-   `REACT_APP_PIHOLE_ADMIN` is optional: the URL the "open admin" button should use. Without it, the admin UI is opened at the app's own origin (`/admin`), which only works if your reverse setup also serves the Pi-hole admin interface from there.

Alternatively you can keep the direct, cross-origin mode by setting an absolute base URL:

`REACT_APP_PIHOLE_BASE=http://192.168.1.12:1010/api`

— but be aware it is affected by the FTL CORS bug described above until it is fixed upstream.

-   Parameters explanation

    -d: Run the container in detached mode (in the background).

    -p 3016:80: Map port 3016 on the host to port 80 inside the container.

    -e REACT_APP_PIHOLE_PASSWORD=<pihole password>: Set the REACT_APP_PIHOLE_PASSWORD environment variable with your Pihole API key.

    -e REACT_APP_PIHOLE_BASE=< e.g /api or http://192.168.1.12:1010/api>: Set the REACT_APP_PIHOLE_BASE environment variable with the specified base URL.

    -e PIHOLE_PROXY_TARGET=< e.g 172.17.0.1>: Address of the Pi-hole as seen from the container, used by the built-in /api reverse proxy.

    -e REACT_APP_PIHOLE_ADMIN=< e.g http://192.168.1.12:1010/admin>: Optional URL for the "open admin" button.

    mikicv/pihole-switcher:latest : Specify the image name and tag.

---

If you preffer docker compose instead

```docker compose
version: '3'

services:
  pihole-switcher:
    image: mikicv/pihole-switcher:latest
    ports:
      - "3016:80"
    environment:
      - REACT_APP_PIHOLE_PASSWORD=<pihole password>
      - REACT_APP_PIHOLE_BASE=/api
      - PIHOLE_PROXY_TARGET=<pihole address as seen from the container, e.g. 172.17.0.1>
      - REACT_APP_PIHOLE_ADMIN=<optional pi-hole admin URL, e.g. http://192.168.1.12:1010/admin>
```

**_Make sure you replace pihole password and your pihole base URL with your actual Pihole password and ensure that the pihole-switcher-prod:latest image is available on your system._**

# High level overview

This app interacts with pihole HTTP API

-   View API endpoints at pihole API documentation: e.g http://192.168.1.1:8080/api/docs

## Development:

-   For development purposes, .env.local file has to be created with ENV params mentioned above in root.
-   This will require you to have a pihole instance running either bare-metal or in docker.
-   Latest version of: Yarn and Node

# Preview

<img width="543" alt="switcher-preview-1" src="https://github.com/mikicvi/pihole-switcher/assets/88291034/92129741-993b-45a3-a902-614ddfbc9414">
<img width="543" alt="switcher-preview-2" src="https://github.com/mikicvi/pihole-switcher/assets/88291034/bf67b1b4-b7e7-480c-be2f-3ff7cabed6ef">

## Notice:

-   This is a work in progress. Any suggestions are more than welcome, as well as feature suggestions and PR's.
-   This project is built on Typescript/NodeJS/React, so any contributions should be within this stack.

---

Contact: <mika5566@gmail.com>
