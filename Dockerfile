# syntax=docker/dockerfile:1

# The build runs on every target arch (amd64 natively; arm64 and arm/v7
# under QEMU emulation). npm must install the platform-specific *native*
# optional deps for the arch being built for, not for the build host
# (the runner is linux/amd64). Without --force the cross-compiled build
# fails with "Cannot find native binding" because rollup/rolldown's
# optional native tarballs don't match the amd64 host and get skipped,
# and under QEMU 32-bit the rolldown wasm fallback never loads. This is
# the classic npm optional-dependency cross-arch bug
# (https://github.com/npm/cli/issues/4828). --force is a no-op on the
# host arch, so amd64 builds are unaffected. (The production stage only
# installs chart.js — adapter-node bundles all bundler deps into build/ —
# so it needs no force flag.)
ARG NPM_INSTALL_FORCE=true

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --force=$NPM_INSTALL_FORCE
COPY . .
RUN npm run build

# ---- Production stage ----
# npm ci --omit=dev installs only the runtime dependencies (SvelteKit's
# adapter-node bundles everything else into build/), so the final image is
# small and carries no dev toolchain.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/health > /dev/null 2>&1 || exit 1
CMD ["node", "build"]
