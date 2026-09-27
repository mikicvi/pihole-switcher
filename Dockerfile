# syntax=docker/dockerfile:1

# The build runs on every target arch (amd64 natively; arm64 and arm/v7
# under QEMU emulation). Two things make the cross-arch build work:
#
# 1. glibc base (bookworm-slim) instead of alpine/musl: rolldown (Vite 8's
#    bundler) ships a native linux-arm-gnueabihf binding for arm/v7 on
#    glibc, but NOT a musl arm/v7 build — on alpine it falls back to the
#    wasm32-wasi binding, whose threading panics under QEMU 32-bit ARM
#    ("OS can't spawn worker thread") and hangs the build.
# 2. `npm ci --force` in the build stage: on a linux/amd64 runner, npm
#    skips platform-optional tarballs that don't match the *host* arch
#    (npm/cli#4828), so without --force the arm/arm64 native bindings
#    never land in the image. No-op on the host arch.
#
# The production stage only installs runtime deps (adapter-node bundles
# everything else into build/), so it needs no force flag.

# ---- Build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --force
COPY . .
RUN npm run build

# ---- Production stage ----
# npm ci --omit=dev installs only the runtime dependencies (SvelteKit's
# adapter-node bundles everything else into build/), so the final image is
# small and carries no dev toolchain.
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
# bookworm-slim has no wget/curl — use node's built-in fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
