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

## Setting up

This project was built to be served from docker.

-   To build a docker image execute from root of project:

`yarn install && yarn build`

`docker build -t pihole-switcher-prod .`

On linux, image can be exported like:

`docker save pihole-switcher-prod:latest | gzip > pihole-switcher-prod.tar.gz`

```
docker run -d -p 3016:80 \
  -e REACT_APP_PIHOLE_KEY=<pihole API key> \
  -e REACT_APP_PIHOLE_BASE=http://192.168.1.12:1010/admin/ \
  pihole-switcher-prod:latest
```

-   Parameters explanation

    -d: Run the container in detached mode (in the background).

    -p 3016:80: Map port 3016 on the host to port 80 inside the container.

    -e REACT_APP_PIHOLE_KEY=<pihole API key>: Set the REACT_APP_PIHOLE_KEY environment variable with your Pihole API key.

    -e REACT_APP_PIHOLE_BASE=< e.g http://192.168.1.1:8080/admin/>: Set the REACT_APP_PIHOLE_BASE environment variable with the specified base URL.

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
      - REACT_APP_PIHOLE_KEY=<pihole API key>
      - REACT_APP_PIHOLE_BASE=<pihole base URL> e.g http://192.168.1.1:8080/admin/
```

**_Make sure you replace pihole API key and your pihole base URL with your actual Pihole API key and ensure that the pihole-switcher-prod:latest image is available on your system._**

# High level overview

This app interacts with pihole HTTP API

More info about it can be found in [this](https://discourse.pi-hole.net/t/pi-hole-api/1863) forum post.

## Development:

-   For development purposes, .env.local file has to be created with ENV params mentioned above in root.
-   This will require you to have a pihole instance running either bare-metal or in docker.
-   Latest version of: Yarn and Node

# Preview

![Pihole-switcher-preview](https://github.com/mikicvi/pihole-switcher/assets/88291034/35bf1884-8e6d-4c6d-b7b7-089296017785)
![Pihole-switcher-preview-2](https://github.com/mikicvi/pihole-switcher/assets/88291034/25f47202-5e55-403d-9dcd-f9805efb7c40)

## Notice:

-   This is a work in progress. Any suggestions are more than welcome, as well as feature suggestions and PR's.
-   This project is built on Typescript/NodeJS/React, so any contributions should be within this stack.

---

Contact: <mika5566@gmail.com>
